import { Test, TestingModule } from '@nestjs/testing';
import { LedgerService } from './ledger.service';
import { PrismaService } from '../../database/prisma.service';
import { BadRequestException } from '@nestjs/common';
import { CurrencyCode, LedgerTransactionType } from '@digital-topup/shared';
import { Prisma } from '@prisma/client';

describe('LedgerService (Strict Double-Entry)', () => {
  let service: LedgerService;

  const mockWallet = {
    id: 'wallet-123',
    userId: 'user-123',
    currency: CurrencyCode.YER,
    balance: new Prisma.Decimal(50000.0),
    lockedBalance: new Prisma.Decimal(0),
    version: 0,
    isFrozen: false,
  };

  const mockAccountCash = {
    id: 'acc-1',
    code: '1001-CASH-JAIB',
    name: 'Cash Jaib',
    currency: CurrencyCode.YER,
  };

  const mockAccountCustomer = {
    id: 'acc-2',
    code: '2001-CUSTOMER-WALLETS-YER',
    name: 'Customer Wallets YER',
    currency: CurrencyCode.YER,
  };

  const mockPrismaService = {
    wallet: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    ledgerAccount: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    ledgerTransaction: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    ledgerEntry: {
      create: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LedgerService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<LedgerService>(LedgerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should reject a transaction if fewer than 2 entries are provided', async () => {
    await expect(
      service.recordDoubleEntryTransaction({
        txNumber: 'LTX-INVALID-1',
        type: LedgerTransactionType.TOPUP,
        referenceType: 'TOPUP',
        referenceId: 'REF-1',
        entries: [
          {
            accountCode: '1001-CASH-JAIB',
            debitAmount: 1000,
            creditAmount: 0,
            currency: CurrencyCode.YER,
          },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject an imbalanced transaction where Total Debit != Total Credit', async () => {
    await expect(
      service.recordDoubleEntryTransaction({
        txNumber: 'LTX-IMBALANCED-1',
        type: LedgerTransactionType.TOPUP,
        referenceType: 'TOPUP',
        referenceId: 'REF-1',
        entries: [
          {
            accountCode: '1001-CASH-JAIB',
            debitAmount: 1000,
            creditAmount: 0,
            currency: CurrencyCode.YER,
          },
          {
            accountCode: '2001-CUSTOMER-WALLETS-YER',
            debitAmount: 0,
            creditAmount: 900, // Differs by 100!
            currency: CurrencyCode.YER,
          },
        ],
      }),
    ).rejects.toThrow(/Double-entry imbalance/);
  });

  it('should successfully record a balanced double-entry topup transaction', async () => {
    mockPrismaService.ledgerTransaction.findUnique
      .mockResolvedValueOnce(null) // idempotency check
      .mockResolvedValueOnce({ id: 'tx-123', txNumber: 'LTX-TOPUP-001', entries: [] }); // return completed tx

    mockPrismaService.ledgerAccount.findUnique.mockImplementation(({ where }) => {
      if (where.code === '1001-CASH-JAIB') return Promise.resolve(mockAccountCash);
      if (where.code === '2001-CUSTOMER-WALLETS-YER') return Promise.resolve(mockAccountCustomer);
      return Promise.resolve(null);
    });

    mockPrismaService.wallet.findUnique.mockResolvedValue(mockWallet);
    mockPrismaService.ledgerTransaction.create.mockResolvedValue({ id: 'tx-123' });
    mockPrismaService.ledgerEntry.create.mockResolvedValue({ id: 'entry-1' });
    mockPrismaService.wallet.update.mockResolvedValue({
      ...mockWallet,
      balance: new Prisma.Decimal(60000.0),
    });

    const result = await service.recordDoubleEntryTransaction({
      txNumber: 'LTX-TOPUP-001',
      type: LedgerTransactionType.TOPUP,
      referenceType: 'TOPUP',
      referenceId: 'TOP-001',
      entries: [
        {
          accountCode: '1001-CASH-JAIB',
          debitAmount: 10000,
          creditAmount: 0,
          currency: CurrencyCode.YER,
        },
        {
          accountCode: '2001-CUSTOMER-WALLETS-YER',
          walletId: mockWallet.id,
          debitAmount: 0,
          creditAmount: 10000,
          currency: CurrencyCode.YER,
        },
      ],
    });

    expect(result.isDuplicate).toBe(false);
    expect(mockPrismaService.ledgerTransaction.create).toHaveBeenCalled();
    expect(mockPrismaService.ledgerEntry.create).toHaveBeenCalledTimes(2);
    expect(mockPrismaService.wallet.updateMany).toHaveBeenCalled();
  });

  it('should reject wallet deduction if balance would drop below zero', async () => {
    mockPrismaService.ledgerTransaction.findUnique.mockResolvedValueOnce(null);
    mockPrismaService.ledgerAccount.findUnique.mockImplementation(({ where }) => {
      if (where.code === '1001-CASH-JAIB') return Promise.resolve(mockAccountCash);
      if (where.code === '2001-CUSTOMER-WALLETS-YER') return Promise.resolve(mockAccountCustomer);
      return Promise.resolve(null);
    });

    mockPrismaService.wallet.findUnique.mockResolvedValue(mockWallet); // current balance: 50,000 YER
    mockPrismaService.ledgerTransaction.create.mockResolvedValue({ id: 'tx-123' });

    // Try to debit 60,000 from wallet with only 50,000 balance
    await expect(
      service.recordDoubleEntryTransaction({
        txNumber: 'LTX-OVERDRAFT',
        type: LedgerTransactionType.PURCHASE,
        referenceType: 'PURCHASE',
        referenceId: 'ORD-123',
        entries: [
          {
            accountCode: '2001-CUSTOMER-WALLETS-YER',
            walletId: mockWallet.id,
            debitAmount: 60000,
            creditAmount: 0,
            currency: CurrencyCode.YER,
          },
          {
            accountCode: '1001-CASH-JAIB',
            debitAmount: 0,
            creditAmount: 60000,
            currency: CurrencyCode.YER,
          },
        ],
      }),
    ).rejects.toThrow(/Insufficient wallet balance/);
  });

  it('uses a version-guarded atomic update when reserving wallet funds', async () => {
    mockPrismaService.wallet.findUnique.mockResolvedValue(mockWallet);
    mockPrismaService.wallet.updateMany.mockResolvedValue({ count: 1 });
    await service.holdWalletBalance(mockWallet.id, 100);

    expect(mockPrismaService.wallet.updateMany).toHaveBeenCalledWith({
      where: { id: mockWallet.id, version: 0, isFrozen: false },
      data: {
        lockedBalance: { increment: new Prisma.Decimal(100) },
        version: { increment: 1 },
      },
    });
  });

  it('rejects a stale reservation instead of overwriting concurrent wallet changes', async () => {
    mockPrismaService.wallet.findUnique.mockResolvedValue(mockWallet);
    mockPrismaService.wallet.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.holdWalletBalance(mockWallet.id, 100)).rejects.toThrow(
      'Wallet changed concurrently',
    );
  });

  it('does not silently release more funds than are locked', async () => {
    mockPrismaService.wallet.findUnique.mockResolvedValue({
      ...mockWallet,
      lockedBalance: new Prisma.Decimal(10),
    });
    await expect(service.releaseWalletHold(mockWallet.id, 11)).rejects.toThrow(
      'does not have enough locked funds',
    );
  });
});
