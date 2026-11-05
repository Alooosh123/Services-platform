import { createHash } from 'crypto';
import { ConflictException } from '@nestjs/common';
import { of } from 'rxjs';
import { IdempotencyInterceptor } from './idempotency.interceptor';

describe('IdempotencyInterceptor', () => {
  let store: any;
  let interceptor: IdempotencyInterceptor;

  beforeEach(() => {
    store = {
      get: jest.fn().mockResolvedValue(null),
      acquire: jest.fn().mockResolvedValue(true),
      complete: jest.fn().mockResolvedValue(true),
      release: jest.fn().mockResolvedValue(undefined),
    };
    interceptor = new IdempotencyInterceptor(store);
  });

  const contextFor = (headers: Record<string, string> = {}) => {
    const request = {
      method: 'POST',
      path: '/api/orders/checkout',
      ip: '127.0.0.1',
      user: { id: 'user-1' },
      header: (name: string) => headers[name.toLowerCase()],
    };
    const response: any = {
      statusCode: 201,
      headers: {},
      status(code: number) { this.statusCode = code; return this; },
      setHeader(name: string, value: string) { this.headers[name] = value; },
      getHeader(name: string) { return this.headers[name]; },
    };
    const context: any = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    };
    return { context, response };
  };

  it('executes the first request once and stores its response for replay', async () => {
    const { context } = contextFor({ 'idempotency-key': 'checkout-1' });
    const handler = jest.fn(() => of({ orderId: 'order-1' }));
    const result = await new Promise((resolve, reject) => {
      interceptor.intercept(context, { handle: handler }).subscribe({ next: resolve, error: reject });
    });

    expect(result).toEqual({ orderId: 'order-1' });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(store.acquire).toHaveBeenCalledTimes(1);
    expect(store.complete).toHaveBeenCalledWith(
      expect.stringMatching(/^idempotency:/),
      expect.stringContaining('"state":"processing"'),
      expect.stringContaining('"state":"completed"'),
      expect.any(Number),
    );
  });

  it('returns the stored response without executing a completed operation again', async () => {
    store.get.mockResolvedValue(JSON.stringify({
      state: 'completed',
      requestHash: createHash('sha256').update('null').digest('hex'),
      statusCode: 201,
      body: { orderId: 'order-1' },
    }));
    const { context, response } = contextFor({ 'idempotency-key': 'checkout-1' });
    const handler = jest.fn(() => of({ orderId: 'order-2' }));
    const result = await new Promise((resolve, reject) => {
      interceptor.intercept(context, { handle: handler }).subscribe({ next: resolve, error: reject });
    });

    expect(result).toEqual({ orderId: 'order-1' });
    expect(response.statusCode).toBe(201);
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns conflict while the same key is being processed', async () => {
    store.get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(JSON.stringify({ state: 'processing', ownerToken: 'other' }));
    store.acquire.mockResolvedValue(false);
    const { context } = contextFor({ 'idempotency-key': 'checkout-1' });
    const handler = jest.fn(() => of({}));
    await expect(
      new Promise((resolve, reject) => {
        interceptor.intercept(context, { handle: handler }).subscribe({ next: resolve, error: reject });
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(handler).not.toHaveBeenCalled();
  });

  it('rejects reuse of a completed key with a different request body', async () => {
    store.get.mockResolvedValue(JSON.stringify({
      state: 'completed',
      requestHash: createHash('sha256').update('{"amount":1}').digest('hex'),
      statusCode: 201,
      body: { orderId: 'order-1' },
    }));
    const { context } = contextFor({ 'idempotency-key': 'checkout-1' });
    const handler = jest.fn(() => of({}));

    await expect(
      new Promise((resolve, reject) => {
        interceptor.intercept(context, { handle: handler }).subscribe({ next: resolve, error: reject });
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(handler).not.toHaveBeenCalled();
  });
});
