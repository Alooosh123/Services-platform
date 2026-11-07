import {
  CanActivate,
  ExecutionContext,
  Injectable,
  HttpException,
  HttpStatus,
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
    const ip = request.ip || request.socket?.remoteAddress || 'unknown';
    const tenant = request.tenantId || 'platform';
    const keys = [
      [options.scope, tenant, `ip:${ip}`].join(':'),
    ];
    if (request.user?.id) {
      keys.push([options.scope, tenant, `user:${request.user.id}`].join(':'));
    }

    // Enforce both per-IP and per-user quotas for authenticated routes.
    // Redis is authoritative; an unavailable store fails closed.
    const counters = await Promise.all(
      keys.map((key) => this.store.incrementRateLimit(key, options.windowMs)),
    );
    const remaining = Math.max(0, Math.min(...counters.map((counter) => options.limit - counter.count)));
    response.setHeader('X-RateLimit-Limit', String(options.limit));
    response.setHeader('X-RateLimit-Remaining', String(remaining));

    const blocked = counters.filter((counter) => counter.count > options.limit);
    if (blocked.length > 0) {
      const retryAfter = Math.max(1, ...blocked.map((counter) => Math.ceil(counter.ttlMs / 1000)));
      response.setHeader('Retry-After', String(retryAfter));
      throw new HttpException('تم تجاوز عدد المحاولات المسموح. يرجى الانتظار قبل إعادة المحاولة.', HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}
