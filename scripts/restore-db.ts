import * as crypto from 'crypto';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';
import { pipeline } from 'stream/promises';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const BACKUP_MAGIC = Buffer.from('DTUPBK01');
const NONCE_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getConnectionOptions(connectionString: string) {
  const url = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('RESTORE_DATABASE_URL must use the PostgreSQL protocol.');
  }

  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!url.hostname || !database) {
    throw new Error('RESTORE_DATABASE_URL must include a host and database name.');
  }

  const sslMode = url.searchParams.get('sslmode');
  if (sslMode && !['disable', 'allow', 'prefer', 'require', 'verify-ca', 'verify-full'].includes(sslMode)) {
    throw new Error('RESTORE_DATABASE_URL contains an unsupported sslmode.');
  }

  return {
    host: url.hostname,
    port: url.port || '5432',
    database,
    args: [
      '--host',
      url.hostname,
      '--port',
      url.port || '5432',
      '--username',
      decodeURIComponent(url.username),
    ],
    env: {
      ...process.env,
      ...(url.password ? { PGPASSWORD: decodeURIComponent(url.password) } : {}),
      ...(sslMode ? { PGSSLMODE: sslMode } : {}),
    },
  };
}

function runPgRestore(args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    const childProcess = spawn('pg_restore', args, { env, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    childProcess.stderr.on('data', (chunk: Buffer) => {
      stderr = `${stderr}${chunk.toString()}`.slice(-8000);
    });
    childProcess.on('error', (error) => reject(new Error(`Unable to start pg_restore: ${error.message}`)));
    childProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`pg_restore failed with exit code ${code}: ${stderr.trim()}`));
      } else {
        resolve();
      }
    });
  });
}

async function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const input = fs.createReadStream(filePath);
    input.on('data', (chunk) => hash.update(chunk));
    input.on('error', reject);
    input.on('end', () => resolve(hash.digest('hex')));
  });
}

function getBackupKey(): Buffer {
  const configuredKey = process.env.BACKUP_ENCRYPTION_KEY;
  if (!configuredKey || !/^[a-f0-9]{64}$/i.test(configuredKey)) {
    throw new Error('BACKUP_ENCRYPTION_KEY must be configured as a private 64-character hexadecimal key.');
  }
  return Buffer.from(configuredKey, 'hex');
}

async function decryptBackup(backupPath: string, key: Buffer): Promise<string> {
  const handle = await fs.promises.open(backupPath, 'r');
  let header: Buffer;
  let authTag: Buffer;
  let size: number;
  try {
    const stats = await handle.stat();
    size = stats.size;
    if (size <= BACKUP_MAGIC.length + NONCE_LENGTH + AUTH_TAG_LENGTH) {
      throw new Error('Encrypted backup is too short to contain a valid archive.');
    }

    header = Buffer.alloc(BACKUP_MAGIC.length + NONCE_LENGTH);
    authTag = Buffer.alloc(AUTH_TAG_LENGTH);
    const headerRead = await handle.read(header, 0, header.length, 0);
    const tagRead = await handle.read(authTag, 0, authTag.length, size - AUTH_TAG_LENGTH);
    if (headerRead.bytesRead !== header.length || tagRead.bytesRead !== authTag.length) {
      throw new Error('Encrypted backup header or authentication tag is truncated.');
    }
  } finally {
    await handle.close();
  }

  if (!header.subarray(0, BACKUP_MAGIC.length).equals(BACKUP_MAGIC)) {
    throw new Error('Backup format is unsupported or the file is not encrypted by this application.');
  }

  const nonce = header.subarray(BACKUP_MAGIC.length);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAuthTag(authTag);
  const restoredArchivePath = path.join(os.tmpdir(), `digital-topup-restore-${crypto.randomBytes(12).toString('hex')}.dump`);

  try {
    await pipeline(
      fs.createReadStream(backupPath, {
        start: header.length,
        end: size - AUTH_TAG_LENGTH - 1,
      }),
      decipher,
      fs.createWriteStream(restoredArchivePath, { flags: 'wx', mode: 0o600 }),
    );
    return restoredArchivePath;
  } catch {
    await fs.promises.rm(restoredArchivePath, { force: true });
    throw new Error('Backup decryption/authentication failed; restore was not started.');
  }
}

async function main() {
  const args = process.argv.slice(2);
  const fileIndex = args.indexOf('--file');
  if (fileIndex < 0 || !args[fileIndex + 1] || !args.includes('--confirm-restore')) {
    throw new Error('Usage: restore-db --file <backup.dump> --confirm-restore');
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Restore drills are disabled when NODE_ENV=production.');
  }

  const restoreUrl = process.env.RESTORE_DATABASE_URL;
  if (!restoreUrl) {
    throw new Error('Set RESTORE_DATABASE_URL to an isolated restore/test database.');
  }

  const target = getConnectionOptions(restoreUrl);
  if (!/(restore|test|sandbox)/i.test(target.database) || /(prod|production|live)/i.test(target.database)) {
    throw new Error('Restore target database name must identify an isolated restore, test, or sandbox database.');
  }
  if (
    !['localhost', '127.0.0.1', '::1'].includes(target.host) &&
    process.env.ALLOW_REMOTE_RESTORE !== 'true'
  ) {
    throw new Error('Remote restore is blocked; set ALLOW_REMOTE_RESTORE=true only for a reviewed isolated target.');
  }

  if (process.env.DATABASE_URL) {
    const source = getConnectionOptions(process.env.DATABASE_URL);
    const normalizeHost = (host: string) =>
      ['localhost', '127.0.0.1', '::1'].includes(host.toLowerCase()) ? 'local' : host.toLowerCase();
    if (
      normalizeHost(source.host) === normalizeHost(target.host) &&
      source.port === target.port &&
      source.database === target.database
    ) {
      throw new Error('Restore target must not be the same database as DATABASE_URL.');
    }
  }

  const backupPath = path.resolve(__dirname, '..', args[fileIndex + 1]);
  const checksumPath = `${backupPath}.sha256`;
  const checksumText = await fs.promises.readFile(checksumPath, 'utf8');
  const expectedChecksum = checksumText.trim().split(/\s+/)[0];
  if (!/^[a-f0-9]{64}$/i.test(expectedChecksum)) {
    throw new Error('Backup checksum manifest is missing or malformed.');
  }

  const actualChecksum = await sha256File(backupPath);
  if (actualChecksum.toLowerCase() !== expectedChecksum.toLowerCase()) {
    throw new Error('Backup checksum mismatch; restore was not started.');
  }

  const decryptedBackupPath = await decryptBackup(backupPath, getBackupKey());
  try {
    await runPgRestore(['--list', decryptedBackupPath], target.env);
    console.log(`Verified checksum and AES-256-GCM authentication. Restoring to isolated database "${target.database}".`);
    await runPgRestore(
      [
        ...target.args,
        '--dbname',
        target.database,
        '--clean',
        '--if-exists',
        '--no-owner',
        '--no-acl',
        '--exit-on-error',
        decryptedBackupPath,
      ],
      target.env,
    );
    console.log(`Restore completed for isolated database "${target.database}".`);
  } finally {
    await fs.promises.rm(decryptedBackupPath, { force: true });
  }
}

main().catch((error: unknown) => {
  console.error('Database restore failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
