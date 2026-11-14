import { Injectable, Logger, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'crypto';
import { createClient } from 'redis';

const COMPLETE_IF_OWNED_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("SET", KEYS[1], ARGV[2], "PX", ARGV[3])
end
return false
`;

const DELETE_IF_OWNED_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`;

const CREATE_REFRESH_SESSION_SCRIPT = `
redis.call("SET", KEYS[1], ARGV[1], "PX", ARGV[3])
redis.call("SADD", KEYS[2], ARGV[2])
redis.call("PEXPIRE", KEYS[2], ARGV[3])
return 1
`;

const INCREMENT_WITH_TTL_SCRIPT = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
return count
`;

const REVOKE_USER_REFRESH_SESSIONS_SCRIPT = `
local tokenHashes = redis.call("SMEMBERS", KEYS[1])
for _, tokenHash in ipairs(tokenHashes) do
  redis.call("DEL", ARGV[1] .. tokenHash)
end
redis.call("DEL", KEYS[1])
return #tokenHashes
`;

@Injectable()
export class RedisIdempotencyStore implements OnModuleDestroy {
  private readonly logger = new Logger(RedisIdempotencyStore.name);
  private readonly client = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
      connectTimeout: 2000,
      reconnectStrategy: (retries) => (retries < 1 ? 250 : false),
    },
  });
  private connection?: Promise<void>;

  constructor() {
    this.client.on('error', () => {
      this.logger.error('Redis connection emitted an error.');
    });
  }

  async get(key: string): Promise<string | null> {
    await this.ensureConnected();
    return this.client.get(key);
  }

  async setValue(key: string, value: string, ttlMs: number): Promise<void> {
    await this.ensureConnected();
    await this.client.set(key, value, { PX: ttlMs });
  }

  async deleteValue(key: string): Promise<void> {
    await this.ensureConnected();
    await this.client.del(key);
  }

  async consumeOnce(key: string, ttlMs: number): Promise<boolean> {
    return this.acquire(key, '1', ttlMs);
  }

  async incrementWithTtl(key: string, ttlMs: number): Promise<number> {
    await this.ensureConnected();
    const result = await this.client.eval(INCREMENT_WITH_TTL_SCRIPT, {
      keys: [key],
      arguments: [String(ttlMs)],
    });
    const value = Number(result);
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new ServiceUnavailableException('Redis counter returned an invalid value.');
    }
    return value;
  }

  async ping(): Promise<number> {
    const startedAt = Date.now();
    await this.ensureConnected();
    const response = await this.client.ping();
    if (response !== 'PONG') {
      throw new ServiceUnavailableException('Redis health check returned an unexpected response.');
    }
    return Date.now() - startedAt;
  }

  async acquire(key: string, processingValue: string, ttlMs: number): Promise<boolean> {
    await this.ensureConnected();
    const result = await this.client.set(key, processingValue, { NX: true, PX: ttlMs });
    return result === 'OK';
  }

  async complete(
    key: string,
    processingValue: string,
    completedValue: string,
    ttlMs: number,
  ): Promise<boolean> {
    await this.ensureConnected();
    const result = await this.client.eval(COMPLETE_IF_OWNED_SCRIPT, {
      keys: [key],
      arguments: [processingValue, completedValue, String(ttlMs)],
    });
    return result === 'OK';
  }

  async release(key: string, processingValue: string): Promise<void> {
    await this.ensureConnected();
    await this.client.eval(DELETE_IF_OWNED_SCRIPT, {
      keys: [key],
      arguments: [processingValue],
    });
  }

  async createRefreshSession(
    userId: string,
    tokenHash: string,
    sessionValue: string,
    ttlMs: number,
  ): Promise<void> {
    await this.ensureConnected();
    await this.client.eval(CREATE_REFRESH_SESSION_SCRIPT, {
      keys: [`auth:refresh:${tokenHash}`, this.getSessionIndexKey(userId)],
      arguments: [sessionValue, tokenHash, String(ttlMs)],
    });
  }

  async getRefreshSession(tokenHash: string): Promise<string | null> {
    await this.ensureConnected();
    return this.client.get(`auth:refresh:${tokenHash}`);
  }

  async revokeRefreshSession(userId: string, tokenHash: string): Promise<void> {
    await this.ensureConnected();
    await this.client
      .multi()
      .del(`auth:refresh:${tokenHash}`)
      .sRem(this.getSessionIndexKey(userId), tokenHash)
      .exec();
  }

  async revokeUserRefreshSessions(userId: string): Promise<void> {
    await this.ensureConnected();
    await this.client.eval(REVOKE_USER_REFRESH_SESSIONS_SCRIPT, {
      keys: [this.getSessionIndexKey(userId)],
      arguments: ['auth:refresh:'],
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.isOpen) {
      await this.client.quit();
    }
  }

  private async ensureConnected(): Promise<void> {
    if (this.client.isOpen) {
      return;
    }
    if (!this.connection) {
      this.connection = this.client.connect().then(() => undefined).catch((error: unknown) => {
        this.connection = undefined;
        this.logger.error('Unable to connect to Redis for idempotency storage.');
        throw new ServiceUnavailableException('Idempotency storage is temporarily unavailable.', {
          cause: error,
        });
      });
    }
    await this.connection;
  }

  private getSessionIndexKey(userId: string): string {
    const userHash = createHash('sha256').update(userId).digest('hex');
    return `auth:user-sessions:${userHash}`;
  }
}
