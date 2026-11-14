import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { UserRole as SharedUserRole } from '@digital-topup/shared';
import {
  CloseoutOperationalApprovalDto,
  CreateOperationalApprovalDto,
  DecideOperationalApprovalDto,
} from './operational-approvals.dto';

const NETWORK_REQUEST_ROLES = [
  SharedUserRole.OWNER,
  SharedUserRole.GENERAL_MANAGER,
  SharedUserRole.ADMIN,
];
const FINANCE_REQUEST_ROLES = [
  SharedUserRole.OWNER,
  SharedUserRole.GENERAL_MANAGER,
  SharedUserRole.ADMIN,
  SharedUserRole.FINANCE_MANAGER,
  SharedUserRole.FINANCE,
];
const UNRESOLVED_RECONCILIATION_STATUSES = [
  'DISCREPANCY',
  'UNKNOWN_EXTERNAL',
  'UNKNOWN_INTERNAL',
  'PENDING_REVIEW',
];

@Injectable()
export class OperationalApprovalsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(requesterId: string, requesterRole: SharedUserRole, dto: CreateOperationalApprovalDto) {
    if (dto.approvalType === 'NETWORK_CHANGE') {
      if (!NETWORK_REQUEST_ROLES.includes(requesterRole)) {
        throw new ForbiddenException('Only authorized managers may request network changes.');
      }
      if (
        dto.targetType !== 'MIKROTIK_ROUTER' ||
        !['CHANGE_INTERFACE', 'CHANGE_FIREWALL', 'CHANGE_ROUTE', 'CHANGE_QOS', 'OTHER'].includes(dto.action)
      ) {
        throw new BadRequestException('Unsupported network change request.');
      }
    } else if (dto.approvalType === 'PAYMENT_CHANNEL_REACTIVATION') {
      if (!NETWORK_REQUEST_ROLES.includes(requesterRole)) {
        throw new ForbiddenException('Only authorized network/payment managers may request emergency channel reactivation.');
      }
      if (dto.targetType !== 'PAYMENT_CHANNEL_CONFIG' || !dto.targetId || dto.action !== 'RELEASE_KILL_SWITCH') {
        throw new BadRequestException('A channel reactivation approval must target one payment channel and use RELEASE_KILL_SWITCH.');
      }
      const channel = await this.prisma.paymentChannelConfig.findUnique({ where: { id: dto.targetId } });
      if (!channel) throw new NotFoundException('Payment channel configuration was not found.');
      if (
        !channel.killSwitchReason ||
        channel.verificationStatus !== 'VERIFIED' ||
        channel.financeApprovalRequired ||
        channel.pendingProposedByUserId ||
        !channel.accountNumber ||
        channel.accountNumber === 'NOT_CONFIGURED' ||
        channel.isActive ||
        channel.mode !== 'DISABLED'
      ) {
        throw new ConflictException('Only a verified, fully configured, disabled channel with an active kill switch can be submitted for reactivation.');
      }
    } else {
      if (!FINANCE_REQUEST_ROLES.includes(requesterRole)) {
        throw new ForbiddenException('Only finance staff and managers may request financial approval.');
      }

      if (dto.targetType === 'RECONCILIATION_ITEM') {
        if (!dto.targetId || !['CONFIRM_MATCH', 'REJECT_EXTERNAL', 'REQUEST_ADJUSTMENT'].includes(dto.action)) {
          throw new BadRequestException('Unsupported reconciliation approval action.');
        }
        const item = await this.prisma.reconciliationItem.findUnique({ where: { id: dto.targetId } });
        if (!item) throw new NotFoundException('Reconciliation item was not found.');
        if (!UNRESOLVED_RECONCILIATION_STATUSES.includes(String(item.status))) {
          throw new ConflictException('Only unresolved reconciliation items can be submitted for approval.');
        }
      } else if (dto.targetType === 'DEPOSIT_REQUEST') {
        if (!dto.targetId || dto.action !== 'CREDIT_VERIFIED_DEPOSIT') {
          throw new BadRequestException('A deposit credit approval must target one deposit and use CREDIT_VERIFIED_DEPOSIT.');
        }
        const deposit = await this.prisma.depositRequest.findUnique({ where: { id: dto.targetId } });
        if (!deposit) throw new NotFoundException('Deposit request was not found.');
        if (!['PENDING', 'UNDER_REVIEW'].includes(String(deposit.status))) {
          throw new ConflictException('Only pending or under-review deposits can be submitted for credit approval.');
        }
      } else {
        throw new BadRequestException('Financial approvals must target a reconciliation item or deposit request.');
      }
    }

    if (dto.targetId) {
      const existing = await this.prisma.operationalApproval.findFirst({
        where: {
          approvalType: dto.approvalType,
          targetType: dto.targetType,
          targetId: dto.targetId,
          action: dto.action,
          status: { in: ['PENDING', 'APPROVED_PENDING_EXECUTION'] },
        },
      });
      if (existing) {
        throw new ConflictException('An active approval request already exists for this target and action.');
      }
    }

    return this.prisma.operationalApproval.create({
      data: {
        approvalType: dto.approvalType,
        targetType: dto.targetType,
        targetId: dto.targetId || null,
        action: dto.action,
        reason: dto.reason.trim(),
        requesterRole,
        requestedByUserId: requesterId,
        status: 'PENDING',
      },
    });
  }

  async list(status?: string) {
    const allowed = ['PENDING', 'APPROVED_PENDING_EXECUTION', 'REJECTED', 'EXECUTED'];
    if (status && !allowed.includes(status)) {
      throw new BadRequestException('Unsupported approval status filter.');
    }
    return this.prisma.operationalApproval.findMany({
      where: status ? { status } : undefined,
      orderBy: { requestedAt: 'desc' },
      take: 100,
    });
  }

  async decide(
    approverId: string,
    approverRole: SharedUserRole,
    id: string,
    dto: DecideOperationalApprovalDto,
  ) {
    const request = await this.prisma.operationalApproval.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Approval request was not found.');
    if (request.status !== 'PENDING') throw new ConflictException('Approval request has already been decided.');
    if (request.requestedByUserId === approverId) {
      throw new ForbiddenException('Four-eyes control: the requester cannot approve their own request.');
    }
    if (dto.decision === 'REJECT' && (!dto.notes || dto.notes.trim().length < 8)) {
      throw new BadRequestException('A clear rejection reason is required.');
    }

    if (request.approvalType === 'NETWORK_CHANGE' || request.approvalType === 'PAYMENT_CHANNEL_REACTIVATION') {
      if (![SharedUserRole.OWNER, SharedUserRole.GENERAL_MANAGER].includes(approverRole)) {
        throw new ForbiddenException('Network and emergency channel approvals require a different owner or general manager.');
      }
    } else if (![SharedUserRole.OWNER, SharedUserRole.GENERAL_MANAGER, SharedUserRole.FINANCE_MANAGER].includes(approverRole)) {
      throw new ForbiddenException('Financial approvals require a finance manager, general manager, or owner.');
    }

    const nextStatus = dto.decision === 'APPROVE' ? 'APPROVED_PENDING_EXECUTION' : 'REJECTED';
    const changed = await this.prisma.operationalApproval.updateMany({
      where: { id, status: 'PENDING', requestedByUserId: { not: approverId } },
      data: {
        status: nextStatus,
        decision: dto.decision,
        decisionNotes: dto.notes?.trim() || null,
        decidedByUserId: approverId,
        decidedAt: new Date(),
      },
    });
    if (changed.count !== 1) {
      throw new ConflictException('Approval request changed concurrently; reload and review it again.');
    }

    const updated = await this.prisma.operationalApproval.findUnique({ where: { id } });
    return {
      request: updated,
      execution: 'NOT_EXECUTED',
      message: dto.decision === 'APPROVE'
        ? 'Approved under four-eyes control. The network or financial action has not been executed.'
        : 'Request rejected. No router or ledger changes were performed.',
    };
  }

  async closeout(
    executorId: string,
    executorRole: SharedUserRole,
    id: string,
    dto: CloseoutOperationalApprovalDto,
  ) {
    const request = await this.prisma.operationalApproval.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Approval request was not found.');
    if (request.status !== 'APPROVED_PENDING_EXECUTION' || request.decision !== 'APPROVE' || !request.decidedByUserId) {
      throw new ConflictException('Only an approved request awaiting execution can be closed out.');
    }
    if (request.requestedByUserId === executorId) {
      throw new ForbiddenException('The requester cannot execute or close out their own approval.');
    }

    if (request.approvalType === 'NETWORK_CHANGE') {
      if (![SharedUserRole.OWNER, SharedUserRole.GENERAL_MANAGER, SharedUserRole.ADMIN].includes(executorRole)) {
        throw new ForbiddenException('Network change closeout requires an authorized network manager.');
      }
      const changed = await this.prisma.operationalApproval.updateMany({
        where: {
          id,
          approvalType: 'NETWORK_CHANGE',
          status: 'APPROVED_PENDING_EXECUTION',
          requestedByUserId: { not: executorId },
        },
        data: {
          status: 'EXECUTED',
          executionReference: dto.executionReference.trim(),
          executionNotes: dto.notes?.trim() || 'تم تسجيل دليل تنفيذ يدوي خارج واجهة الإدارة؛ لم ينفذ النظام أي أمر على الراوتر.',
          executedByUserId: executorId,
          executedAt: new Date(),
        },
      });
      if (changed.count !== 1) throw new ConflictException('Network approval changed concurrently.');
      return {
        status: 'EXECUTED',
        execution: 'MANUAL_EXTERNAL_CHANGE_RECORDED',
        routerMutationPerformedByPlatform: false,
        message: 'تم تسجيل مرجع التنفيذ اليدوي فقط. وكيل MikroTik لا يملك ولا يستدعي أي عملية كتابة.',
      };
    }

    if (request.approvalType === 'PAYMENT_CHANNEL_REACTIVATION') {
      if (![SharedUserRole.OWNER, SharedUserRole.GENERAL_MANAGER].includes(executorRole)) {
        throw new ForbiddenException('Emergency payment channel release requires a different owner or general manager.');
      }
      if (request.targetType !== 'PAYMENT_CHANNEL_CONFIG' || !request.targetId || request.action !== 'RELEASE_KILL_SWITCH') {
        throw new BadRequestException('Unsupported payment channel reactivation approval target.');
      }
      if (request.decidedByUserId === executorId) {
        throw new ForbiddenException('The approval decider cannot execute the emergency channel reactivation.');
      }

      return this.prisma.$transaction(async (tx) => {
        const channel = await tx.paymentChannelConfig.findUnique({ where: { id: request.targetId! } });
        if (!channel) throw new NotFoundException('Payment channel configuration was not found.');
        if (
          !channel.killSwitchReason ||
          channel.verificationStatus !== 'VERIFIED' ||
          channel.financeApprovalRequired ||
          channel.pendingProposedByUserId ||
          !channel.accountNumber ||
          channel.accountNumber === 'NOT_CONFIGURED' ||
          channel.isActive ||
          channel.mode !== 'DISABLED'
        ) {
          throw new ConflictException('Payment channel state changed; it no longer qualifies for controlled reactivation.');
        }

        const now = new Date();
        const activated = await tx.paymentChannelConfig.updateMany({
          where: {
            id: channel.id,
            isActive: false,
            mode: 'DISABLED',
            killSwitchReason: channel.killSwitchReason,
            verificationStatus: 'VERIFIED',
            financeApprovalRequired: false,
          },
          data: {
            isActive: true,
            mode: 'MANUAL',
            killSwitchReason: null,
            killSwitchAt: null,
          },
        });
        if (activated.count !== 1) {
          throw new ConflictException('Payment channel changed concurrently; reactivation was not performed.');
        }

        await tx.auditLog.create({
          data: {
            userId: executorId,
            action: 'PAYMENT_CHANNEL_KILL_SWITCH_RELEASED',
            entityName: 'PAYMENT_CHANNEL_CONFIG',
            entityId: channel.id,
            oldValues: {
              mode: channel.mode,
              isActive: channel.isActive,
              killSwitchReason: channel.killSwitchReason,
            },
            newValues: {
              mode: 'MANUAL',
              isActive: true,
              approvalId: id,
              requestedByUserId: request.requestedByUserId,
              approvedByUserId: request.decidedByUserId,
              executedByUserId: executorId,
              reason: request.reason,
              executionReference: dto.executionReference.trim(),
            },
          },
        });

        const updatedApproval = await tx.operationalApproval.updateMany({
          where: {
            id,
            status: 'APPROVED_PENDING_EXECUTION',
            requestedByUserId: { not: executorId },
            decidedByUserId: { not: executorId },
          },
          data: {
            status: 'EXECUTED',
            executionReference: dto.executionReference.trim(),
            executionNotes: dto.notes?.trim() || 'تم رفع Kill Switch بعد موافقة مستقلة وتوثيق دليل التنفيذ؛ بقيت القناة في MANUAL.',
            executedByUserId: executorId,
            executedAt: now,
          },
        });
        if (updatedApproval.count !== 1) {
          throw new ConflictException('Approval changed concurrently; kill switch release was rolled back.');
        }
        const updatedChannel = await tx.paymentChannelConfig.findUnique({ where: { id: channel.id } });
        return {
          status: 'EXECUTED',
          channel: updatedChannel,
          mode: 'MANUAL',
          automaticApiEnabled: false,
          message: 'تم رفع Kill Switch بموافقة ثنائية/ثلاثية مسجلة. القناة تعمل يدوياً فقط ولا يتم إرسال تحويلات آلية.',
        };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    }

    if (![SharedUserRole.OWNER, SharedUserRole.GENERAL_MANAGER, SharedUserRole.FINANCE_MANAGER].includes(executorRole)) {
      throw new ForbiddenException('Financial closeout requires an owner, general manager, or finance manager.');
    }
    if (request.targetType === 'DEPOSIT_REQUEST') {
      throw new ConflictException(
        'نفّذ قيد الإيداع من POST /admin/deposits/:id/approve مع approvalId. هذا المسار يتحقق من الموافق ويغلق الطلب داخل معاملة دفتر الأستاذ نفسها.',
      );
    }
    if (request.targetType !== 'RECONCILIATION_ITEM' || !request.targetId) {
      throw new BadRequestException('Unsupported financial closeout target.');
    }

    return this.prisma.$transaction(async (tx) => {
      const item = await tx.reconciliationItem.findUnique({ where: { id: request.targetId! } });
      if (!item) throw new NotFoundException('Reconciliation item was not found.');
      if (!UNRESOLVED_RECONCILIATION_STATUSES.includes(String(item.status))) {
        throw new ConflictException('Reconciliation item is no longer unresolved.');
      }

      const now = new Date();
      let nextItemStatus: 'MATCHED' | 'RESOLVED_MANUAL';
      let resolution = '';
      if (request.action === 'CONFIRM_MATCH') {
        if (!new Prisma.Decimal(item.expectedAmount).equals(new Prisma.Decimal(item.actualAmount))) {
          throw new ConflictException('Amounts do not match exactly; the discrepancy cannot be manually marked as matched.');
        }
        nextItemStatus = 'MATCHED';
        resolution = 'مطابقة مستقلة: المبلغ المتوقع يساوي المبلغ الفعلي.';
      } else if (request.action === 'REJECT_EXTERNAL') {
        nextItemStatus = 'RESOLVED_MANUAL';
        resolution = 'تم رفض/استبعاد الحركة الخارجية بعد مراجعة الدليل المرفق.';
      } else if (request.action === 'REQUEST_ADJUSTMENT') {
        if (!dto.ledgerTransactionId) {
          throw new BadRequestException('A posted, balanced adjustment ledger transaction ID is required.');
        }
        const ledgerTx = await tx.ledgerTransaction.findUnique({
          where: { id: dto.ledgerTransactionId },
          include: { entries: true },
        });
        if (
          !ledgerTx ||
          ledgerTx.status !== 'POSTED' ||
          ledgerTx.type !== 'ADJUSTMENT' ||
          ledgerTx.referenceType !== 'RECONCILIATION_ITEM' ||
          ledgerTx.referenceId !== item.id
        ) {
          throw new ConflictException('The referenced ledger transaction is not a posted adjustment for this reconciliation item.');
        }

        const byCurrency = new Map<string, { debit: Prisma.Decimal; credit: Prisma.Decimal }>();
        for (const entry of ledgerTx.entries) {
          const totals = byCurrency.get(entry.currency) || {
            debit: new Prisma.Decimal(0),
            credit: new Prisma.Decimal(0),
          };
          totals.debit = totals.debit.add(entry.debitAmount);
          totals.credit = totals.credit.add(entry.creditAmount);
          byCurrency.set(entry.currency, totals);
        }
        for (const [currency, totals] of byCurrency.entries()) {
          if (!totals.debit.equals(totals.credit)) {
            throw new ConflictException('The referenced ledger adjustment is not balanced for currency ' + currency + '.');
          }
        }
        const variance = new Prisma.Decimal(item.expectedAmount).sub(item.actualAmount).abs();
        const itemTotals = byCurrency.get(item.currency);
        if (
          variance.equals(0) ||
          !itemTotals ||
          !itemTotals.debit.equals(variance) ||
          !itemTotals.credit.equals(variance)
        ) {
          throw new ConflictException('The posted adjustment amount does not equal this item variance in its currency.');
        }
        nextItemStatus = 'RESOLVED_MANUAL';
        resolution = 'تمت مطابقة فرق الحركة مع قيد التسوية المزدوج رقم ' + ledgerTx.txNumber + '.';
      } else {
        throw new BadRequestException('Unsupported reconciliation approval action.');
      }

      const updatedItem = await tx.reconciliationItem.updateMany({
        where: { id: item.id, status: item.status },
        data: {
          status: nextItemStatus,
          resolvedAt: now,
          resolvedByUserId: executorId,
          notes: [item.notes, 'إغلاق معتمد: ' + resolution, 'مرجع التنفيذ: ' + dto.executionReference.trim(), dto.notes?.trim()]
            .filter(Boolean)
            .join('\n'),
        },
      });
      if (updatedItem.count !== 1) throw new ConflictException('Reconciliation item changed concurrently.');

      const updatedApproval = await tx.operationalApproval.updateMany({
        where: {
          id,
          status: 'APPROVED_PENDING_EXECUTION',
          requestedByUserId: { not: executorId },
        },
        data: {
          status: 'EXECUTED',
          executionReference: dto.executionReference.trim(),
          executionNotes: dto.notes?.trim() || resolution,
          executedByUserId: executorId,
          executedAt: now,
        },
      });
      if (updatedApproval.count !== 1) throw new ConflictException('Approval changed concurrently; financial closeout was rolled back.');

      return {
        status: 'EXECUTED',
        reconciliationItemId: item.id,
        reconciliationStatus: nextItemStatus,
        ledgerTransactionId: dto.ledgerTransactionId || null,
        ledgerMutationPerformedByCloseout: false,
        message: 'تم إغلاق عنصر المطابقة بعد مراجعة الدليل. لم يغيّر هذا المسار رصيد محفظة أو ينشئ قيداً محاسبياً.',
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
