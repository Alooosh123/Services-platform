import { ConflictException, BadRequestException } from '@nestjs/common';
import { PaymentSenderIdentifierType, PaymentChannelCode } from '@digital-topup/shared';
import { EncryptionService } from '../../security/encryption.service';
import { PaymentSenderAccountsService } from './payment-sender-accounts.service';

describe('PaymentSenderAccountsService security', () => {
  const originalKey = process.env.ENCRYPTION_KEY;
  const encryption = new EncryptionService();
  let service: PaymentSenderAccountsService;
  let tx: any;
  let linkedToAnotherUser = false;
  let existing: any = null;
  let persisted: any = null;
  let configuredIdentifierType: PaymentSenderIdentifierType;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);
    linkedToAnotherUser = false;
    existing = null;
    persisted = null;
    configuredIdentifierType = PaymentSenderIdentifierType.PHONE;
    tx = {
      paymentSenderAccount: {
        findFirst: jest.fn(async ({ where }: any) => {
          if (where.userId && typeof where.userId === 'object' && where.userId.not) {
            return linkedToAnotherUser ? { id: 'other-user-account' } : null;
          }
          return existing;
        }),
        create: jest.fn(async ({ data }: any) => {
          persisted = { id: 'sender-account-1', ...data, status: data.status };
          return persisted;
        }),
        update: jest.fn(async ({ data }: any) => {
          persisted = { ...existing, ...data };
          return persisted;
        }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    const prisma: any = {
      paymentChannelConfig: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'channel-1',
          senderIdentifierType: configuredIdentifierType,
          accountNumber: '7700001234',
          regulatoryApprovalReference: 'REG-001',
          regulatoryApprovalDocumentUrl: 'https://example.test/regulatory.pdf',
          providerAgreementReference: 'AGR-001',
          providerAgreementDocumentUrl: 'https://example.test/agreement.pdf',
        }),
      },
      paymentSenderAccount: tx.paymentSenderAccount,
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };
    service = new PaymentSenderAccountsService(prisma, encryption);
  });

  afterAll(() => {
    if (originalKey === undefined) delete process.env.ENCRYPTION_KEY;
    else process.env.ENCRYPTION_KEY = originalKey;
  });

  const request = (overrides: Partial<any> = {}) => ({
    channelCode: PaymentChannelCode.JAIB,
    identifierType: PaymentSenderIdentifierType.PHONE,
    identifier: '+967 771 234 567',
    consentAccepted: true,
    ...overrides,
  });

  it('requires explicit consent and never persists a plaintext identifier', async () => {
    await expect(service.saveForCustomer('customer-1', request({ consentAccepted: false })))
      .rejects.toBeInstanceOf(BadRequestException);

    const result = await service.saveForCustomer('customer-1', request());
    expect(result.maskedIdentifier).toBe('•••• 4567');
    expect(JSON.stringify(result)).not.toContain('771234567');
    expect(persisted.identifierCiphertext).not.toContain('771234567');
    expect(encryption.decrypt(persisted.identifierCiphertext)).toBe('967771234567');
    expect(persisted.identifierLookupHash).toMatch(/^[a-f0-9]{64}$/i);
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it('does not allow one sender identifier to be linked to another customer', async () => {
    linkedToAnotherUser = true;
    await expect(service.saveForCustomer('customer-2', request()))
      .rejects.toBeInstanceOf(ConflictException);
    expect(tx.paymentSenderAccount.create).not.toHaveBeenCalled();
  });

  it('stores a configured alias encrypted and returns only a masked value', async () => {
    configuredIdentifierType = PaymentSenderIdentifierType.ALIAS;
    const result = await service.saveForCustomer('customer-1', request({
      identifierType: PaymentSenderIdentifierType.ALIAS,
      identifier: 'JAIB-ALT-1234',
    }));
    expect(result.maskedIdentifier).toBe('•••• 1234');
    expect(persisted.identifierCiphertext).not.toContain('JAIB-ALT-1234');
    expect(encryption.decrypt(persisted.identifierCiphertext)).toBe('JAIB-ALT-1234');
  });

  it('stores a wallet ID encrypted and bound to the configured channel type', async () => {
    configuredIdentifierType = PaymentSenderIdentifierType.WALLET_ID;
    const result = await service.saveForCustomer('customer-1', request({
      identifierType: PaymentSenderIdentifierType.WALLET_ID,
      identifier: 'WID-ABC_123',
    }));
    expect(result.identifierType).toBe(PaymentSenderIdentifierType.WALLET_ID);
    expect(result.maskedIdentifier).toBe('•••• _123');
    expect(encryption.decrypt(persisted.identifierCiphertext)).toBe('WID-ABC_123');
  });

  it('stores an account number encrypted and normalized', async () => {
    configuredIdentifierType = PaymentSenderIdentifierType.ACCOUNT_NUMBER;
    const result = await service.saveForCustomer('customer-1', request({
      identifierType: PaymentSenderIdentifierType.ACCOUNT_NUMBER,
      identifier: 'ab-123456',
    }));
    expect(result.maskedIdentifier).toBe('•••• 3456');
    expect(encryption.decrypt(persisted.identifierCiphertext)).toBe('AB-123456');
  });

  it('rejects unsupported characters in a non-phone wallet identifier', async () => {
    configuredIdentifierType = PaymentSenderIdentifierType.ALIAS;
    await expect(service.saveForCustomer('customer-1', request({
      identifierType: PaymentSenderIdentifierType.ALIAS,
      identifier: '<script>alert(1)</script>',
    }))).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.paymentSenderAccount.create).not.toHaveBeenCalled();
  });

  it('requires the configured identifier type for the channel', async () => {
    await expect(service.saveForCustomer('customer-1', request({
      identifierType: PaymentSenderIdentifierType.ALIAS,
      identifier: 'ALIAS123',
    }))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('normalizes phone numbers before hashing and encryption', async () => {
    await service.saveForCustomer('customer-1', request());
    const firstHash = persisted.identifierLookupHash;

    persisted = null;
    existing = null;
    await service.saveForCustomer('customer-3', request({
      identifier: '967-771-234-567',
    }));
    expect(persisted.identifierLookupHash).toBe(firstHash);
  });
});
