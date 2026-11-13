import { Test, TestingModule } from '@nestjs/testing';
import { SupplierBalanceService } from './supplier-balance.service';
import { FulfillmentService } from './fulfillment.service';
import { ProvidersService } from './providers.service';
import { PrismaService } from '../../database/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import {
  CurrencyCode,
  OrderStatus,
  SupplierAccountType,
} from '@digital-topup/shared';
import { Prisma } from '@prisma/client';

describe('Phase 05 — AT-16: Supplier Commercial Balance & Fulfillment Gating', () => {
  let supplierBalanceService: SupplierBalanceService;
  let fulfillmentService: FulfillmentService;
  let ledgerService: LedgerService;

  const supplierAccountRecord: any = {
    id: 'supplier-account-mock-usd',
    providerId: 'provider-mock',
    currency: CurrencyCode.USD,
    balance: new Prisma.Decimal(10000),
    creditLimit: new Prisma.Decimal(0),
    accountType: SupplierAccountType.PREPAID,
  };
  const mockPrisma: any = {
    $transaction: jest.fn(async (callback: any) => callback(mockPrisma)),
    supplierAccount: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockImplementation(async () => supplierAccountRecord),
      findUnique: jest.fn(),
      create: jest.fn().mockResolvedValue(supplierAccountRecord),
      update: jest.fn().mockImplementation(async ({ data }: any) => Object.assign(supplierAccountRecord, data)),
      updateMany: jest.fn().mockImplementation(async ({ where, data }: any) => {
        if (where?.id !== supplierAccountRecord.id) return { count: 0 };
        if (data?.balance !== undefined) {
          supplierAccountRecord.balance = new Prisma.Decimal(data.balance);
        } else if (data?.balance?.decrement !== undefined) {
          supplierAccountRecord.balance = new Prisma.Decimal(supplierAccountRecord.balance).minus(data.balance.decrement);
        }
        return { count: 1 };
      }),
    },
    supplierTransaction: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'supplier-tx-1' }),
    },
    provider: {
      findFirst: jest.fn().mockResolvedValue({ id: 'provider-mock', code: 'MOCK', currency: CurrencyCode.USD, balance: new Prisma.Decimal(10000) }),
      findUnique: jest.fn().mockResolvedValue({ id: 'provider-mock', code: 'MOCK', currency: CurrencyCode.USD, balance: new Prisma.Decimal(10000) }),
      update: jest.fn().mockResolvedValue({}),
    },
    order: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    wallet: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockLedgerService = {
    recordSupplierFunding: jest.fn().mockResolvedValue({
      transaction: { id: 'LTX-SUP-FUND-01', txNumber: 'LTX-SUP-01', status: 'POSTED' },
    }),
    recordOrderSettlement: jest.fn().mockResolvedValue({
      transaction: { id: 'LTX-SETTLE-01', txNumber: 'LTX-SETTLE-01', status: 'POSTED' },
    }),
    releaseWalletHold: jest.fn().mockResolvedValue({}),
  };

  const mockAdapter = {
    submitOrder: jest.fn().mockResolvedValue({
      success: true,
      status: 'SUCCESS',
      pinCode: 'PIN-123456',
      providerOrderId: 'PROV-TX-999',
    }),
  };

  const mockProvidersService = {
    getAdapter: jest.fn().mockReturnValue(mockAdapter),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    supplierAccountRecord.balance = new Prisma.Decimal(10000);
    mockPrisma.supplierAccount.findFirst.mockImplementation(async () => supplierAccountRecord);
    mockPrisma.provider.findFirst.mockResolvedValue({ id: 'provider-mock', code: 'MOCK', currency: CurrencyCode.USD, balance: new Prisma.Decimal(10000) });
    mockPrisma.provider.findUnique.mockResolvedValue({ id: 'provider-mock', code: 'MOCK', currency: CurrencyCode.USD, balance: new Prisma.Decimal(10000) });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupplierBalanceService,
        FulfillmentService,
        { provide: ProvidersService, useValue: mockProvidersService },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LedgerService, useValue: mockLedgerService },
      ],
    }).compile();

    supplierBalanceService = module.get<SupplierBalanceService>(SupplierBalanceService);
    fulfillmentService = module.get<FulfillmentService>(FulfillmentService);
    ledgerService = module.get<LedgerService>(LedgerService);
  });

  describe('AT-16: Cash Movement vs Fulfillment Cost', () => {
    it('AT-16: Pre-funding provider commercial balance records balanced double-entry ledger without treating as COGS expense', async () => {
      const fundResult = await supplierBalanceService.fundSupplierBalance('user-finance-002', {
        providerId: 'MOCK',
        currency: CurrencyCode.USD,
        amount: 2500.0,
        referenceNumber: 'WIRE-CAC-998877',
        notes: 'تحويل بنكي خارجي لشحن الرصيد التجاري للمزود',
      });

      expect(fundResult.success).toBe(true);
      expect(fundResult.ledgerTxId).toBe('LTX-SUP-FUND-01');
      expect(mockLedgerService.recordSupplierFunding).toHaveBeenCalledWith(
        expect.objectContaining({
          providerCode: 'MOCK',
          currency: CurrencyCode.USD,
          amount: '2500',
          referenceNumber: 'WIRE-CAC-998877',
        }),
        mockPrisma,
      );

      // Check balance is updated
      const balanceInfo = await supplierBalanceService.getSupplierBalance('MOCK', CurrencyCode.USD);
      expect(balanceInfo.balance).toBeGreaterThanOrEqual(12500.0);
    });
  });

  describe('AT-16 / P05: Fulfillment Gating on Insufficient Commercial Balance', () => {
    it('halts order dispatch and holds order in ManualReview when provider commercial balance is insufficient', async () => {
      // Setup order with cost price exceeding provider available balance
      const mockOrder = {
        id: 'ord-gating-fail-1',
        orderNumber: 'ORD-GATING-FAIL-01',
        userId: 'cust-101',
        status: OrderStatus.Queued,
        snapshotServiceName: 'PUBG Mobile',
        snapshotRetailPrice: new Prisma.Decimal(100.0),
        snapshotCostPrice: new Prisma.Decimal(999999999.0), // Exceeds balance!
        snapshotCurrency: CurrencyCode.USD,
        snapshotBeneficiaryFields: { player_id: '12345678' },
        product: { sku: 'PUBG-BIG-PACK' },
        provider: { code: 'EXTERNAL_API' },
        user: {
          wallets: [
            {
              id: 'w-cust-usd',
              currency: CurrencyCode.USD,
              balance: new Prisma.Decimal(1000000000.0),
              lockedBalance: new Prisma.Decimal(100.0),
            },
          ],
        },
      };

      mockPrisma.order.findUnique
        .mockResolvedValueOnce(mockOrder)
        .mockResolvedValue({ ...mockOrder, status: OrderStatus.Processing });
      mockPrisma.order.update.mockResolvedValue({});

      const dispatchResult = await fulfillmentService.dispatchOrder('ord-gating-fail-1');

      // Fulfillment must be GATED
      expect(dispatchResult.success).toBe(false);
      expect(dispatchResult.status).toBe(OrderStatus.ManualReview);
      expect(dispatchResult.message).toContain('غير كافٍ');
      // Adapter must NOT have been called!
      expect(mockAdapter.submitOrder).not.toHaveBeenCalled();
    });

    it('AT-16: successfully dispatches order and deducts provider commercial balance when balance is sufficient', async () => {
      const mockOrder = {
        id: 'ord-gating-success-1',
        orderNumber: 'ORD-GATING-SUCCESS-01',
        userId: 'cust-101',
        status: OrderStatus.Queued,
        snapshotServiceName: 'PUBG Mobile',
        snapshotRetailPrice: new Prisma.Decimal(20.0),
        snapshotCostPrice: new Prisma.Decimal(15.0),
        snapshotCurrency: CurrencyCode.USD,
        snapshotBeneficiaryFields: { player_id: '12345678' },
        product: { sku: 'PUBG-SMALL-PACK' },
        provider: { code: 'MOCK' },
        user: {
          wallets: [
            {
              id: 'w-cust-usd',
              currency: CurrencyCode.USD,
              balance: new Prisma.Decimal(100.0),
              lockedBalance: new Prisma.Decimal(20.0),
            },
          ],
        },
      };

      mockPrisma.order.findUnique
        .mockResolvedValueOnce(mockOrder)
        .mockResolvedValue({ ...mockOrder, status: OrderStatus.Processing });
      mockPrisma.order.update.mockResolvedValue({});

      const beforeBalance = (await supplierBalanceService.getSupplierBalance('MOCK', CurrencyCode.USD)).balance;

      const dispatchResult = await fulfillmentService.dispatchOrder('ord-gating-success-1');

      expect(dispatchResult.success).toBe(true);
      expect(dispatchResult.status).toBe(OrderStatus.Completed);
      expect(mockAdapter.submitOrder).toHaveBeenCalledTimes(1);

      // Verify commercial balance deducted by cost price (15.0)
      const afterBalance = (await supplierBalanceService.getSupplierBalance('MOCK', CurrencyCode.USD)).balance;
      expect(afterBalance).toBe(beforeBalance - 15.0);
    });
  });
});
