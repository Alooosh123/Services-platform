import {
  CanActivate,
  ExecutionContext,
  Injectable,
  TooManyRequestsException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { RedisIdempotencyStore } from './redis-idempotency.store';
import { RATE_LIMIT_OPTIONS, RedisRateLimitOptions } from './rate-limit.decorator';

interface RateLimitedRequest extends Request {
  user?: { id?: string };
  tenantId?: string;
}

@Injectable()
export class RedisRateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly store: RedisIdempotencyStore,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<RedisRateLimitOptions>(RATE_LIMIT_OPTIONS, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!options) return true;

    const http = context.switchToHttp();
    const request = http.getRequest<RateLimitedRequest>();
    const response = http.getResponse<Response>();
    const identity = request.user?.id
      ? `user:${request.user.id}`
      : `ip:${request.ip || request.socket?.remoteAddress || 'unknown'}`;
    const tenant = request.tenantId || request.header('x-tenant-domain') || 'platform';
    const key = [options.scope, tenant, identity].join(':');

    // Redis is authoritative for these sensitive routes. An unavailable store
    // propagates ServiceUnavailableException rather than disabling the limit.
    const { count, ttlMs } = await this.store.incrementRateLimit(key, options.windowMs);
    const remaining = Math.max(0, options.limit - count);
    response.setHeader('X-RateLimit-Limit', String(options.limit));
    response.setHeader('X-RateLimit-Remaining', String(remaining));

    if (count > options.limit) {
      const retryAfter = Math.max(1, Math.ceil(ttlMs / 1000));
      response.setHeader('Retry-After', String(retryAfter));
      throw new TooManyRequestsException('تم تجاوز عدد المحاولات المسموح. يرجى الانتظار قبل إعادة المحاولة.');
    }
    return true;
  }
}
