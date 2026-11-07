import { EncryptionService } from '../../security/encryption.service';
import { ProvidersService } from './providers.service';

describe('ProvidersService credential encryption', () => {
  const originalKey = process.env.ENCRYPTION_KEY;
  let prisma: any;
  let service: ProvidersService;
  let encryption: EncryptionService;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = 'b'.repeat(64);
    encryption = new EncryptionService();
    prisma = {
      provider: {
        findUnique: jest.fn().mockResolvedValue({ id: 'provider-1', apiKey: null }),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: 'provider-1', ...data }),
        ),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-provider-update-1' }),
      },
    };
    prisma.$transaction = jest.fn((callback: (tx: any) => Promise<any>) => callback(prisma));
    service = new ProvidersService(
      prisma,
      {} as any,
      {} as any,
      {} as any,
      encryption,
    );
  });

  afterAll(() => {
    if (originalKey === undefined) {
      delete process.env.ENCRYPTION_KEY;
    } else {
      process.env.ENCRYPTION_KEY = originalKey;
    }
  });

  it('stores provider API credentials encrypted and never returns the ciphertext', async () => {
    const result = await service.updateProvider('provider-1', { apiKey: 'provider-secret-key' } as any, 'owner-1');
    const persistedCiphertext = prisma.provider.update.mock.calls[0][0].data.credentialsCiphertext;

    expect(prisma.provider.update.mock.calls[0][0].data.apiKey).toBeNull();
    expect(encryption.decryptJson(persistedCiphertext)).toEqual({ apiKey: 'provider-secret-key' });
    expect(result.apiKey).toBe('********');
    expect(result.credentialsCiphertext).toBeUndefined();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'owner-1',
          action: 'PROVIDER_CONFIGURATION_UPDATED',
          entityId: 'provider-1',
          newValues: expect.objectContaining({ apiKeyChanged: true }),
        }),
      }),
    );
  });

  it('decrypts persisted provider credentials only for internal use', async () => {
    const ciphertext = encryption.encryptJson({ apiKey: 'provider-secret-key' });
    prisma.provider.findUnique.mockResolvedValue({
      apiKey: null,
      credentialsCiphertext: ciphertext,
    });

    await expect(service.getProviderCredentials('provider-1')).resolves.toEqual({
      apiKey: 'provider-secret-key',
    });
  });
});
