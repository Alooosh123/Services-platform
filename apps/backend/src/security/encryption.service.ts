import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { Injectable, InternalServerErrorException } from '@nestjs/common';

const ENCRYPTION_VERSION = 'v1';
const AES_GCM_IV_BYTES = 12;
const AES_GCM_TAG_BYTES = 16;

@Injectable()
export class EncryptionService {
  encrypt(plaintext: string): string {
    const iv = randomBytes(AES_GCM_IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', this.getKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return [
      ENCRYPTION_VERSION,
      iv.toString('hex'),
      authTag.toString('hex'),
      ciphertext.toString('hex'),
    ].join(':');
  }

  decrypt(encryptedValue: string): string {
    const [version, ivHex, authTagHex, ciphertextHex, ...extra] = encryptedValue.split(':');
    if (
      version !== ENCRYPTION_VERSION ||
      !ivHex ||
      !authTagHex ||
      ciphertextHex === undefined ||
      extra.length > 0 ||
      !/^[0-9a-f]+$/i.test(ivHex) ||
      !/^[0-9a-f]+$/i.test(authTagHex) ||
      (ciphertextHex.length > 0 && !/^[0-9a-f]+$/i.test(ciphertextHex))
    ) {
      throw new InternalServerErrorException('Encrypted value has an unsupported or invalid format.');
    }

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    if (iv.length !== AES_GCM_IV_BYTES || authTag.length !== AES_GCM_TAG_BYTES) {
      throw new InternalServerErrorException('Encrypted value has invalid AES-GCM parameters.');
    }

    try {
      const decipher = createDecipheriv('aes-256-gcm', this.getKey(), iv);
      decipher.setAuthTag(authTag);
      return Buffer.concat([
        decipher.update(Buffer.from(ciphertextHex, 'hex')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new InternalServerErrorException('Encrypted value authentication failed.');
    }
  }

  encryptJson(value: unknown): string {
    return this.encrypt(JSON.stringify(value));
  }

  decryptJson<T>(encryptedValue: string): T {
    try {
      return JSON.parse(this.decrypt(encryptedValue)) as T;
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException('Encrypted JSON payload is invalid.');
    }
  }

  private getKey(): Buffer {
    const configuredKey = process.env.ENCRYPTION_KEY;
    if (!configuredKey || !/^[0-9a-f]{64}$/i.test(configuredKey)) {
      throw new InternalServerErrorException(
        'ENCRYPTION_KEY must be configured as exactly 64 hexadecimal characters.',
      );
    }
    return Buffer.from(configuredKey, 'hex');
  }
}
