import { Test, TestingModule } from '@nestjs/testing';
import { ReconciliationService } from './reconciliation.service';
import { DepositsService } from '../deposits/deposits.service';
import { PayoutsService } from '../payouts/payouts.service';
import { LedgerService } from '../ledger/ledger.service';
import { PrismaService } from '../../database/prisma.service';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('Reconciliation persistence and financial controls', () => {
  let service: ReconciliationService;
  const mockPrisma: any = {
    reconciliationBatch: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
    reconciliationItem: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn(), count: jest.fn() },
    reconciliationAdjustment: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn(), update: jest.fn() },
    ledgerAccount: { findMany: jest.fn().mockResolvedValue([]) },
    reconciliationBatch: { update: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(async (callback: any) => callback(mockPrisma)),
  };
  const deposits = { findDepositByReference: jest.fn().mockResolvedValue(null) };
  const payouts = { findByExternalReference: jest.fn().mockResolvedValue(null) };
  const ledger = {
    scopeAccountCode: jest.fn((code: string) => code),
    recordDoubleEntryTransaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.reconciliationBatch.findMany.mockResolvedValue([]);
    mockPrisma.reconciliationItem.findUnique.mockResolvedValue(null);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReconciliationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: DepositsService, useValue: deposits },
        { provide: PayoutsService, useValue: payouts },
        { provide: LedgerService, useValue: ledger },
      ],
    }).compile();
    service = module.get(ReconciliationService);
  });

  it('does not return seeded reconciliation batches from process memory', async () => {
    await expect(service.listBatches()).resolves.toEqual([]);
    expect(mockPrisma.reconciliationBatch.findMany).toHaveBeenCalled();
  });

  it('rejects an empty external statement instead of creating an empty successful batch', async () => {
    await expect(service.runDailyReconciliation('finance-user', {
      statementDate: '2026-11-01',
      externalStatements: [],
    } as any)).rejects.toThrow(BadRequestException);
    expect(mockPrisma.reconciliationBatch.create).not.toHaveBeenCalled();
  });

  it('does not resolve an unknown reconciliation item from an in-memory seed', async () => {
    await expect(service.getBatchById('non-existent-batch')).rejects.toThrow(NotFoundException);
  });

  it('requires a different finance user to approve a reconciliation adjustment', async () => {
    mockPrisma.reconciliationAdjustment.findUnique.mockResolvedValue({
      id: 'adjustment-1',
      tenantId: null,
      status: 'PENDING_APPROVAL',
      proposedByUserId: 'finance-proposer',
      item: { batch: { tenantId: null } },
    });

    await expect(service.approveLedgerAdjustment(
      'finance-proposer',
      'adjustment-1',
      'مراجعة مستقلة',
    )).rejects.toThrow(ForbiddenException);
    expect(ledger.recordDoubleEntryTransaction).not.toHaveBeenCalled();
  });

  it('preserves exact Decimal precision when posting an approved reconciliation adjustment', async () => {
    const expectedAmount = new Prisma.Decimal('0.1000');
    const actualAmount = new Prisma.Decimal('90071992547410.0999');
    const adjustmentAmount = new Prisma.Decimal('90071992547409.9999');
    mockPrisma.reconciliationAdjustment.findUnique.mockResolvedValue({
      id: 'adjustment-precision',
      tenantId: null,
      status: 'PENDING_APPROVAL',
      proposedByUserId: 'finance-proposer',
      debitAccountCode: '1010-CASH',
      creditAccountCode: '2100-SUSPENSE',
      amount: adjustmentAmount,
      currency: 'YER',
      item: {
        id: 'reconciliation-item-1',
        status: 'DISCREPANCY',
        discrepancyType: 'AMOUNT_MISMATCH',
        expectedAmount,
        actualAmount,
        currency: 'YER',
        referenceNumber: 'EXT-REF-1',
        notes: null,
        batch: { id: 'batch-1', tenantId: null },
      },
    });
    mockPrisma.ledgerAccount.findMany.mockResolvedValue([
      { code: '1010-CASH', currency: 'YER' },
      { code: '2100-SUSPENSE', currency: 'YER' },
    ]);
    mockPrisma.reconciliationItem.count.mockResolvedValue(1);
    ledger.recordDoubleEntryTransaction.mockResolvedValue({
      transaction: { id: 'ledger-reconciliation-1' },
    });

    await service.approveLedgerAdjustment(
      'finance-approver',
      'adjustment-precision',
      'اعتماد تسوية بعد المراجعة',
    );

    expect(ledger.recordDoubleEntryTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        entries: [
          expect.objectContaining({ debitAmount: '90071992547409.9999', creditAmount: 0 }),
          expect.objectContaining({ debitAmount: 0, creditAmount: '90071992547409.9999' }),
        ],
      }),
      mockPrisma,
    );
  });

  it('does not propose a ledger adjustment for an item missing from PostgreSQL', async () => {
    await expect(service.proposeLedgerAdjustment(
      'finance-user-a',
      'missing-item',
      '1010-CASH',
      '2100-SUSPENSE',
      'test adjustment',
    )).rejects.toThrow(NotFoundException);
    expect(ledger.recordDoubleEntryTransaction).not.toHaveBeenCalled();
  });
});
