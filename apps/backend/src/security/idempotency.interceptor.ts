import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  BadRequestException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { Observable, catchError, from, mergeMap, of, throwError } from 'rxjs';
import { RedisIdempotencyStore } from './redis-idempotency.store';

const PROCESSING_TTL_MS = 15 * 60 * 1000;
const COMPLETED_TTL_MS = 24 * 60 * 60 * 1000;

interface StoredResponse {
  state: 'completed';
  requestHash: string;
  statusCode: number;
  body: unknown;
  contentType?: string;
}

interface IdempotentRequest extends Request {
  user?: { id?: string };
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly store: RedisIdempotencyStore) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<IdempotentRequest>();
    const response = http.getResponse<Response>();
    if (!this.requiresIdempotency(request.method, request.path)) {
      return next.handle();
    }

    const idempotencyKey = request.header('Idempotency-Key')?.trim();
    if (!idempotencyKey || idempotencyKey.length > 128) {
      throw new BadRequestException('A valid Idempotency-Key header is required for this operation.');
    }

    const scope = request.user?.id || request.ip || 'anonymous';
    const storageKey = this.getStorageKey(scope, request.method, request.path, idempotencyKey);
    const requestHash = createHash('sha256')
      .update(JSON.stringify(request.body ?? null))
      .digest('hex');
    const ownerToken = randomUUID();
    const processingValue = JSON.stringify({ state: 'processing', ownerToken, requestHash });

    return from(this.claimOrReplay(storageKey, processingValue, requestHash)).pipe(
      mergeMap((cachedResponse) => {
        if (cachedResponse) {
          if (cachedResponse.contentType) {
            response.setHeader('content-type', cachedResponse.contentType);
          }
          response.status(cachedResponse.statusCode);
          return of(cachedResponse.body);
        }

        return next.handle().pipe(
          mergeMap((body) =>
            from(this.storeResponse(storageKey, processingValue, requestHash, body, response)).pipe(
              mergeMap(() => of(body)),
            ),
          ),
          catchError((error: unknown) =>
            from(this.store.release(storageKey, processingValue)).pipe(
              mergeMap(() => throwError(() => error)),
            ),
          ),
        );
      }),
    );
  }

  private async claimOrReplay(
    key: string,
    processingValue: string,
    requestHash: string,
  ): Promise<StoredResponse | null> {
    const existing = await this.store.get(key);
    if (existing) {
      return this.resolveExisting(existing, requestHash);
    }

    if (await this.store.acquire(key, processingValue, PROCESSING_TTL_MS)) {
      return null;
    }

    const racedValue = await this.store.get(key);
    if (!racedValue) {
      throw new ConflictException('This idempotent operation could not be claimed; retry with the same key.');
    }
    return this.resolveExisting(racedValue, requestHash);
  }

  private resolveExisting(storedValue: string, requestHash: string): StoredResponse | null {
    let stored: {
      state?: string;
      requestHash?: string;
      statusCode?: number;
      body?: unknown;
      contentType?: string;
    };
    try {
      stored = JSON.parse(storedValue);
    } catch {
      throw new ConflictException('The idempotency record is invalid; contact support before retrying.');
    }
    if (stored.state === 'processing') {
      if (stored.requestHash !== requestHash) {
        throw new ConflictException('This Idempotency-Key is already being used with a different request body.');
      }
      throw new ConflictException('An operation with this Idempotency-Key is already in progress.');
    }
    if (
      stored.state !== 'completed' ||
      stored.requestHash !== requestHash ||
      !Number.isInteger(stored.statusCode) ||
      stored.body === undefined
    ) {
      if (stored.state === 'completed' && stored.requestHash !== requestHash) {
        throw new ConflictException('This Idempotency-Key was already used with a different request body.');
      }
      throw new ConflictException('The idempotency record is invalid; contact support before retrying.');
    }
    return stored as StoredResponse;
  }

  private async storeResponse(
    key: string,
    processingValue: string,
    requestHash: string,
    body: unknown,
    response: Response,
  ): Promise<void> {
    const storedResponse: StoredResponse = {
      state: 'completed',
      requestHash,
      statusCode: response.statusCode,
      body: body === undefined ? null : body,
      contentType: response.getHeader('content-type')?.toString(),
    };
    const completed = await this.store.complete(
      key,
      processingValue,
      JSON.stringify(storedResponse),
      COMPLETED_TTL_MS,
    );
    if (!completed) {
      throw new ConflictException('Idempotency ownership expired before the result could be stored.');
    }
  }

  private getStorageKey(scope: string, method: string, path: string, key: string): string {
    const digest = createHash('sha256')
      .update([scope, method.toUpperCase(), path, key].join('\0'))
      .digest('hex');
    return `idempotency:${digest}`;
  }

  private requiresIdempotency(method: string, path: string): boolean {
    if (method.toUpperCase() !== 'POST') {
      return false;
    }
    const normalizedPath = path.replace(/^\/api(?=\/|$)/, '');
    // Checkout has an explicit, shared header/body contract across Web and
    // Flutter. Other financial/admin POST routes must opt in individually;
    // broad prefixes would break actions that do not send an idempotency key.
    return /^\/orders\/checkout\/?$/i.test(normalizedPath);
  }
}
