import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_OPTIONS = 'security:redis-rate-limit';

export interface RedisRateLimitOptions {
  limit: number;
  windowMs: number;
  scope: string;
}

export const RateLimit = (limit: number, windowMs: number, scope: string) => {
  if (!Number.isInteger(limit) || limit < 1 || !Number.isInteger(windowMs) || windowMs < 1000 || !scope.trim()) {
    throw new Error('Invalid Redis rate-limit decorator configuration.');
  }
  return SetMetadata(RATE_LIMIT_OPTIONS, { limit, windowMs, scope } satisfies RedisRateLimitOptions);
};
