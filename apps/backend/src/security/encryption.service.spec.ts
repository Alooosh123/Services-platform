import { EncryptionService } from './encryption.service';

describe('EncryptionService', () => {
  const originalKey = process.env.ENCRYPTION_KEY;
  let service: EncryptionService;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);
    service = new EncryptionService();
  });

  afterAll(() => {
    if (originalKey === undefined) {
      delete process.env.ENCRYPTION_KEY;
    } else {
      process.env.ENCRYPTION_KEY = originalKey;
    }
  });

  it('uses a random IV and decrypts each ciphertext to the original text', () => {
    const first = service.encrypt('stored-pin');
    const second = service.encrypt('stored-pin');

    expect(first).not.toBe(second);
    expect(service.decrypt(first)).toBe('stored-pin');
    expect(service.decrypt(second)).toBe('stored-pin');
  });

  it('authenticates ciphertext and supports JSON round trips', () => {
    const ciphertext = service.encryptJson({ apiKey: 'secret-value' });
    expect(service.decryptJson(ciphertext)).toEqual({ apiKey: 'secret-value' });

    const parts = ciphertext.split(':');
    parts[3] = `${parts[3]}00`;
    expect(() => service.decrypt(parts.join(':'))).toThrow();
  });
});
