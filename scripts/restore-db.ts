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

function parseConnection(connectionString: string, label: string) {
  const url = new URL(connectionString);
  if (url.protocol !== 'mysql:') throw new Error(label + ' must use the MySQL protocol.');
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!url.hostname || !database || !url.username) throw new Error(label + ' must include host, user and database.');
  const sslAccept = url.searchParams.get('sslaccept');
  if (sslAccept && sslAccept !== 'strict') throw new Error('Only strict MySQL TLS verification is permitted for remote restore.');
  const args = ['--host', url.hostname, '--port', url.port || '3306', '--user', decodeURIComponent(url.username), '--default-character-set=utf8mb4'];
  if (sslAccept === 'strict') args.push('--ssl-mode=VERIFY_IDENTITY');
  if (process.env.MYSQL_SSL_CA) args.push('--ssl-ca', process.env.MYSQL_SSL_CA);
  return {
    host: url.hostname, port: url.port || '3306', database, args,
    env: { ...process.env, ...(url.password ? { MYSQL_PWD: decodeURIComponent(url.password) } : {}) },
  };
}

function getBackupKey(): Buffer {
  const value = process.env.BACKUP_ENCRYPTION_KEY;
  if (!value || !/^[a-f0-9]{64}$/i.test(value)) throw new Error('BACKUP_ENCRYPTION_KEY must be a private 64-character hexadecimal key.');
  return Buffer.from(value, 'hex');
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

async function decryptBackup(backupPath: string, key: Buffer): Promise<string> {
  const handle = await fs.promises.open(backupPath, 'r');
  let header: Buffer; let authTag: Buffer; let size = 0;
  try {
    size = (await handle.stat()).size;
    if (size <= BACKUP_MAGIC.length + NONCE_LENGTH + AUTH_TAG_LENGTH) throw new Error('Encrypted backup is too short.');
    header = Buffer.alloc(BACKUP_MAGIC.length + NONCE_LENGTH);
    authTag = Buffer.alloc(AUTH_TAG_LENGTH);
    const h = await handle.read(header, 0, header.length, 0);
    const t = await handle.read(authTag, 0, authTag.length, size - AUTH_TAG_LENGTH);
    if (h.bytesRead !== header.length || t.bytesRead !== authTag.length) throw new Error('Backup header or authentication tag is truncated.');
  } finally { await handle.close(); }
  if (!header!.subarray(0, BACKUP_MAGIC.length).equals(BACKUP_MAGIC)) throw new Error('Unsupported backup format.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, header!.subarray(BACKUP_MAGIC.length));
  decipher.setAuthTag(authTag!);
  const output = path.join(os.tmpdir(), 'topup-mysql-restore-' + crypto.randomBytes(12).toString('hex') + '.sql');
  try {
    await pipeline(
      fs.createReadStream(backupPath, { start: header!.length, end: size - AUTH_TAG_LENGTH - 1 }),
      decipher,
      fs.createWriteStream(output, { flags: 'wx', mode: 0o600 }),
    );
    return output;
  } catch {
    await fs.promises.rm(output, { force: true });
    throw new Error('Backup decryption/authentication failed; restore was not started.');
  }
}

async function runMysql(args: string[], env: NodeJS.ProcessEnv, inputFile?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('mysql', args, { env, stdio: [inputFile ? 'pipe' : 'ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = ''; let settled = false;
    const fail = (error: Error) => { if (!settled) { settled = true; child.kill(); reject(error); } };
    child.stdout.on('data', (chunk: Buffer) => { stdout = (stdout + chunk.toString()).slice(-8000); });
    child.stderr.on('data', (chunk: Buffer) => { stderr = (stderr + chunk.toString()).slice(-8000); });
    child.on('error', (error) => fail(new Error('Unable to start MySQL client: ' + error.message)));
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      if (code !== 0) reject(new Error('MySQL client exited with code ' + code + ': ' + stderr.trim()));
      else resolve(stdout);
    });
    if (inputFile) {
      pipeline(fs.createReadStream(inputFile), child.stdin!).catch((error: unknown) => fail(error instanceof Error ? error : new Error('SQL import stream failed.')));
    }
  });
}

async function main() {
  const args = process.argv.slice(2);
  const fileIndex = args.indexOf('--file');
  if (fileIndex < 0 || !args[fileIndex + 1] || !args.includes('--confirm-restore')) throw new Error('Usage: restore-db --file <encrypted-backup.dump> --confirm-restore');
  if (process.env.NODE_ENV === 'production') throw new Error('Restore drills are disabled when NODE_ENV=production.');
  if (!process.env.RESTORE_DATABASE_URL) throw new Error('Set RESTORE_DATABASE_URL to an isolated empty MySQL database.');
  const target = parseConnection(process.env.RESTORE_DATABASE_URL, 'RESTORE_DATABASE_URL');
  if (!/(restore|test|sandbox)/i.test(target.database) || /(prod|production|live)/i.test(target.database)) throw new Error('Restore target name must identify an isolated restore, test or sandbox database.');
  const localHosts = ['localhost', '127.0.0.1', '::1'];
  if (!localHosts.includes(target.host.toLowerCase()) && process.env.ALLOW_REMOTE_RESTORE !== 'true') throw new Error('Remote restore is blocked; use a reviewed isolated target and set ALLOW_REMOTE_RESTORE=true.');
  if (process.env.DATABASE_URL) {
    const source = parseConnection(process.env.DATABASE_URL, 'DATABASE_URL');
    const normalizeHost = (host: string) => localHosts.includes(host.toLowerCase()) ? 'local' : host.toLowerCase();
    if (normalizeHost(source.host) === normalizeHost(target.host) && source.port === target.port && source.database === target.database) throw new Error('Restore target must differ from DATABASE_URL.');
  }
  const backupPath = path.resolve(__dirname, '..', args[fileIndex + 1]);
  const manifest = await fs.promises.readFile(backupPath + '.sha256', 'utf8');
  const expected = manifest.trim().split(/\s+/)[0];
  if (!/^[a-f0-9]{64}$/i.test(expected)) throw new Error('Backup checksum manifest is missing or malformed.');
  const actual = await sha256File(backupPath);
  if (actual.toLowerCase() !== expected.toLowerCase()) throw new Error('Backup checksum mismatch; restore was not started.');
  const decrypted = await decryptBackup(backupPath, getBackupKey());
  try {
    const tables = await runMysql([...target.args, '--batch', '--skip-column-names', '--execute', 'SHOW TABLES', target.database], target.env);
    if (tables.trim()) throw new Error('Restore target is not empty. No tables were changed; create a fresh isolated database.');
    console.log('Backup authentication and checksum passed; importing into isolated empty database ' + target.database + '.');
    await runMysql([...target.args, '--database', target.database], target.env, decrypted);
    console.log('MySQL restore completed. Run migration status and ledger reconciliation next.');
  } finally { await fs.promises.rm(decrypted, { force: true }); }
}

main().catch((error: unknown) => {
  console.error('MySQL restore failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
