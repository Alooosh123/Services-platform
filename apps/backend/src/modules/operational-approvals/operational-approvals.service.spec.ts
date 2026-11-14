import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UserRole } from '@digital-topup/shared';
import { OperationalApprovalsService } from './operational-approvals.service';

describe('OperationalApprovalsService four-eyes controls', () => {
  const approvalId = 'a1c32c52-3c58-4f3b-95d3-3a20a1ed4d91';
  const depositId = 'e2c77e0b-d1c9-4ee1-9ed3-6f5adf4118ba';
  const itemId = '7124b5d0-74e3-49f0-87f8-32f4e8d1a670';
  const requesterId = 'finance-requester';
  const approverId = 'finance-approver';
  const pendingDeposit = {
    id: approvalId,
    approvalType: 'FINANCIAL_RECONCILIATION',
    targetType: 'DEPOSIT_REQUEST',
    targetId: depositId,
    action: 'CREDIT_VERIFIED_DEPOSIT',
    reason: 'تم التحقق من التحويل من كشف الحساب الرسمي.',
    requesterRole: UserRole.FINANCE,
    requestedByUserId: requesterId,
    decidedByUserId: approverId,
    status: 'APPROVED_PENDING_EXECUTION',
    decision: 'APPROVE',
  };
  const pendingNetwork = {
    ...pendingDeposit,
    approvalType: 'NETWORK_CHANGE',
    targetType: 'MIKROTIK_ROUTER',
    targetId: null,
    action: 'CHANGE_INTERFACE',
  };
  const pendingReconciliation = {
    ...pendingDeposit,
    approvalType: 'FINANCIAL_RECONCILIATION',
    targetType: 'RECONCILIATION_ITEM',
    targetId: itemId,
    action: 'CONFIRM_MATCH',
  };

  const channelConfig = {
    id: '8bcb11f0-2e88-4a52-ae09-3c07a30f5a2a',
    code: 'JAIB',
    accountNumber: '770123456',
    mode: 'DISABLED',
    isActive: false,
    verificationStatus: 'VERIFIED',
    financeApprovalRequired: false,
    pendingProposedByUserId: null,
    killSwitchReason: 'incident-2026-11-13',
    killSwitchAt: new Date(),
  };
  const tx = {
    paymentChannelConfig: {
      findUnique: jest.fn().mockResolvedValue(channelConfig),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-channel-release' }) },
    reconciliationItem: {
      findUnique: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    operationalApproval: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    ledgerTransaction: {
      findUnique: jest.fn(),
    },
  };
  const prisma = {
    paymentChannelConfig: { findUnique: jest.fn().mockResolvedValue(channelConfig) },
    reconciliationItem: { findUnique: jest.fn() },
    depositRequest: { findUnique: jest.fn().mockResolvedValue({ id: depositId, status: 'UNDER_REVIEW' }) },
    operationalApproval: {
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...pendingDeposit, ...data })),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
  };
  const service = new OperationalApprovalsService(prisma as any);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.operationalApproval.findFirst.mockResolvedValue(null);
    tx.operationalApproval.updateMany.mockResolvedValue({ count: 1 });
    tx.reconciliationItem.updateMany.mockResolvedValue({ count: 1 });
  });

  it('creates a durable approval request for a pending manual deposit', async () => {
    const result = await service.create(requesterId, UserRole.FINANCE, {
      approvalType: 'FINANCIAL_RECONCILIATION',
      targetType: 'DEPOSIT_REQUEST',
      targetId: depositId,
      action: 'CREDIT_VERIFIED_DEPOSIT',
      reason: 'تمت مطابقة الحوالة مع كشف الحساب الرسمي.',
    });
    expect(result.status).toBe('PENDING');
    expect(prisma.operationalApproval.create).toHaveBeenCalled();
    expect(prisma.depositRequest.findUnique).toHaveBeenCalledWith({ where: { id: depositId } });
  });

  it('creates a reconciliation approval for an unresolved item', async () => {
    prisma.reconciliationItem.findUnique.mockResolvedValue({ id: itemId, status: 'DISCREPANCY' });
    const result = await service.create(requesterId, UserRole.FINANCE, {
      approvalType: 'FINANCIAL_RECONCILIATION',
      targetType: 'RECONCILIATION_ITEM',
      targetId: itemId,
      action: 'CONFIRM_MATCH',
      reason: 'مراجعة مستقلة للمستندات وكشف الحساب.',
    });
    expect(result.status).toBe('PENDING');
  });

  it('prevents the requester from approving their own request', async () => {
    prisma.operationalApproval.findUnique.mockResolvedValue({ ...pendingDeposit, decidedByUserId: null, status: 'PENDING' });
    await expect(service.decide(requesterId, UserRole.FINANCE_MANAGER, approvalId, { decision: 'APPROVE' }))
      .rejects.toThrow(ForbiddenException);
    expect(prisma.operationalApproval.updateMany).not.toHaveBeenCalled();
  });

  it('requires an independent finance approver and leaves execution separate', async () => {
    prisma.operationalApproval.findUnique.mockResolvedValue({ ...pendingDeposit, decidedByUserId: null, status: 'PENDING' });
    const result = await service.decide(approverId, UserRole.FINANCE_MANAGER, approvalId, {
      decision: 'APPROVE',
      notes: 'تم التحقق المستقل.',
    });
    expect(result.execution).toBe('NOT_EXECUTED');
    expect(prisma.operationalApproval.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: approvalId, status: 'PENDING', requestedByUserId: { not: approverId } }),
      data: expect.objectContaining({ status: 'APPROVED_PENDING_EXECUTION', decision: 'APPROVE', decidedByUserId: approverId }),
    }));
  });

  it('records external network change evidence but never invokes a router write operation', async () => {
    prisma.operationalApproval.findUnique.mockResolvedValue(pendingNetwork);
    const result: any = await service.closeout('network-operator', UserRole.ADMIN, approvalId, {
      executionReference: 'CHANGE-TICKET-2026-014',
      notes: 'تم تنفيذ التغيير يدوياً خارج المنصة وبعد مراجعة نافذة الصيانة.',
    });
    expect(result.routerMutationPerformedByPlatform).toBe(false);
    expect(result.execution).toBe('MANUAL_EXTERNAL_CHANGE_RECORDED');
    expect(tx.operationalApproval.updateMany).not.toHaveBeenCalled();
    expect(prisma.operationalApproval.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: approvalId, status: 'APPROVED_PENDING_EXECUTION' }),
      data: expect.objectContaining({ status: 'EXECUTED', executionReference: 'CHANGE-TICKET-2026-014' }),
    }));
  });

  it('blocks manual deposit closeout here so the double-entry deposit transaction remains atomic', async () => {
    prisma.operationalApproval.findUnique.mockResolvedValue(pendingDeposit);
    await expect(service.closeout(approverId, UserRole.FINANCE_MANAGER, approvalId, {
      executionReference: 'BANK-RECEIPT-8844',
    })).rejects.toThrow(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('releases a payment channel kill switch only after requester, approver and executor are distinct', async () => {
    prisma.operationalApproval.findUnique.mockResolvedValue({
      ...pendingNetwork,
      approvalType: 'PAYMENT_CHANNEL_REACTIVATION',
      targetType: 'PAYMENT_CHANNEL_CONFIG',
      targetId: channelConfig.id,
      action: 'RELEASE_KILL_SWITCH',
      requestedByUserId: requesterId,
      decidedByUserId: approverId,
      status: 'APPROVED_PENDING_EXECUTION',
      decision: 'APPROVE',
    });
    tx.paymentChannelConfig.findUnique.mockResolvedValue(channelConfig);

    const result: any = await service.closeout('independent-owner-3', UserRole.GENERAL_MANAGER, approvalId, {
      executionReference: 'INCIDENT-REVIEW-AND-CHANNEL-RELEASE-002',
      notes: 'تم التحقق من سبب الإيقاف واعتماد رفعه بعد مراجعة مستقلة.',
    });

    expect(result.status).toBe('EXECUTED');
    expect(result.mode).toBe('MANUAL');
    expect(result.automaticApiEnabled).toBe(false);
    expect(tx.paymentChannelConfig.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: channelConfig.id, mode: 'DISABLED', isActive: false }),
      data: expect.objectContaining({ mode: 'MANUAL', isActive: true, killSwitchReason: null }),
    }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'PAYMENT_CHANNEL_KILL_SWITCH_RELEASED' }),
    }));
    expect(tx.operationalApproval.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: approvalId,
        decidedByUserId: { not: 'independent-owner-3' },
      }),
    }));
  });

  it('does not allow the finance approver to execute their own channel reactivation approval', async () => {
    prisma.operationalApproval.findUnique.mockResolvedValue({
      ...pendingNetwork,
      approvalType: 'PAYMENT_CHANNEL_REACTIVATION',
      targetType: 'PAYMENT_CHANNEL_CONFIG',
      targetId: channelConfig.id,
      action: 'RELEASE_KILL_SWITCH',
      requestedByUserId: requesterId,
      decidedByUserId: approverId,
      status: 'APPROVED_PENDING_EXECUTION',
      decision: 'APPROVE',
    });
    await expect(service.closeout(approverId, UserRole.GENERAL_MANAGER, approvalId, {
      executionReference: 'INCIDENT-REVIEW-SELF-EXECUTION',
    })).rejects.toThrow('approver');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('marks an exactly matched reconciliation item only after approval', async () => {
    prisma.operationalApproval.findUnique.mockResolvedValue(pendingReconciliation);
    tx.reconciliationItem.findUnique.mockResolvedValue({
      id: itemId,
      currency: 'YER',
      expectedAmount: new Prisma.Decimal('1000.0000'),
      actualAmount: new Prisma.Decimal('1000.0000'),
      status: 'DISCREPANCY',
      notes: null,
    });
    const result: any = await service.closeout(approverId, UserRole.FINANCE_MANAGER, approvalId, {
      executionReference: 'BANK-STATEMENT-ROW-19',
    });
    expect(result.reconciliationStatus).toBe('MATCHED');
    expect(tx.reconciliationItem.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: itemId, status: 'DISCREPANCY' },
      data: expect.objectContaining({ status: 'MATCHED', resolvedByUserId: approverId }),
    }));
  });

  it('refuses to match an amount discrepancy', async () => {
    prisma.operationalApproval.findUnique.mockResolvedValue(pendingReconciliation);
    tx.reconciliationItem.findUnique.mockResolvedValue({
      id: itemId,
      currency: 'YER',
      expectedAmount: new Prisma.Decimal('1000.0000'),
      actualAmount: new Prisma.Decimal('900.0000'),
      status: 'DISCREPANCY',
      notes: null,
    });
    await expect(service.closeout(approverId, UserRole.FINANCE_MANAGER, approvalId, {
      executionReference: 'BANK-STATEMENT-ROW-19',
    })).rejects.toThrow(ConflictException);
    expect(tx.reconciliationItem.updateMany).not.toHaveBeenCalled();
  });

  it('requires a balanced, posted adjustment transaction tied to the exact discrepancy', async () => {
    prisma.operationalApproval.findUnique.mockResolvedValue({
      ...pendingReconciliation,
      action: 'REQUEST_ADJUSTMENT',
    });
    tx.reconciliationItem.findUnique.mockResolvedValue({
      id: itemId,
      currency: 'YER',
      expectedAmount: new Prisma.Decimal('1200.0000'),
      actualAmount: new Prisma.Decimal('1000.0000'),
      status: 'DISCREPANCY',
      notes: null,
    });
    tx.ledgerTransaction.findUnique.mockResolvedValue({
      id: '6d5c0c3a-1010-4dc5-ae8f-65f44e8fc5e0',
      txNumber: 'LTX-ADJ-001',
      status: 'POSTED',
      type: 'ADJUSTMENT',
      referenceType: 'RECONCILIATION_ITEM',
      referenceId: itemId,
      entries: [
        { currency: 'YER', debitAmount: new Prisma.Decimal('200.0000'), creditAmount: new Prisma.Decimal(0) },
        { currency: 'YER', debitAmount: new Prisma.Decimal(0), creditAmount: new Prisma.Decimal('200.0000') },
      ],
    });
    const result: any = await service.closeout(approverId, UserRole.FINANCE_MANAGER, approvalId, {
      executionReference: 'FINANCE-ADJUSTMENT-001',
      ledgerTransactionId: '6d5c0c3a-1010-4dc5-ae8f-65f44e8fc5e0',
    });
    expect(result.reconciliationStatus).toBe('RESOLVED_MANUAL');
    expect(result.ledgerMutationPerformedByCloseout).toBe(false);
  });

  it('rejects a concurrent second approval decision', async () => {
    prisma.operationalApproval.findUnique.mockResolvedValue({ ...pendingDeposit, status: 'PENDING', decidedByUserId: null });
    prisma.operationalApproval.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.decide(approverId, UserRole.FINANCE_MANAGER, approvalId, { decision: 'APPROVE' }))
      .rejects.toThrow(ConflictException);
  });
});
