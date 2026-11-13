import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  ChannelVerificationStatus,
  CurrencyCode,
  PaymentChannelCode,
  PaymentChannelMode,
} from '@digital-topup/shared';
import { DepositsService } from './deposits.service';

describe('Durable payment channel administration and four-eyes review', () => {
  const channel = {
    id: 'channel-jaib',
    code: PaymentChannelCode.JAIB,
    name: 'Jaib Wallet',
    nameAr: 'محفظة جيب',
    accountNumber: 'NOT_CONFIGURED',
    accountHolderName: 'غير مهيأ',
    instructionsAr: 'قناة غير مفعلة.',
    supportedCurrencies: ['YER'],
    minAmount: '500',
    maxAmount: '2000000',
    feePercentage: '0',
    mode: PaymentChannelMode.MANUAL,
    verificationStatus: ChannelVerificationStatus.PENDING_REVIEW,
    financeApprovalRequired: true,
    pendingAccountNumber: '770000111',
    pendingInstructionsAr: null,
    pendingFeePercentage: null,
    pendingProposedByUserId: 'requester-1',
    pendingProposedAt: new Date(),
    pendingChangeReason: 'تحديث مستند حساب الاستقبال المعتمد.',
    isActive: false,
  };

  const tx = {
    paymentChannelConfig: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([channel]),
      create: jest.fn(),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...channel, ...data })),
    },
    auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
  };
  const prisma = {
    paymentChannelConfig: { findMany: jest.fn().mockResolvedValue([channel]) },
    $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
  };
  const dependencies = {
    ledgerService: {} as any,
    walletService: {} as any,
    adapterRegistry: {} as any,
    hmacSignatureService: {} as any,
  };
  const service = new DepositsService(prisma as any, dependencies.ledgerService, dependencies.walletService,
    dependencies.adapterRegistry, dependencies.hmacSignatureService);

  beforeEach(() => {
    jest.clearAllMocks();
    tx.paymentChannelConfig.findUnique.mockResolvedValue(channel);
    tx.paymentChannelConfig.update.mockImplementation(({ data }) => Promise.resolve({ ...channel, ...data }));
    tx.auditLog.create.mockResolvedValue({ id: 'audit-1' });
  });

  it('keeps newly created channel disabled and stores receiver details only as pending', async () => {
    tx.paymentChannelConfig.findUnique.mockResolvedValueOnce(null);
    tx.paymentChannelConfig.create.mockImplementation(({ data }) => Promise.resolve({ ...channel, ...data }));
    const result = await service.createDynamicChannel({
      code: PaymentChannelCode.JAIB,
      name: 'Jaib',
      nameAr: 'جيب',
      accountNumber: '770001234',
      accountHolderName: 'Business Receiver',
      instructionsAr: 'حوّل المبلغ وأدخل الرقم المرجعي.',
      supportedCurrencies: [CurrencyCode.YER],
      minAmount: 500,
      maxAmount: 2000000,
    }, 'requester-1');
    expect(result.channel.isActive).toBe(false);
    expect(tx.paymentChannelConfig.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        accountNumber: 'NOT_CONFIGURED',
        pendingAccountNumber: '770001234',
        pendingProposedByUserId: 'requester-1',
        verificationStatus: ChannelVerificationStatus.PENDING_REVIEW,
        financeApprovalRequired: true,
        isActive: false,
      }),
    }));
  });

  it('hides the channel immediately when receiver details are proposed', async () => {
    const result = await service.proposeChannelAccountChange(
      PaymentChannelCode.JAIB, '770009999', 1.5, 'requester-2', 'تغيير رقم الاستقبال بعد تحديث مستند البنك.',
    );
    expect(result.channel.isActive).toBe(false);
    expect(tx.paymentChannelConfig.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        pendingAccountNumber: '770009999',
        pendingProposedByUserId: 'requester-2',
        verificationStatus: ChannelVerificationStatus.PENDING_REVIEW,
        financeApprovalRequired: true,
        isActive: false,
      }),
    }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'PAYMENT_CHANNEL_CHANGE_PROPOSED' }),
    }));
  });

  it('rejects self-approval before changing persistent channel state', async () => {
    await expect(service.approveChannelFinanceReview('requester-1', PaymentChannelCode.JAIB, {
      approved: true,
      financeNotes: 'تمت مطابقة مستند الاستقبال.',
    })).rejects.toThrow(ConflictException);
    expect(tx.paymentChannelConfig.update).not.toHaveBeenCalled();
  });

  it('approves independently but keeps the channel MANUAL', async () => {
    const result = await service.approveChannelFinanceReview('finance-2', PaymentChannelCode.JAIB, {
      approved: true,
      financeNotes: 'تمت مطابقة اسم المستفيد ورقم الحساب مع مستند البنك.',
    });
    expect(result.channel.accountNumber).toBe('770000111');
    expect(result.channel.mode).toBe(PaymentChannelMode.MANUAL);
    expect(result.channel.isActive).toBe(true);
    expect(tx.paymentChannelConfig.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        verificationStatus: ChannelVerificationStatus.VERIFIED,
        financeApprovalRequired: false,
        verifiedByFinanceUserId: 'finance-2',
        mode: PaymentChannelMode.MANUAL,
        isActive: true,
      }),
    }));
  });

  it('rejects API mode even when called outside the controller', async () => {
    await expect(service.switchChannelMode(PaymentChannelCode.JAIB, PaymentChannelMode.API, 'owner-1'))
      .rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('persists a kill switch and an audit record', async () => {
    const result = await service.triggerChannelKillSwitch('owner-1', PaymentChannelCode.JAIB, 'اشتباه في مستند حساب الاستقبال.');
    expect(result.channel.isActive).toBe(false);
    expect(result.channel.mode).toBe(PaymentChannelMode.DISABLED);
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'PAYMENT_CHANNEL_KILL_SWITCH' }),
    }));
  });

  it('reports channels as unverified until independently activated', async () => {
    const result = await service.verifyLegalAccounts();
    expect(result.isValid).toBe(false);
    expect(result.unverified).toContain(PaymentChannelCode.JAIB);
  });
});
