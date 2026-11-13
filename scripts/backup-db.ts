import * as crypto from 'crypto';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const BACKUP_MAGIC = Buffer.from('DTUPBK01');
const BACKUP_KEY_ENV = 'BACKUP_ENCRYPTION_KEY';

function getConnectionOptions(connectionString: string) {
  const url = new URL(connectionString);
  if (url.protocol !== 'mysql:') throw new Error('DATABASE_URL must use the MySQL protocol.');

  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!url.hostname || !database) {
    throw new Error('DATABASE_URL must include a host and database name.');
  }

  const sslAccept = url.searchParams.get('sslaccept');
  if (sslAccept && sslAccept !== 'strict') throw new Error('Only strict MySQL TLS verification is allowed for encrypted remote backups.');

  return {
    args: [
      '--host', url.hostname,
      '--port', url.port || '3306',
      '--user', decodeURIComponent(url.username),
      '--single-transaction',
      '--routines', '--triggers', '--events', '--hex-blob',
      '--set-gtid-purged=OFF',
      '--default-character-set=utf8mb4',
      ...(sslAccept === 'strict' ? ['--ssl-mode=VERIFY_IDENTITY'] : []),
      ...(process.env.MYSQL_SSL_CA ? ['--ssl-ca', process.env.MYSQL_SSL_CA] : []),
      database,
    ],
    env: {
      ...process.env,
      ...(url.password ? { MYSQL_PWD: decodeURIComponent(url.password) } : {}),
    },
  };
}

function getBackupKey(): Buffer {
  const configuredKey = process.env[BACKUP_KEY_ENV];
  if (!configuredKey || !/^[a-f0-9]{64}$/i.test(configuredKey)) {
    throw new Error(`${BACKUP_KEY_ENV} must be configured as a private 64-character hexadecimal key.`);
  }
  return Buffer.from(configuredKey, 'hex');
}

async function runBackup(
  destination: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  key: Buffer,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const childProcess = spawn(process.env.MYSQLDUMP_BIN || 'mysqldump', args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
    const output = fs.createWriteStream(destination, { flags: 'wx' });
    const nonce = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
    const encryptor = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        try {
          callback(null, cipher.update(chunk));
        } catch (error) {
          callback(error instanceof Error ? error : new Error('Failed to encrypt MySQL backup chunk.'));
        }
      },
      flush(callback) {
        try {
          this.push(cipher.final());
          this.push(cipher.getAuthTag());
          callback();
        } catch (error) {
          callback(error instanceof Error ? error : new Error('Failed to finalize encrypted MySQL backup.'));
        }
      },
    });
    let stderr = '';
    let childClosed = false;
    let streamFinished = false;
    let settled = false;

    const fail = (error: Error) => {
      if (!settled) {
        settled = true;
        childProcess.kill();
        reject(error);
      }
    };
    const finishIfReady = () => {
      if (!settled && childClosed && streamFinished) {
        settled = true;
        resolve();
      }
    };

    childProcess.stderr.on('data', (chunk: Buffer) => {
      stderr = `${stderr}${chunk.toString()}`.slice(-8000);
    });
    childProcess.on('error', (error) => fail(new Error(`Unable to start mysqldump: ${error.message}`)));
    childProcess.on('close', (code) => {
      if (code !== 0) {
        fail(new Error(`mysqldump failed with exit code ${code}: ${stderr.trim()}`));
        return;
      }
      childClosed = true;
      finishIfReady();
    });

    output.on('error', fail);
    output.write(Buffer.concat([BACKUP_MAGIC, nonce]), (error) => {
      if (error) {
        fail(error);
        return;
      }
      pipeline(childProcess.stdout, encryptor, output)
        .then(() => {
          streamFinished = true;
          finishIfReady();
        })
        .catch((error: unknown) =>
          fail(error instanceof Error ? error : new Error('Failed to encrypt MySQL backup stream.')),
        );
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

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required.');
  }

  const backupKey = getBackupKey();
  const connection = getConnectionOptions(connectionString);
  const backupDir = path.resolve(process.env.BACKUP_DIR || path.resolve(__dirname, '../backups'));
  await fs.promises.mkdir(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `mysql_${timestamp}_${crypto.randomBytes(4).toString('hex')}.dump`;
  const filePath = path.join(backupDir, fileName);
  const temporaryPath = `${filePath}.partial`;
  const checksumPath = `${filePath}.sha256`;
  const temporaryChecksumPath = `${checksumPath}.partial`;
  let backupPublished = false;
  let checksumPublished = false;
  const startedAt = Date.now();

  try {
    await runBackup(temporaryPath, connection.args, connection.env, backupKey);
    const stats = await fs.promises.stat(temporaryPath);
    if (!stats.size) {
      throw new Error('mysqldump produced an empty backup.');
    }

    const checksum = await sha256File(temporaryPath);
    await fs.promises.rename(temporaryPath, filePath);
    backupPublished = true;
    await fs.promises.writeFile(temporaryChecksumPath, `${checksum}  ${fileName}\n`, { flag: 'wx' });
    await fs.promises.rename(temporaryChecksumPath, checksumPath);
    checksumPublished = true;

    const prisma = new PrismaClient();
    try {
      await prisma.backupRecord.create({
        data: {
          fileName,
          sizeBytes: BigInt(stats.size),
          checksumSha256: checksum,
          status: 'COMPLETED',
          environment: process.env.NODE_ENV || 'development',
          tablesIncluded: 'all',
          durationSeconds: Math.max(1, Math.floor((Date.now() - startedAt) / 1000)),
          verificationNotes: 'AES-256-GCM encrypted MySQL SQL backup; SHA-256 checksum recorded.',
        },
      });
    } catch (error) {
      throw new Error(
        `Backup file was created at ${filePath}, but its database registry entry failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      await prisma.$disconnect();
    }

    console.log(`MySQL backup created: ${filePath}`);
    console.log(`Size: ${stats.size} bytes`);
    console.log(`SHA-256: ${checksum}`);
    console.log('Encryption: AES-256-GCM');
  } catch (error) {
    await Promise.all([
      fs.promises.rm(temporaryPath, { force: true }),
      fs.promises.rm(temporaryChecksumPath, { force: true }),
      ...(backupPublished && !checksumPublished ? [fs.promises.rm(filePath, { force: true })] : []),
      ...(checksumPublished ? [fs.promises.rm(checksumPath, { force: true })] : []),
    ]);
    throw error;
  }
}

main().catch((error: unknown) => {
  console.error('Database backup failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
