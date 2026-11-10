import { BadRequestException } from '@nestjs/common';
import { DepositsService } from './deposits.service';
import {
  ChannelVerificationStatus,
  PaymentChannelCode,
  PaymentChannelMode,
} from '@digital-topup/shared';

describe('DepositsService — payment channel activation controls', () => {
  const makeService = (config: any) => {
    const prisma: any = {
      paymentChannelConfig: {
        findFirst: jest.fn().mockResolvedValue(config),
        update: jest.fn().mockImplementation(({ data }: any) =>
          Promise.resolve({ ...config, ...data }),
        ),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };

    const service = new DepositsService(
      prisma,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    return { service, prisma };
  };

  it('persists the proposed legal account holder and customer instructions for finance review', async () => {
    const config = {
      id: 'jaib-config-1',
      tenantId: null,
      code: PaymentChannelCode.JAIB,
      accountNumber: 'NOT_CONFIGURED',
      accountHolderName: 'بانتظار اعتماد بيانات حساب الاستقبال',
      instructionsAr: 'قناة غير مفعلة.',
      pendingAccountNumber: null,
      pendingAccountHolderName: null,
      pendingInstructionsAr: null,
      pendingFeePercentage: null,
      financeApprovalRequired: false,
      verificationStatus: ChannelVerificationStatus.PENDING_REVIEW,
      mode: PaymentChannelMode.BLOCKED_EXTERNAL,
      isActive: false,
    };
    const { service, prisma } = makeService(config);

    await service.proposeChannelAccountChange(
      PaymentChannelCode.JAIB,
      '770123456',
      undefined,
      'owner-user-1',
      'OWNER',
      'الاسم القانوني المعتمد للمنشأة',
      'حوّل إلى حساب المنشأة المعتمد فقط.',
    );

    expect(prisma.paymentChannelConfig.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'jaib-config-1' },
        data: expect.objectContaining({
          pendingAccountNumber: '770123456',
          pendingAccountHolderName: 'الاسم القانوني المعتمد للمنشأة',
          pendingInstructionsAr: 'حوّل إلى حساب المنشأة المعتمد فقط.',
          financeApprovalRequired: true,
          verificationStatus: ChannelVerificationStatus.PENDING_REVIEW,
          isActive: false,
          mode: PaymentChannelMode.BLOCKED_EXTERNAL,
        }),
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it('refuses MANUAL activation when the account holder is still a placeholder', async () => {
    const config = {
      id: 'jaib-config-1',
      tenantId: null,
      code: PaymentChannelCode.JAIB,
      accountNumber: '770123456',
      accountHolderName: 'بانتظار اعتماد بيانات حساب الاستقبال',
      instructionsAr: 'تعليمات تحويل.',
      regulatoryApprovalReference: 'REG-REF-1',
      regulatoryApprovalDocumentUrl: 'https://docs.example.test/regulatory.pdf',
      providerAgreementReference: 'MERCHANT-REF-1',
      providerAgreementDocumentUrl: 'https://docs.example.test/merchant.pdf',
      verifiedAt: new Date(),
      verifiedByFinanceUserId: 'finance-user-1',
      verificationStatus: ChannelVerificationStatus.VERIFIED,
      mode: PaymentChannelMode.BLOCKED_EXTERNAL,
      isActive: false,
    };
    const { service } = makeService(config);

    await expect(
      service.switchChannelMode(
        PaymentChannelCode.JAIB,
        PaymentChannelMode.MANUAL,
        'independent-activator-2',
        'OWNER',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('refuses API mode until a contracted provider adapter and credentials are implemented', async () => {
    const { service, prisma } = makeService(null);

    await expect(
      service.switchChannelMode(
        PaymentChannelCode.JAIB,
        PaymentChannelMode.API,
        'owner-user-1',
        'OWNER',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.paymentChannelConfig.findFirst).not.toHaveBeenCalled();
  });
});
