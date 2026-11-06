import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  ChannelVerificationStatus,
  CurrencyCode,
  PaymentChannelCode,
  PaymentChannelMode,
} from '@digital-topup/shared';
import { DepositsService } from './deposits.service';
import { runWithTenantContext } from '../../tenant/tenant-context.store';

describe('DepositsService tenant-owned payment channel configuration', () => {
  let service: DepositsService;
  let prisma: any;
  let currentConfig: any;

  beforeEach(() => {
    currentConfig = {
      id: 'channel-config-1',
      tenantId: 'tenant-alpha',
      code: PaymentChannelCode.JAIB,
      name: 'Jaib',
      nameAr: 'جيب',
      accountNumber: 'NOT_CONFIGURED',
      accountHolderName: 'Pending approval',
      instructionsAr: 'Pending approval',
      supportedCurrencies: [CurrencyCode.YER],
      minAmount: 500,
      maxAmount: 200000,
      mode: PaymentChannelMode.BLOCKED_EXTERNAL,
      verificationStatus: ChannelVerificationStatus.PENDING_REVIEW,
      financeApprovalRequired: true,
      proposedByUserId: 'maker-user',
      pendingAccountNumber: '770000111',
      pendingAccountHolderName: 'Store Owner',
      pendingInstructionsAr: 'Transfer to store',
      pendingFeePercentage: null,
      isActive: false,
    };

    prisma = {
      paymentChannelConfig: {
        findFirst: jest.fn().mockImplementation(async () => currentConfig),
        findMany: jest.fn().mockResolvedValue([currentConfig]),
        create: jest.fn().mockImplementation(async ({ data }: any) => {
          currentConfig = { id: 'channel-config-1', tenantId: 'tenant-alpha', ...data };
          return currentConfig;
        }),
        update: jest.fn().mockImplementation(async ({ data }: any) => {
          currentConfig = { ...currentConfig, ...data };
          return currentConfig;
        }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
      $transaction: jest.fn(async (callback: any) => callback(prisma)),
    };

    service = new DepositsService(
      prisma,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  it('creates a new channel blocked and pending finance approval', async () => {
    await runWithTenantContext('tenant-alpha', async () => {
      prisma.paymentChannelConfig.findFirst.mockResolvedValueOnce(null);
      const created = await service.createDynamicChannel({
        code: PaymentChannelCode.JAIB,
        name: 'Jaib',
        nameAr: 'جيب',
        accountNumber: '770000111',
        accountHolderName: 'Store Owner',
        instructionsAr: 'Transfer to store',
        supportedCurrencies: [CurrencyCode.YER],
        minAmount: 500,
        maxAmount: 200000,
      }, 'maker-user', 'OWNER');

      expect(prisma.paymentChannelConfig.findFirst).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-alpha', code: PaymentChannelCode.JAIB },
      });
      expect(created.isActive).toBe(false);
      expect(created.mode).toBe(PaymentChannelMode.BLOCKED_EXTERNAL);
      expect(created.verificationStatus).toBe(ChannelVerificationStatus.PENDING_REVIEW);
      expect(created.financeApprovalRequired).toBe(true);
      expect(created.proposedByUserId).toBe('maker-user');
      expect(created.pendingAccountNumber).toBe('770000111');
    });
  });

  it('rejects enabling manual payments before the account has been verified', async () => {
    await runWithTenantContext('tenant-alpha', async () => {
      await expect(
        service.switchChannelMode(
          PaymentChannelCode.JAIB,
          PaymentChannelMode.MANUAL,
          'owner-user',
          'OWNER',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  it('rejects API mode until a contracted provider adapter is configured', async () => {
    await runWithTenantContext('tenant-alpha', async () => {
      await expect(
        service.switchChannelMode(
          PaymentChannelCode.JAIB,
          PaymentChannelMode.API,
          'platform-admin',
          'SUPER_ADMIN',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  it('keeps the current receiver account unchanged while a new account is proposed', async () => {
    currentConfig = {
      ...currentConfig,
      accountNumber: '770000001',
      verificationStatus: ChannelVerificationStatus.VERIFIED,
      isActive: true,
      mode: PaymentChannelMode.MANUAL,
      proposedByUserId: null,
    };

    await runWithTenantContext('tenant-alpha', async () => {
      const updated = await service.proposeChannelAccountChange(
        PaymentChannelCode.JAIB,
        '770000222',
        1.5,
        'maker-user',
        'OWNER',
      );

      expect(updated.accountNumber).toBe('770000001');
      expect(updated.pendingAccountNumber).toBe('770000222');
      expect(updated.proposedByUserId).toBe('maker-user');
      expect(updated.financeApprovalRequired).toBe(true);
      expect(updated.verificationStatus).toBe(ChannelVerificationStatus.PENDING_REVIEW);
      expect(updated.isActive).toBe(false);
      expect(updated.mode).toBe(PaymentChannelMode.BLOCKED_EXTERNAL);
    });
  });

  it('prevents the proposer from approving their own receiver-account change', async () => {
    await runWithTenantContext('tenant-alpha', async () => {
      await expect(
        service.approveChannelFinanceReview(
          'maker-user',
          'FINANCE_MANAGER',
          PaymentChannelCode.JAIB,
          { approved: true, financeNotes: 'Reviewed' },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  it('allows a separate finance approver, activates verification but keeps the channel disabled', async () => {
    await runWithTenantContext('tenant-alpha', async () => {
      const approved = await service.approveChannelFinanceReview(
        'finance-user',
        'FINANCE_MANAGER',
        PaymentChannelCode.JAIB,
        { approved: true, financeNotes: 'Receiver ownership checked' },
      );

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(approved.accountNumber).toBe('770000111');
      expect(approved.accountHolderName).toBe('Store Owner');
      expect(approved.verificationStatus).toBe(ChannelVerificationStatus.VERIFIED);
      expect(approved.financeApprovalRequired).toBe(false);
      expect(approved.proposedByUserId).toBeNull();
      expect(approved.isActive).toBe(false);
      expect(approved.mode).toBe(PaymentChannelMode.BLOCKED_EXTERNAL);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'finance-user',
            action: 'PAYMENT_CHANNEL_ACCOUNT_CHANGE_APPROVED',
          }),
        }),
      );
    });
  });

  it('reads channel configuration for the active tenant only', async () => {
    await runWithTenantContext('tenant-alpha', async () => {
      await service.getAllChannelsForAdmin();
      expect(prisma.paymentChannelConfig.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-alpha' },
        orderBy: { code: 'asc' },
      });
    });
  });

  it('rejects unsupported dynamically-created payment enum codes before persistence', async () => {
    await runWithTenantContext('tenant-alpha', async () => {
      await expect(service.createDynamicChannel({
        code: 'UNRECOGNIZED' as any,
        name: 'New channel',
        nameAr: 'قناة جديدة',
        accountNumber: '123',
        accountHolderName: 'Owner',
        instructionsAr: 'Instructions',
        supportedCurrencies: [CurrencyCode.YER],
        minAmount: 1,
        maxAmount: 100,
      }, 'maker-user', 'OWNER')).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.paymentChannelConfig.create).not.toHaveBeenCalled();
    });
  });
});
