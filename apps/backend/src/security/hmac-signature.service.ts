import { createHmac, timingSafeEqual } from 'crypto';
import { Injectable } from '@nestjs/common';

const DEFAULT_TIMESTAMP_TOLERANCE_SECONDS = 300;

@Injectable()
export class HmacSignatureService {
  sign(payload: string | Buffer, secret: string, timestamp: number): string {
    this.validateSecret(secret);
    this.validateTimestamp(timestamp);
    const body = Buffer.isBuffer(payload) ? payload : Buffer.from(payload, 'utf8');
    return createHmac('sha256', secret)
      .update(String(timestamp), 'utf8')
      .update('.', 'utf8')
      .update(body)
      .digest('hex');
  }

  verify(
    payload: string | Buffer,
    signature: string,
    timestamp: string | number,
    secret: string,
    toleranceSeconds = DEFAULT_TIMESTAMP_TOLERANCE_SECONDS,
    nowSeconds = Math.floor(Date.now() / 1000),
  ): boolean {
    this.validateSecret(secret);
    const timestampNumber = typeof timestamp === 'number' ? timestamp : Number(timestamp);
    if (
      !Number.isSafeInteger(timestampNumber) ||
      !Number.isSafeInteger(nowSeconds) ||
      !Number.isFinite(toleranceSeconds) ||
      toleranceSeconds < 0 ||
      Math.abs(nowSeconds - timestampNumber) > toleranceSeconds ||
      !/^[0-9a-f]{64}$/i.test(signature)
    ) {
      return false;
    }

    const expected = Buffer.from(this.sign(payload, secret, timestampNumber), 'hex');
    const provided = Buffer.from(signature, 'hex');
    return provided.length === expected.length && timingSafeEqual(provided, expected);
  }

  private validateSecret(secret: string): void {
    if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
      throw new Error('HMAC secret must contain at least 32 bytes.');
    }
  }

  private validateTimestamp(timestamp: number): void {
    if (!Number.isSafeInteger(timestamp) || timestamp < 0) {
      throw new Error('HMAC timestamp must be a non-negative integer in seconds.');
    }
  }
}
