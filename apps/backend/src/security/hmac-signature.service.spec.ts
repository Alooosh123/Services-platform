import { HmacSignatureService } from './hmac-signature.service';

describe('HmacSignatureService', () => {
  const service = new HmacSignatureService();
  const secret = 'test-secret-'.repeat(3);

  it('verifies timestamped payload signatures and rejects tampering', () => {
    const timestamp = 1_800_000_000;
    const body = Buffer.from('{"amount":100}');
    const signature = service.sign(body, secret, timestamp);

    expect(service.verify(body, signature, timestamp, secret, 300, timestamp)).toBe(true);
    expect(service.verify(Buffer.from('{"amount":101}'), signature, timestamp, secret, 300, timestamp)).toBe(false);
    expect(service.verify(body, signature, timestamp - 301, secret, 300, timestamp)).toBe(false);
  });

  it('rejects malformed signatures without throwing', () => {
    expect(service.verify('{}', 'not-a-signature', 1_800_000_000, secret, 300, 1_800_000_000)).toBe(false);
  });
});
