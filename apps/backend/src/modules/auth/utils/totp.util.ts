import * as crypto from 'crypto';

/**
 * Standard RFC 6238 / RFC 4226 Time-based One-Time Password (TOTP) Utility
 * Built exclusively using Node.js native crypto for zero third-party vulnerability surface.
 */
export class TotpUtil {
  private static readonly BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  private static readonly TIME_STEP_SECONDS = 30;
  private static readonly CODE_LENGTH = 6;

  /**
   * Generates a cryptographically secure random base32 secret string (20 bytes = 32 base32 chars).
   */
  static generateSecret(byteLength = 20): string {
    const buffer = crypto.randomBytes(byteLength);
    return this.encodeBase32(buffer);
  }

  /**
   * Generates current TOTP code for given secret and optional timestamp.
   */
  static generateCode(secret: string, timestampMs = Date.now()): string {
    const timeStep = Math.floor(timestampMs / 1000 / this.TIME_STEP_SECONDS);
    return this.generateCodeForCounter(secret, timeStep);
  }

  /**
   * Validates a TOTP code against a secret within a window of steps (default: ±1 step = 30s drift).
   */
  static verifyCode(
    token: string,
    secret: string,
    window = 1,
    timestampMs = Date.now(),
  ): boolean {
    if (!token || token.trim().length !== this.CODE_LENGTH) {
      return false;
    }

    const cleanToken = token.trim();
    const currentStep = Math.floor(timestampMs / 1000 / this.TIME_STEP_SECONDS);

    for (let offset = -window; offset <= window; offset++) {
      const step = currentStep + offset;
      const expectedCode = this.generateCodeForCounter(secret, step);

      // Timing-safe comparison to mitigate timing attacks
      if (this.timingSafeEqual(cleanToken, expectedCode)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generates otpauth:// URI for QR code integration with Google Authenticator / Authy.
   */
  static generateOtpAuthUri(accountName: string, issuer: string, secret: string): string {
    const encodedIssuer = encodeURIComponent(issuer);
    const encodedAccount = encodeURIComponent(accountName);
    return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
  }

  /**
   * Core RFC 4226 / RFC 6238 HMAC-SHA1 calculation.
   */
  private static generateCodeForCounter(secret: string, counter: number): string {
    const secretBuffer = this.decodeBase32(secret);

    // Counter buffer is 8-byte big-endian integer
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigUInt64BE(BigInt(counter));

    const hmac = crypto.createHmac('sha1', secretBuffer);
    hmac.update(counterBuffer);
    const digest = hmac.digest();

    // Dynamic truncation (RFC 4226 section 5.4)
    const offset = digest[digest.length - 1] & 0x0f;
    const binary =
      ((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff);

    const otp = binary % Math.pow(10, this.CODE_LENGTH);
    return otp.toString().padStart(this.CODE_LENGTH, '0');
  }

  private static encodeBase32(buffer: Buffer): string {
    let bits = 0;
    let value = 0;
    let output = '';

    for (let i = 0; i < buffer.length; i++) {
      value = (value << 8) | buffer[i];
      bits += 8;

      while (bits >= 5) {
        output += this.BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }

    if (bits > 0) {
      output += this.BASE32_ALPHABET[(value << (5 - bits)) & 31];
    }

    return output;
  }

  private static decodeBase32(base32String: string): Buffer {
    const cleanInput = base32String.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
    let bits = 0;
    let value = 0;
    const output: number[] = [];

    for (let i = 0; i < cleanInput.length; i++) {
      const idx = this.BASE32_ALPHABET.indexOf(cleanInput[i]);
      if (idx === -1) {
        continue;
      }
      value = (value << 5) | idx;
      bits += 5;

      if (bits >= 8) {
        output.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }

    return Buffer.from(output);
  }

  private static timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return crypto.timingSafeEqual(bufA, bufB);
  }
}
