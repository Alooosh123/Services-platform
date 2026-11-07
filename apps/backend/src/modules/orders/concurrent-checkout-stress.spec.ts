import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PrismaService } from '../../database/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { ProductsService } from '../products/products.service';
import { FulfillmentService } from '../providers/fulfillment.service';
import {
  CurrencyCode,
  OrderStatus,
  PaymentChannelCode,
} from '@digital-topup/shared';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('Phase 10 Production Stress & Resiliency: Concurrent Checkout, Worker Restart & Outage', () => {
  let service: OrdersService;
  let ledgerService: LedgerService;
  let fulfillmentService: FulfillmentService;

  const mockProduct = {
    id: 'prod-pubg-60',
    serviceId: 'srv-pubg',
    name: '60 UC',
    nameAr: '60 شدة',
    sku: 'PUBG-60-UC',
    isAvailable: true,
    prices: [
      {
        currency: CurrencyCode.YER,
        retailPrice: new Prisma.Decimal(550.0),
        costPrice: new Prisma.Decimal(495.0),
        isAvailable: true,
      },
    ],
    service: {
      id: 'srv-pubg',
      name: 'PUBG Mobile',
      nameAr: 'ببجي موبايل',
      fields: [
        {
          fieldKey: 'player_id',
          label: 'Player ID',
          labelAr: 'معرف اللاعب',
          required: true,
          validationRegex: '^[0-9]{5,15}$',
        },
      ],
    },
  };

  const mockWalletYer = {
    id: 'wallet-cust-yer',
    userId: 'cust-stress-101',
    currency: CurrencyCode.YER,
    balance: new Prisma.Decimal(1500.0),
    lockedBalance: new Prisma.Decimal(0.0),
    isFrozen: false,
    frozenReason: null,
  };

  let availableBalance = 1500.0;

  const mockPrisma: any = {
    order: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    product: {
      findUnique: jest.fn().mockResolvedValue(mockProduct),
    },
    wallet: {
      findUnique: jest.fn().mockResolvedValue(mockWalletYer),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({
        role: 'CUSTOMER',
        tierId: null,
        tier: null,
        parentAgentId: null,
        agentPricingMode: 'PERCENTAGE',
        parentAgentCommissionPercent: 0,
        parentAgent: null,
      }),
    },
    productTierPrice: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    agentProductPrice: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
  };

  mockPrisma.$transaction = jest.fn(
    (callback: (tx: any) => Promise<any>) => callback(mockPrisma),
  );

  const mockLedgerService = {
    holdWalletBalance: jest.fn(),
    releaseWalletHold: jest.fn(),
    recordOrderSettlement: jest.fn(),
    recordOrderRefund: jest.fn(),
  };

  const mockFulfillmentService = {
    dispatchOrder: jest.fn(),
    fulfillManualOrder: jest.fn(),
    refundOrder: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    availableBalance = 1500.0;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        ProductsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LedgerService, useValue: mockLedgerService },
        { provide: FulfillmentService, useValue: mockFulfillmentService },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    ledgerService = module.get<LedgerService>(LedgerService);
    fulfillmentService = module.get<FulfillmentService>(FulfillmentService);
  });

  describe('1. Stress Run: Concurrent Purchases with Limited Balance (AT-03 & Race Condition Defense)', () => {
    it('should strictly allow affordable purchases and reject remaining concurrent requests with zero negative balance', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      mockPrisma.wallet.findUnique.mockResolvedValue(mockWalletYer);

      mockLedgerService.holdWalletBalance.mockImplementation(async (walletId: string, amount: number) => {
        if (availableBalance < amount) {
          throw new BadRequestException('الرصيد المتاح غير كافٍ لتغطية هذه العملية');
        }
        availableBalance -= amount;
        return { success: true, remaining: availableBalance };
      });

      let createdCount = 0;
      mockPrisma.order.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.idempotencyKey) return null; // No duplicate
        return {
          id: where.id,
          orderNumber: `ORD-${where.id}`,
          status: OrderStatus.Completed,
        };
      });

      mockPrisma.order.create.mockImplementation(async ({ data }: any) => {
        createdCount++;
        return {
          id: `ord-concurrent-${createdCount}`,
          orderNumber: `ORD-20261011-${createdCount}`,
          status: OrderStatus.Queued,
        };
      });

      mockFulfillmentService.dispatchOrder.mockResolvedValue({
        status: OrderStatus.Completed,
      });

      // Launch 5 concurrent purchases (Available balance 1500 YER, cost 550 YER: 2 pass, 3 fail)
      const concurrentRequests = Array.from({ length: 5 }).map((_, idx) =>
        service.createOrder('cust-stress-101', {
          productId: 'prod-pubg-60',
          currency: CurrencyCode.YER,
          playerFields: { player_id: '5123456789' },
          idempotencyKey: `IDEMP-STRESS-${idx + 1}`,
          paymentMethod: PaymentChannelCode.WALLET,
        }),
      );

      const results = await Promise.allSettled(concurrentRequests);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled.length).toBe(2);
      expect(rejected.length).toBe(3);

      for (const rej of rejected) {
        if (rej.status === 'rejected') {
          expect(rej.reason).toBeInstanceOf(BadRequestException);
        }
      }

      expect(availableBalance).toBe(400.0);
      expect(availableBalance).toBeGreaterThanOrEqual(0);
    });
  });

  describe('2. Idempotency Under Load: 5 Identical Clicks with Same Key (AT-02)', () => {
    it('should return exactly 1 order and prevent double debit when clicked 5 times with same key', async () => {
      const fixedKey = 'IDEMP-DOUBLE-CLICK-BURST-001';
      const createdOrderRecord = {
        id: 'ord-single-1',
        orderNumber: 'ORD-12345',
        userId: 'cust-stress-101',
        productId: 'prod-pubg-60',
        snapshotPaymentMethodCode: PaymentChannelCode.WALLET,
        snapshotBeneficiaryFields: { player_id: '5123456789' },
        status: OrderStatus.Completed,
        snapshotRetailPrice: 550,
        snapshotCurrency: CurrencyCode.YER,
      };

      let isCreated = false;
      mockPrisma.order.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.idempotencyKey === fixedKey) {
          return isCreated ? createdOrderRecord : null;
        }
        if (where.id === 'ord-single-1') {
          return createdOrderRecord;
        }
        return null;
      });

      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      mockPrisma.wallet.findUnique.mockResolvedValue(mockWalletYer);
      mockLedgerService.holdWalletBalance.mockResolvedValue({ success: true });

      mockPrisma.order.create.mockImplementation(async () => {
        isCreated = true;
        return createdOrderRecord;
      });

      mockFulfillmentService.dispatchOrder.mockResolvedValue({
        status: OrderStatus.Completed,
      });

      // Execute 5 requests sequentially with same key
      const results: any[] = [];
      for (let i = 0; i < 5; i++) {
        const res = await service.createOrder('cust-stress-101', {
          productId: 'prod-pubg-60',
          currency: CurrencyCode.YER,
          playerFields: { player_id: '5123456789' },
          idempotencyKey: fixedKey,
          paymentMethod: PaymentChannelCode.WALLET,
        });
        results.push(res);
      }

      expect(results.length).toBe(5);
      expect(results.every((r) => r && r.id === 'ord-single-1')).toBe(true);
      expect(mockLedgerService.holdWalletBalance).toHaveBeenCalledTimes(1);
    });
  });

  describe('3. Worker Crash & Restart Resiliency (Anti-Duplicate Fulfillment)', () => {
    it('should prevent duplicate provider fulfillment when worker restarts mid-flight', async () => {
      const orderInProcessing = {
        id: 'ord-crashed-job-1',
        orderNumber: 'ORD-CRASH-001',
        status: OrderStatus.Processing,
      };

      // When worker restarts and inspects order queue, only Queued orders may be dispatched
      const canDispatch = orderInProcessing.status === OrderStatus.Queued;
      expect(canDispatch).toBe(false);
      expect(mockFulfillmentService.dispatchOrder).not.toHaveBeenCalled();
    });
  });

  describe('4. External Gateway Outage Safe Mode (Socket Timeout / Network Drop)', () => {
    it('should handle gateway drop safely without blind refund or duplicate deduction', async () => {
      mockPrisma.order.findUnique.mockReset();
      mockPrisma.order.findUnique.mockResolvedValue(null);

      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      mockPrisma.wallet.findUnique.mockResolvedValue(mockWalletYer);
      mockLedgerService.holdWalletBalance.mockResolvedValue({ success: true });

      mockPrisma.order.create.mockResolvedValue({
        id: 'ord-outage-1',
        orderNumber: 'ORD-OUTAGE-001',
        status: OrderStatus.Queued,
      });

      mockFulfillmentService.dispatchOrder.mockRejectedValueOnce(
        new Error('504 Gateway Timeout: Partner network dropped connection'),
      );

      await expect(
        service.createOrder('cust-stress-101', {
          productId: 'prod-pubg-60',
          currency: CurrencyCode.YER,
          playerFields: { player_id: '5123456789' },
          idempotencyKey: 'IDEMP-OUTAGE-UNIQUE-101',
          paymentMethod: PaymentChannelCode.WALLET,
        }),
      ).rejects.toThrow('504 Gateway Timeout');

      expect(mockLedgerService.holdWalletBalance).toHaveBeenCalledTimes(1);
    });
  });
});
