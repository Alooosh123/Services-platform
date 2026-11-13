import { ConflictException, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@digital-topup/shared';
import { OperationalApprovalsService } from './operational-approvals.service';

describe('OperationalApprovalsService four-eyes controls', () => {
  const approvalId = 'a1c32c52-3c58-4f3b-95d3-3a20a1ed4d91';
  const depositId = 'e2c77e0b-d1c9-4ee1-9ed3-6f5adf4118ba';
  const pending = {
    id: approvalId, approvalType: 'FINANCIAL_RECONCILIATION', targetType: 'DEPOSIT_REQUEST',
    targetId: depositId, action: 'CREDIT_VERIFIED_DEPOSIT', reason: 'تم التحقق من التحويل من كشف الحساب الرسمي.',
    requesterRole: UserRole.FINANCE, requestedByUserId: 'finance-requester', status: 'PENDING',
  };
  const prisma = {
    depositRequest: { findUnique: jest.fn().mockResolvedValue({ id: depositId, status: 'UNDER_REVIEW' }) },
    reconciliationItem: { findUnique: jest.fn() },
    operationalApproval: {
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...pending, ...data })),
      findUnique: jest.fn().mockResolvedValue(pending),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const service = new OperationalApprovalsService(prisma as any);
  beforeEach(() => jest.clearAllMocks());

  it('creates a durable approval request for a pending manual deposit', async () => {
    const result = await service.create('finance-requester', UserRole.FINANCE, {
      approvalType: 'FINANCIAL_RECONCILIATION', targetType: 'DEPOSIT_REQUEST', targetId: depositId,
      action: 'CREDIT_VERIFIED_DEPOSIT', reason: 'تمت مطابقة الحوالة مع كشف الحساب الرسمي.',
    } as any);
    expect(result.status).toBe('PENDING');
    expect(prisma.operationalApproval.create).toHaveBeenCalled();
  });

  it('prevents the requester from approving their own request', async () => {
    await expect(service.decide('finance-requester', UserRole.FINANCE_MANAGER, approvalId, { decision: 'APPROVE' }))
      .rejects.toThrow(ForbiddenException);
    expect(prisma.operationalApproval.updateMany).not.toHaveBeenCalled();
  });

  it('requires an independent finance approver and leaves execution separate', async () => {
    const result = await service.decide('finance-approver', UserRole.FINANCE_MANAGER, approvalId, { decision: 'APPROVE', notes: 'تم التحقق المستقل.' });
    expect(result.execution).toBe('NOT_EXECUTED');
    expect(prisma.operationalApproval.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: approvalId, status: 'PENDING', requestedByUserId: { not: 'finance-approver' } }),
      data: expect.objectContaining({ status: 'APPROVED_PENDING_EXECUTION', decision: 'APPROVE', decidedByUserId: 'finance-approver' }),
    }));
  });

  it('rejects a concurrent second decision', async () => {
    prisma.operationalApproval.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.decide('finance-approver', UserRole.FINANCE_MANAGER, approvalId, { decision: 'APPROVE' }))
      .rejects.toThrow(ConflictException);
  });
});
