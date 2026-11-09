import { Test, TestingModule } from '@nestjs/testing';
import { ReconciliationService } from './reconciliation.service';
import { DepositsService } from '../deposits/deposits.service';
import { PayoutsService } from '../payouts/payouts.service';
import { LedgerService } from '../ledger/ledger.service';
import { PrismaService } from '../../database/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('Reconciliation persistence and financial controls', () => {
  let service: ReconciliationService;
  const mockPrisma: any = {
    reconciliationBatch: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    reconciliationItem: { findUnique: jest.fn().mockResolvedValue(null) },
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
