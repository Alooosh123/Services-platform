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
import { UserRole } from '@digital-topup/shared';

export interface SubmitWalletAgentOperationDto {
  observedAmount: number;
  observedCurrency: string;
  observedReferenceNumber: string;
  observedAccountLastFour: string;
  evidenceReference: string;
  agentNotes?: string;
}

@Injectable()
export class WalletAgentOperationsService {
  constructor(private readonly prisma: PrismaService) {}

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
        ? { ...row.depositRequest, amount: Number(row.depositRequest.amount) }
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
      throw new BadRequestException('أدخل آخر أربعة أرقام من حساب الطرف المقابل بعد التحقق منه.');
    }
    if (!dto.evidenceReference?.trim() || dto.evidenceReference.trim().length < 5) {
      throw new BadRequestException('مرجع إثبات الحركة من كشف/سجل المحفظة مطلوب.');
    }

    return this.prisma.$transaction(async (tx) => {
      const operation = await tx.walletAgentOperation.findFirst({
        where: { id: operationId, agentUserId, status: 'CLAIMED' },
      });
      if (!operation) throw new NotFoundException('المهمة غير مسندة إليك أو تمت معالجتها مسبقاً.');

      const amountMatches = new Prisma.Decimal(dto.observedAmount).equals(operation.expectedAmount);
      const currencyMatches = dto.observedCurrency === operation.expectedCurrency;
      const accountMatches = dto.observedAccountLastFour === operation.expectedAccountLastFour;
      const referenceMatches =
        operation.direction !== 'INBOUND_DEPOSIT' ||
        dto.observedReferenceNumber.trim() === operation.expectedReferenceNumber;
      const isMatch = amountMatches && currencyMatches && accountMatches && referenceMatches;

      const updated = await tx.walletAgentOperation.update({
        where: { id: operationId },
        data: {
          status: isMatch ? 'AGENT_SUBMITTED' : 'NEEDS_REVIEW',
          observedAmount: new Prisma.Decimal(dto.observedAmount),
          observedCurrency: dto.observedCurrency as any,
          observedReferenceNumber: dto.observedReferenceNumber.trim(),
          observedAccountLastFour: dto.observedAccountLastFour,
          evidenceReference: dto.evidenceReference.trim(),
          agentNotes: dto.agentNotes?.trim() || null,
          submittedAt: new Date(),
        },
      });
      if (operation.direction === 'INBOUND_DEPOSIT' && operation.depositRequestId) {
        const deposit = await tx.depositRequest.findUnique({
          where: { id: operation.depositRequestId },
          select: { id: true, status: true },
        });
        if (!deposit) throw new NotFoundException('طلب الإيداع المرتبط بمهمة الوكيل غير موجود.');
        await tx.depositRequest.update({
          where: { id: deposit.id },
          data: {
            verificationStatus: isMatch ? 'AGENT_SUBMITTED' : 'NEEDS_REVIEW',
            ...(deposit.status === 'PENDING' ? { status: 'UNDER_REVIEW' } : {}),
            ...(deposit.status === 'PENDING' ? {
              statusHistory: {
                create: {
                  fromStatus: 'PENDING',
                  toStatus: 'UNDER_REVIEW',
                  changedByUserId: agentUserId,
                  notes: isMatch
                    ? 'سجل وكيل المحفظة تفاصيل الحركة؛ تنتظر مراجعة المالية المستقلة.'
                    : 'رصد وكيل المحفظة اختلافاً؛ عُزل الإيداع للمراجعة المالية.',
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
            amountMatches,
            currencyMatches,
            accountMatches,
            referenceMatches,
            evidenceReference: dto.evidenceReference.trim(),
          },
        },
      });
      return {
        success: true,
        status: updated.status,
        requiresFinanceReview: true,
        exactMatch: isMatch,
        message: isMatch
          ? 'سُجل تحقق الوكيل. لم يتغير أي رصيد بعد؛ ينتظر القيد اعتماد موظف المالية.'
          : 'يوجد اختلاف في المبلغ أو العملة أو الحساب أو المرجع؛ عُزلت الحركة للمراجعة ولا يمكن قيدها.',
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
