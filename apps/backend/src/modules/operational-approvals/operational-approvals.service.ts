import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UserRole } from '@digital-topup/shared';
import { CreateOperationalApprovalDto, DecideOperationalApprovalDto } from './operational-approvals.dto';

const NETWORK_REQUEST_ROLES = [UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.ADMIN];
const FINANCE_REQUEST_ROLES = [UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.ADMIN, UserRole.FINANCE_MANAGER, UserRole.FINANCE];

@Injectable()
export class OperationalApprovalsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(requesterId: string, requesterRole: UserRole, dto: CreateOperationalApprovalDto) {
    if (dto.approvalType === 'NETWORK_CHANGE') {
      if (!NETWORK_REQUEST_ROLES.includes(requesterRole)) throw new ForbiddenException('Only authorized managers may request network changes.');
      if (dto.targetType !== 'MIKROTIK_ROUTER' || !['CHANGE_INTERFACE', 'CHANGE_FIREWALL', 'CHANGE_ROUTE', 'CHANGE_QOS', 'OTHER'].includes(dto.action)) {
        throw new BadRequestException('Unsupported network change request.');
      }
    } else {
      if (!FINANCE_REQUEST_ROLES.includes(requesterRole)) throw new ForbiddenException('Only finance staff and managers may request reconciliation decisions.');
      if (dto.targetType !== 'RECONCILIATION_ITEM' || !dto.targetId || !['CONFIRM_MATCH', 'REJECT_EXTERNAL', 'REQUEST_ADJUSTMENT'].includes(dto.action)) {
        throw new BadRequestException('Unsupported financial reconciliation approval request.');
      }
      const item = await this.prisma.reconciliationItem.findUnique({ where: { id: dto.targetId } });
      if (!item) throw new NotFoundException('Reconciliation item was not found.');
      if (!['DISCREPANCY', 'UNKNOWN_EXTERNAL', 'UNKNOWN_INTERNAL', 'PENDING_REVIEW'].includes(String(item.status))) {
        throw new ConflictException('Only unresolved reconciliation items can be submitted for approval.');
      }
    }

    return this.prisma.operationalApproval.create({
      data: {
        approvalType: dto.approvalType, targetType: dto.targetType, targetId: dto.targetId || null,
        action: dto.action, reason: dto.reason, requesterRole, requestedByUserId: requesterId, status: 'PENDING',
      },
    });
  }

  async list(status?: string) {
    const allowed = ['PENDING', 'APPROVED_PENDING_EXECUTION', 'REJECTED'];
    if (status && !allowed.includes(status)) throw new BadRequestException('Unsupported approval status filter.');
    return this.prisma.operationalApproval.findMany({
      where: status ? { status } : undefined,
      orderBy: { requestedAt: 'desc' },
      take: 100,
    });
  }

  async decide(approverId: string, approverRole: UserRole, id: string, dto: DecideOperationalApprovalDto) {
    const request = await this.prisma.operationalApproval.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Approval request was not found.');
    if (request.status !== 'PENDING') throw new ConflictException('Approval request has already been decided.');
    if (request.requestedByUserId === approverId) throw new ForbiddenException('Four-eyes control: the requester cannot approve their own request.');

    if (request.approvalType === 'NETWORK_CHANGE') {
      if (![UserRole.OWNER, UserRole.GENERAL_MANAGER].includes(approverRole)) {
        throw new ForbiddenException('Network change approvals require a different owner or general manager.');
      }
    } else if (![UserRole.OWNER, UserRole.GENERAL_MANAGER, UserRole.FINANCE_MANAGER].includes(approverRole)) {
      throw new ForbiddenException('Financial reconciliation approvals require a finance manager, general manager, or owner.');
    }

    const nextStatus = dto.decision === 'APPROVE' ? 'APPROVED_PENDING_EXECUTION' : 'REJECTED';
    const changed = await this.prisma.operationalApproval.updateMany({
      where: { id, status: 'PENDING', requestedByUserId: { not: approverId } },
      data: {
        status: nextStatus, decision: dto.decision, decisionNotes: dto.notes || null,
        decidedByUserId: approverId, decidedAt: new Date(),
      },
    });
    if (changed.count !== 1) throw new ConflictException('Approval request changed concurrently; reload and review it again.');

    const updated = await this.prisma.operationalApproval.findUnique({ where: { id } });
    return {
      request: updated,
      execution: 'NOT_EXECUTED',
      message: dto.decision === 'APPROVE'
        ? 'Approved under four-eyes control. Execution remains a separate controlled/manual step; no router or ledger changes were performed.'
        : 'Request rejected. No router or ledger changes were performed.',
    };
  }
}
