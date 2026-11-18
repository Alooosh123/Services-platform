import { ConflictException, BadRequestException } from '@nestjs/common';
import { PaymentSenderIdentifierType, PaymentChannelCode } from '@digital-topup/shared';
import { EncryptionService } from '../../security/encryption.service';
import { PaymentSenderAccountsService } from './payment-sender-accounts.service';

describe('PaymentSenderAccountsService security and owner review', () => {
  const originalKey = process.env.ENCRYPTION_KEY;
  const encryption = new EncryptionService();
  let service: PaymentSenderAccountsService;
  let tx: any;
  let prisma: any;
  let linkedToAnotherUser = false;
  let existing: any = null;
  let persisted: any = null;
  let ownerReviewAccount: any = null;
  let configuredIdentifierType: PaymentSenderIdentifierType;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);
    linkedToAnotherUser = false;
    existing = null;
    persisted = null;
    ownerReviewAccount = null;
    configuredIdentifierType = PaymentSenderIdentifierType.PHONE;
    tx = {
      paymentSenderAccount: {
        findFirst: jest.fn(async ({ where }: any) => {
          if (where.id) {
            return ownerReviewAccount?.id === where.id ? ownerReviewAccount : null;
          }
          if (where.userId && typeof where.userId === 'object' && where.userId.not) {
            return linkedToAnotherUser ? { id: 'other-user-account' } : null;
          }
          return existing;
        }),
        findMany: jest.fn(async ({ where }: any) =>
          ownerReviewAccount?.status === where.status ? [ownerReviewAccount] : [],
        ),
        create: jest.fn(async ({ data }: any) => {
          persisted = { id: 'sender-account-1', ...data, status: data.status };
          return persisted;
        }),
        update: jest.fn(async ({ data }: any) => {
          persisted = { ...existing, ...data };
          return persisted;
        }),
        updateMany: jest.fn(async ({ where, data }: any) => {
          if (
            ownerReviewAccount &&
            ownerReviewAccount.id === where.id &&
            ownerReviewAccount.status === where.status
          ) {
            ownerReviewAccount = { ...ownerReviewAccount, ...data };
            return { count: 1 };
          }
          return { count: 0 };
        }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'owner-1' }]) },
      notification: {
        create: jest.fn().mockResolvedValue({ id: 'notification-customer-1' }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    prisma = {
      paymentChannelConfig: {
        findFirst: jest.fn(async () => ({
          id: 'channel-1',
          senderIdentifierType: configuredIdentifierType,
          accountNumber: '7700001234',
          regulatoryApprovalReference: 'REG-001',
          regulatoryApprovalDocumentUrl: 'https://example.test/regulatory.pdf',
          providerAgreementReference: 'AGR-001',
          providerAgreementDocumentUrl: 'https://example.test/agreement.pdf',
        })),
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

  const pendingReviewAccount = () => ({
    id: 'sender-account-review-1',
    tenantId: null,
    userId: 'customer-1',
    channelCode: PaymentChannelCode.JAIB,
    identifierType: PaymentSenderIdentifierType.PHONE,
    identifierCiphertext: encryption.encrypt('967771234567'),
    identifierLookupHash: 'b'.repeat(64),
    maskedIdentifier: '•••• 4567',
    identifierLastFour: '4567',
    status: 'PENDING_VERIFICATION',
    consentGrantedAt: new Date('2026-11-10T08:00:00.000Z'),
    verifiedAt: null,
    reviewedAt: null,
    reviewedByUserId: null,
    reviewNotes: null,
    createdAt: new Date('2026-11-10T08:00:00.000Z'),
    user: {
      id: 'customer-1',
      fullName: 'Customer One',
      fullNameAr: 'عميل تجريبي',
      email: 'customer@example.test',
      phone: '+967771234567',
      isVerified: true,
      phoneVerifiedAt: new Date('2026-11-09T08:00:00.000Z'),
      createdAt: new Date('2026-11-01T08:00:00.000Z'),
    },
  });

  it('requires explicit consent and never returns or persists a plaintext identifier to the customer', async () => {
    await expect(service.saveForCustomer('customer-1', request({ consentAccepted: false })))
      .rejects.toBeInstanceOf(BadRequestException);

    const result = await service.saveForCustomer('customer-1', request());
    expect(result.maskedIdentifier).toBe('•••• 4567');
    expect(result.status).toBe('PENDING_VERIFICATION');
    expect(result.verifiedAt).toBeNull();
    expect(JSON.stringify(result)).not.toContain('771234567');
    expect(persisted.identifierCiphertext).not.toContain('771234567');
    expect(encryption.decrypt(persisted.identifierCiphertext)).toBe('967771234567');
    expect(persisted.identifierLookupHash).toMatch(/^[a-f0-9]{64}$/i);
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(tx.notification.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({
        userId: 'owner-1',
        type: 'PAYMENT_SENDER_ACCOUNT_REVIEW',
        status: 'UNREAD',
        channel: 'IN_APP',
      })],
    }));
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
    expect(result.status).toBe('PENDING_VERIFICATION');
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

  it('resubmits a rejected identifier for owner review instead of keeping it rejected', async () => {
    existing = {
      id: 'sender-account-1',
      identifierLookupHash: 'different-hash',
      status: 'REJECTED',
      verifiedAt: null,
      reviewedByUserId: 'owner-1',
      reviewedAt: new Date(),
      reviewNotes: 'رقم غير مطابق',
    };
    await service.saveForCustomer('customer-1', request());
    expect(persisted.status).toBe('PENDING_VERIFICATION');
    expect(persisted.reviewedByUserId).toBeNull();
    expect(persisted.reviewedAt).toBeNull();
    expect(persisted.reviewNotes).toBeNull();
  });

  it('preserves verification for an unchanged identifier that the owner already approved', async () => {
    const hash = require('crypto').createHmac('sha256', Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'))
      .update('payment-sender-account:v1:JAIB:967771234567', 'utf8').digest('hex');
    const verifiedAt = new Date('2026-11-10T09:00:00.000Z');
    existing = {
      id: 'sender-account-1',
      identifierLookupHash: hash,
      status: 'VERIFIED',
      verifiedAt,
      reviewedByUserId: 'owner-1',
      reviewedAt: verifiedAt,
      reviewNotes: 'تمت المطابقة',
    };
    await service.saveForCustomer('customer-1', request());
    expect(persisted.status).toBe('VERIFIED');
    expect(persisted.verifiedAt).toEqual(verifiedAt);
    expect(persisted.reviewedByUserId).toBe('owner-1');
  });

  it('shows pending owner-review requests with the decrypted identifier only in the owner queue', async () => {
    ownerReviewAccount = pendingReviewAccount();
    const result = await service.listPendingForOwner();
    expect(result).toHaveLength(1);
    expect(result[0].identifier).toBe('967771234567');
    expect(result[0].user.phone).toBe('+967771234567');
    expect(tx.paymentSenderAccount.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: null, status: 'PENDING_VERIFICATION' },
    }));
  });

  it('allows the owner to approve only a pending sender account and records the reviewer', async () => {
    ownerReviewAccount = pendingReviewAccount();
    const result = await service.approveForOwner(ownerReviewAccount.id, 'owner-1', 'تم التحقق من الرقم');
    expect(result.status).toBe('VERIFIED');
    expect(result.verifiedAt).toBeInstanceOf(Date);
    expect(result.reviewedByUserId).toBe('owner-1');
    expect(result.reviewNotes).toBe('تم التحقق من الرقم');
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'PAYMENT_SENDER_ACCOUNT_APPROVED' }),
    }));
    expect(tx.notification.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: 'customer-1',
        type: 'PAYMENT_SENDER_ACCOUNT_APPROVED',
        status: 'UNREAD',
        channel: 'IN_APP',
      }),
    }));
  });

  it('rejects a pending sender account only with a reason and records the decision', async () => {
    ownerReviewAccount = pendingReviewAccount();
    await expect(service.rejectForOwner(ownerReviewAccount.id, 'owner-1', '  '))
      .rejects.toBeInstanceOf(BadRequestException);

    const result = await service.rejectForOwner(ownerReviewAccount.id, 'owner-1', 'الرقم لا يطابق بيانات المحفظة');
    expect(result.status).toBe('REJECTED');
    expect(result.reviewedByUserId).toBe('owner-1');
    expect(result.reviewNotes).toBe('الرقم لا يطابق بيانات المحفظة');
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'PAYMENT_SENDER_ACCOUNT_REJECTED' }),
    }));
    expect(tx.notification.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: 'customer-1',
        type: 'PAYMENT_SENDER_ACCOUNT_REJECTED',
        message: expect.stringContaining('الرقم لا يطابق بيانات المحفظة'),
      }),
    }));
  });

  it('prevents a second owner action after the request has already been reviewed', async () => {
    ownerReviewAccount = pendingReviewAccount();
    ownerReviewAccount.status = 'VERIFIED';
    await expect(service.approveForOwner(ownerReviewAccount.id, 'owner-2'))
      .rejects.toBeInstanceOf(ConflictException);
  });
});
