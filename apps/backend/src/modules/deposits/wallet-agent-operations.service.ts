import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { getCurrentTenantId } from '../../tenant/tenant-context.store';
import {
  UserRole,
  DepositStatus,
  CurrencyCode,
  PaymentChannelMode,
  ChannelVerificationStatus,
} from '@digital-topup/shared';
import { LedgerService } from '../ledger/ledger.service';
import { EncryptionService } from '../../security/encryption.service';

export interface SubmitWalletAgentOperationDto {
  observedAmount: number;
  observedCurrency: string;
  observedReferenceNumber: string;
  observedAccountLastFour: string;
  observedSenderIdentifier?: string;
  evidenceReference: string;
  agentNotes?: string;
}

@Injectable()
export class WalletAgentOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
    private readonly encryptionService: EncryptionService,
  ) {}

  private get tenantId(): string | null {
    return getCurrentTenantId() || null;
  }

  private async assertAgent(agentUserId: string) {
    const agent = await this.prisma.user.findFirst({
      where: { id: agentUserId, role: UserRole.PAYMENT_AGENT, isActive: true },
      select: { id: true, role: true, tenantId: true },
    });
    if (!agent) throw new ForbiddenException('حساب الوكيل غير مفعل أو لا يحمل دور وكيل المحافظ.');
    if (this.tenantId && agent.tenantId !== this.tenantId) {
      throw new ForbiddenException('لا يمكن لوكيل العمل على مهام متجر آخر.');
    }
    return agent;
  }

  async getMyQueue(agentUserId: string) {
    await this.assertAgent(agentUserId);
    const rows = await this.prisma.walletAgentOperation.findMany({
      where: {
        OR: [
          { status: 'PENDING' },
          { agentUserId, status: { in: ['CLAIMED', 'AGENT_SUBMITTED', 'NEEDS_REVIEW'] } },
        ],
      },
      include: {
        depositRequest: {
          select: {
            depositNumber: true,
            referenceNumber: true,
            amount: true,
            currency: true,
            senderName: true,
            senderPhone: true,
            senderAccount: {
              select: {
                id: true,
                identifierType: true,
                identifierCiphertext: true,
                maskedIdentifier: true,
                identifierLastFour: true,
                status: true,
              },
            },
          },
        },
        payoutRequest: {
          select: {
            payoutNumber: true,
            status: true,
            destinationAccount: true,
            beneficiaryName: true,
            amount: true,
            currency: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    const eligibleRows = rows.filter((row) =>
      row.status !== 'PENDING' ||
      row.direction !== 'OUTBOUND_PAYOUT' ||
      row.payoutRequest?.status === 'APPROVED',
    );
    return eligibleRows.map((row) => ({
      ...row,
      expectedAmount: Number(row.expectedAmount),
      observedAmount: row.observedAmount === null ? null : Number(row.observedAmount),
      payoutRequest: row.payoutRequest
        ? {
            ...row.payoutRequest,
            destinationAccountMasked: '•••• ' + String(row.payoutRequest.destinationAccount || '').slice(-4),
            destinationAccount: undefined,
            amount: Number(row.payoutRequest.amount),
          }
        : null,
      depositRequest: row.depositRequest
        ? {
            ...row.depositRequest,
            amount: Number(row.depositRequest.amount),
            senderAccount: row.depositRequest.senderAccount
              ? {
                  id: row.depositRequest.senderAccount.id,
                  identifierType: row.depositRequest.senderAccount.identifierType,
                  maskedIdentifier: row.depositRequest.senderAccount.maskedIdentifier,
                  status: row.depositRequest.senderAccount.status,
                  identifier:
                    row.agentUserId === agentUserId && row.status === 'CLAIMED'
                      ? this.encryptionService.decrypt(row.depositRequest.senderAccount.identifierCiphertext)
                      : null,
                }
              : null,
          }
        : null,
    }));
  }

  async claim(operationId: string, agentUserId: string) {
    await this.assertAgent(agentUserId);
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.walletAgentOperation.findFirst({
        where: { id: operationId, tenantId: this.tenantId, status: 'PENDING', agentUserId: null },
      });
      if (!current) throw new ConflictException('المهمة ليست متاحة أو سبق أن استلمها وكيل آخر.');

      if (current.direction === 'INBOUND_DEPOSIT' && current.customerUserId === agentUserId) {
        throw new ForbiddenException('لا يجوز للعميل تنفيذ التحقق من إيداعه بصفته وكيلاً.');
      }

      if (current.direction === 'OUTBOUND_PAYOUT') {
        const payout = current.payoutRequestId
          ? await tx.payoutRequest.findUnique({ where: { id: current.payoutRequestId } })
          : null;
        if (!payout || payout.status !== 'APPROVED') {
          throw new ForbiddenException('لا يجوز للوكيل تنفيذ سحب قبل اعتماد طلبه من موظف المالية.');
        }
        if (payout.approvedByUserId === agentUserId) {
          throw new ForbiddenException('من اعتمد طلب السحب لا يجوز أن ينفذ التحويل بصفة وكيل.');
        }
      }

      const changed = await tx.walletAgentOperation.updateMany({
        where: { id: operationId, tenantId: this.tenantId, status: 'PENDING', agentUserId: null },
        data: { status: 'CLAIMED', agentUserId, claimedAt: new Date() },
      });
      if (changed.count !== 1) throw new ConflictException('تم استلام المهمة بواسطة وكيل آخر بالتزامن.');

      const operation = await tx.walletAgentOperation.findFirst({
        where: { id: operationId, agentUserId, status: 'CLAIMED' },
      });
      if (!operation) throw new NotFoundException('تعذر العثور على المهمة بعد استلامها.');
      await tx.auditLog.create({
        data: {
          userId: agentUserId,
          action: 'WALLET_AGENT_OPERATION_CLAIMED',
          entityName: 'WalletAgentOperation',
          entityId: operationId,
          newValues: { direction: operation.direction, channelCode: operation.channelCode },
        },
      });
      return operation;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async submitVerification(
    operationId: string,
    agentUserId: string,
    dto: SubmitWalletAgentOperationDto,
  ) {
    await this.assertAgent(agentUserId);
    if (!Number.isFinite(dto.observedAmount) || dto.observedAmount <= 0) {
      throw new BadRequestException('المبلغ المرصود في محفظة الوكيل غير صالح.');
    }
    if (!dto.observedReferenceNumber?.trim() || dto.observedReferenceNumber.trim().length < 5) {
      throw new BadRequestException('رقم الحركة الظاهر في سجل المحفظة مطلوب.');
    }
    if (!/^[0-9]{4}$/.test(dto.observedAccountLastFour || '')) {
      throw new BadRequestException('أدخل آخر أربعة أرقام من حساب الاستقبال كما تظهر في سجل الحركة.');
    }
    if (!dto.evidenceReference?.trim() || dto.evidenceReference.trim().length < 5) {
      throw new BadRequestException('مرجع إثبات الحركة من كشف/سجل المحفظة الرسمي مطلوب.');
    }

    return this.prisma.$transaction(async (tx) => {
      const operation = await tx.walletAgentOperation.findFirst({
        where: { id: operationId, agentUserId, status: 'CLAIMED', tenantId: this.tenantId },
      });
      if (!operation) throw new NotFoundException('المهمة غير مسندة إليك أو تمت معالجتها مسبقاً.');

      if (operation.direction === 'INBOUND_DEPOSIT' && operation.customerUserId === agentUserId) {
        throw new ForbiddenException('لا يمكن للوكيل مطابقة إيداع يخص حسابه الشخصي.');
      }

      const deposit = operation.direction === 'INBOUND_DEPOSIT' && operation.depositRequestId
        ? await tx.depositRequest.findUnique({
            where: { id: operation.depositRequestId },
            include: { senderAccount: true },
          })
        : null;

      const channelConfig = deposit
        ? await tx.paymentChannelConfig.findFirst({
            where: {
              tenantId: this.tenantId,
              code: operation.channelCode,
              isActive: true,
              mode: PaymentChannelMode.MANUAL,
              verificationStatus: ChannelVerificationStatus.VERIFIED,
            },
          })
        : null;

      const amountMatches = new Prisma.Decimal(dto.observedAmount).equals(operation.expectedAmount);
      const currencyMatches = dto.observedCurrency === operation.expectedCurrency;
      const receiverAccountMatches = dto.observedAccountLastFour === operation.expectedAccountLastFour;
      const referenceMatches =
        !operation.expectedReferenceNumber ||
        dto.observedReferenceNumber.trim() === operation.expectedReferenceNumber;

      let senderIdentityMatches = false;
      let senderLastFour: string | null = null;
      if (deposit?.senderAccount && dto.observedSenderIdentifier) {
        const expectedIdentifier = this.encryptionService.decrypt(
          deposit.senderAccount.identifierCiphertext,
        );
        const normalize = (value: string, type: string) => {
          if (type === 'PHONE') return value.replace(/[^0-9]/g, '');
          return value.trim().replace(/\\s+/g, '').toUpperCase();
        };
        const expectedNormalized = normalize(
          expectedIdentifier,
          deposit.senderAccount.identifierType,
        );
        const observedNormalized = normalize(
          dto.observedSenderIdentifier,
          deposit.senderAccount.identifierType,
        );
        senderIdentityMatches =
          !!expectedNormalized && observedNormalized === expectedNormalized;
        senderLastFour = observedNormalized.slice(-4);
      }

      const channelReady = !!channelConfig &&
        !!channelConfig.accountNumber &&
        channelConfig.accountNumber !== 'NOT_CONFIGURED' &&
        !!channelConfig.regulatoryApprovalReference &&
        !!channelConfig.regulatoryApprovalDocumentUrl &&
        !!channelConfig.providerAgreementReference &&
        !!channelConfig.providerAgreementDocumentUrl;
      const duplicateExternalReference = deposit
        ? await tx.depositRequest.findFirst({
            where: {
              paymentMethodCode: operation.channelCode,
              referenceNumber: dto.observedReferenceNumber.trim(),
              id: { not: deposit.id },
            },
            select: { id: true },
          })
        : null;
      const referenceUnique = !duplicateExternalReference;
      const isMatch = operation.direction === 'INBOUND_DEPOSIT'
        ? !!deposit &&
          !!deposit.senderAccountId &&
          ['PENDING_VERIFICATION', 'VERIFIED'].includes(deposit.senderAccount.status) &&
          !!operation.expectedSenderAccountLastFour &&
          senderIdentityMatches &&
          senderLastFour === operation.expectedSenderAccountLastFour &&
          channelReady &&
          amountMatches &&
          currencyMatches &&
          receiverAccountMatches &&
          referenceMatches &&
          referenceUnique &&
          !!dto.evidenceReference.trim()
        : amountMatches && currencyMatches && receiverAccountMatches && referenceMatches;

      const autoCreditLimitYER = Number(process.env.WALLET_AGENT_AUTO_CREDIT_MAX_AMOUNT_YER || 0);
      const autoCreditEnabled =
        process.env.ENABLE_AGENT_AUTO_CREDIT === 'true' &&
        operation.direction === 'INBOUND_DEPOSIT' &&
        deposit?.currency === CurrencyCode.YER &&
        Number.isFinite(autoCreditLimitYER) &&
        autoCreditLimitYER > 0 &&
        dto.observedAmount <= autoCreditLimitYER &&
        isMatch;

      await tx.walletAgentOperation.update({
        where: { id: operationId },
        data: {
          status: isMatch ? 'AGENT_SUBMITTED' : 'NEEDS_REVIEW',
          observedAmount: new Prisma.Decimal(dto.observedAmount),
          observedCurrency: dto.observedCurrency as any,
          observedReferenceNumber: dto.observedReferenceNumber.trim(),
          observedAccountLastFour: dto.observedAccountLastFour,
          observedSenderAccountLastFour: senderLastFour,
          evidenceReference: dto.evidenceReference.trim(),
          agentNotes: dto.agentNotes?.trim() || null,
          submittedAt: new Date(),
        },
      });

      if (deposit) {
        if (autoCreditEnabled) {
          if (
            deposit.status !== DepositStatus.PENDING &&
            deposit.status !== DepositStatus.UNDER_REVIEW
          ) {
            throw new ConflictException('حالة الإيداع لا تسمح بالقيد الآلي أو سبق ترحيله.');
          }

          const claimed = await tx.depositRequest.updateMany({
            where: {
              id: deposit.id,
              status: deposit.status,
              settlementStatus: { not: 'POSTED' },
            },
            data: {
              status: DepositStatus.APPROVED,
              verificationStatus: 'VERIFIED',
              settlementStatus: 'PENDING_LEDGER',
              referenceNumber: dto.observedReferenceNumber.trim(),
              reviewNotes: 'مطابقة الوكيل للحركة الواردة في سجل الحساب الرسمي؛ القيد الآلي مفعل وفق سياسة القناة.',
            },
          });
          if (claimed.count !== 1) {
            throw new ConflictException('تمت معالجة الإيداع بالتزامن؛ لم يتم إنشاء قيد جديد.');
          }

          await tx.depositStatusHistory.create({
            data: {
              depositRequestId: deposit.id,
              fromStatus: deposit.status,
              toStatus: DepositStatus.APPROVED,
              changedByUserId: agentUserId,
              notes: 'مطابقة مكتملة من الوكيل: هوية المرسل وحساب الاستقبال والمبلغ والعملة والمرجع الفريد.',
            },
          });

          const ledgerResult = await this.ledgerService.recordTopup({
            userId: deposit.userId,
            walletId: deposit.walletId,
            currency: deposit.currency as CurrencyCode,
            amount: Number(deposit.amount),
            paymentChannel: deposit.paymentMethodCode,
            referenceId: deposit.id,
            performedByUserId: agentUserId,
            notes: `Agent auto-credit; evidence ${dto.evidenceReference.trim()}; external ref ${dto.observedReferenceNumber.trim()}`,
          }, tx);

          await tx.depositRequest.update({
            where: { id: deposit.id },
            data: {
              status: DepositStatus.CREDITED,
              verificationStatus: 'VERIFIED',
              settlementStatus: 'POSTED',
              ledgerTxId: ledgerResult.transaction.id,
              reviewNotes: 'تمت المطابقة والقيد المزدوج بواسطة وكيل المحافظ وفق سياسة القيد الآلي.',
              statusHistory: {
                create: {
                  fromStatus: DepositStatus.APPROVED,
                  toStatus: DepositStatus.CREDITED,
                  changedByUserId: agentUserId,
                  notes: `تم ترحيل القيد ${ledgerResult.transaction.txNumber || ledgerResult.transaction.id}`,
                },
              },
            },
          });

          await tx.paymentSenderAccount.update({
            where: { id: deposit.senderAccountId! },
            data: { status: 'VERIFIED', verifiedAt: new Date() },
          });

          await tx.walletAgentOperation.update({
            where: { id: operationId },
            data: {
              status: 'POSTED',
              ledgerTxId: ledgerResult.transaction.id,
              postedAt: new Date(),
            },
          });

          await tx.auditLog.create({
            data: {
              userId: agentUserId,
              action: 'WALLET_AGENT_AUTOCREDIT_POSTED',
              entityName: 'DepositRequest',
              entityId: deposit.id,
              newValues: {
                channelCode: operation.channelCode,
                amount: dto.observedAmount,
                currency: dto.observedCurrency,
                externalReference: dto.observedReferenceNumber.trim(),
                senderAccountLastFour: senderLastFour,
                receiverAccountLastFour: dto.observedAccountLastFour,
                evidenceReference: dto.evidenceReference.trim(),
                ledgerTxId: ledgerResult.transaction.id,
              },
            },
          });

          return {
            success: true,
            status: 'POSTED',
            exactMatch: true,
            autoCredited: true,
            requiresFinanceReview: false,
            ledgerTransaction: ledgerResult.transaction,
            message: 'اكتملت المطابقة مع سجل الحساب الرسمي، ورُحّل القيد المزدوج وأضيف الرصيد إلى محفظة العميل تلقائياً.',
          };
        }

        await tx.depositRequest.update({
          where: { id: deposit.id },
          data: {
            referenceNumber: referenceUnique && isMatch
              ? dto.observedReferenceNumber.trim()
              : deposit.referenceNumber,
            verificationStatus: isMatch ? 'AGENT_SUBMITTED' : 'NEEDS_REVIEW',
            ...(deposit.status === DepositStatus.PENDING ? { status: DepositStatus.UNDER_REVIEW } : {}),
            ...(deposit.status === DepositStatus.PENDING ? {
              statusHistory: {
                create: {
                  fromStatus: DepositStatus.PENDING,
                  toStatus: DepositStatus.UNDER_REVIEW,
                  changedByUserId: agentUserId,
                  notes: isMatch
                    ? 'سجل الوكيل الحركة؛ تنتظر المراجعة المالية لأن القيد الآلي غير مفعل أو تجاوزت الحركة السقف.'
                    : 'رصد الوكيل اختلافاً أو تعذر التحقق من هوية المرسل؛ عُزل الإيداع للمراجعة.',
                },
              },
            } : {}),
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: agentUserId,
          action: isMatch ? 'WALLET_AGENT_OPERATION_SUBMITTED' : 'WALLET_AGENT_OPERATION_DISCREPANCY',
          entityName: 'WalletAgentOperation',
          entityId: operationId,
          newValues: {
            direction: operation.direction,
            channelCode: operation.channelCode,
            observedAmount: dto.observedAmount,
            observedCurrency: dto.observedCurrency,
            observedReferenceNumber: dto.observedReferenceNumber.trim(),
            observedAccountLastFour: dto.observedAccountLastFour,
            observedSenderAccountLastFour: senderLastFour,
            amountMatches,
            currencyMatches,
            receiverAccountMatches,
            senderIdentityMatches,
            referenceMatches,
            referenceUnique,
            channelReady,
            evidenceReference: dto.evidenceReference.trim(),
            autoCreditEligible: autoCreditEnabled,
          },
        },
      });

      return {
        success: true,
        status: isMatch ? 'AGENT_SUBMITTED' : 'NEEDS_REVIEW',
        exactMatch: isMatch,
        autoCredited: false,
        requiresFinanceReview: true,
        message: isMatch
          ? 'المطابقة صحيحة، لكن القيد الآلي متوقف أو تجاوزت الحركة سقف التشغيل؛ تنتظر اعتماد المالية.'
          : 'لم تتطابق عناصر التحويل أو تعذر التحقق من المصدر؛ عُزلت الحركة للمراجعة ولا يضاف أي رصيد.',
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
