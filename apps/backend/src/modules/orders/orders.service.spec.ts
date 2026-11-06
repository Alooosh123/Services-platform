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
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('OrdersService (Phase 3 — Real Shopping & Fulfillment)', () => {
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
      { currency: CurrencyCode.YER, retailPrice: new Prisma.Decimal(550), costPrice: new Prisma.Decimal(495), isAvailable: true },
      { currency: CurrencyCode.USD, retailPrice: new Prisma.Decimal(1.05), costPrice: new Prisma.Decimal(0.95), isAvailable: true },
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
    userId: 'cust-101',
    currency: CurrencyCode.YER,
    balance: new Prisma.Decimal(10000.0),
    lockedBalance: new Prisma.Decimal(0.0),
    isFrozen: false,
    frozenReason: null,
  };

  const mockPrisma = {
    order: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    product: {
      findUnique: jest.fn(),
    },
    wallet: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    productTierPrice: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    agentProductPrice: {
      findUnique: jest.fn(),
    },
  };

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
    mockPrisma.user.findUnique.mockResolvedValue({
      role: 'CUSTOMER',
      tierId: null,
      tier: null,
      parentAgentId: null,
      agentPricingMode: 'PERCENTAGE',
      parentAgentCommissionPercent: 0,
      parentAgent: null,
    });
    mockPrisma.productTierPrice.findFirst.mockResolvedValue(null);
    mockPrisma.agentProductPrice.findUnique.mockResolvedValue(null);

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

  describe('createOrder (Checkout Flow)', () => {
    it('1. should successfully create order, hold balance, and trigger fulfillment', async () => {
      mockPrisma.order.findUnique
        .mockResolvedValueOnce(null) // Idempotency check
        .mockResolvedValueOnce({
          id: 'ord-created-1',
          orderNumber: 'ORD-12345',
          status: OrderStatus.Completed,
          snapshotRetailPrice: 550,
          snapshotCurrency: CurrencyCode.YER,
        });

      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      mockPrisma.wallet.findUnique.mockResolvedValue(mockWalletYer);

      mockPrisma.order.create.mockResolvedValue({
        id: 'ord-created-1',
        orderNumber: 'ORD-12345',
        status: OrderStatus.Queued,
      });

      const result = await service.createOrder('cust-101', {
        productId: 'prod-pubg-60',
        currency: CurrencyCode.YER,
        playerFields: { player_id: '5123456789' },
        idempotencyKey: 'IDEMP-TEST-001',
        paymentMethod: PaymentChannelCode.WALLET,
      });

      expect(mockLedgerService.holdWalletBalance).toHaveBeenCalledWith('wallet-cust-yer', 550);
      expect(mockPrisma.order.create).toHaveBeenCalled();
      expect(mockFulfillmentService.dispatchOrder).toHaveBeenCalledWith('ord-created-1');
      expect(result).toBeDefined();
    });

    it('2. should reject checkout if wallet balance is insufficient', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      mockPrisma.wallet.findUnique.mockResolvedValue(mockWalletYer);

      mockLedgerService.holdWalletBalance.mockRejectedValue(
        new BadRequestException('الرصيد المتاح غير كافٍ'),
      );

      await expect(
        service.createOrder('cust-101', {
          productId: 'prod-pubg-60',
          currency: CurrencyCode.YER,
          playerFields: { player_id: '5123456789' },
          idempotencyKey: 'IDEMP-FAIL-BAL',
          paymentMethod: PaymentChannelCode.WALLET,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('3. should reject checkout if wallet is frozen', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      mockPrisma.wallet.findUnique.mockResolvedValue({
        ...mockWalletYer,
        isFrozen: true,
        frozenReason: 'تجميد إداري',
      });

      mockLedgerService.holdWalletBalance.mockRejectedValue(
        new BadRequestException('المحفظة مجمدة'),
      );

      await expect(
        service.createOrder('cust-101', {
          productId: 'prod-pubg-60',
          currency: CurrencyCode.YER,
          playerFields: { player_id: '5123456789' },
          idempotencyKey: 'IDEMP-FROZEN',
          paymentMethod: PaymentChannelCode.WALLET,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('4. should replay existing order on duplicate idempotency key without recharging', async () => {
      const existing = {
        id: 'ord-existing-99',
        orderNumber: 'ORD-EXISTING-99',
        status: OrderStatus.Completed,
      };
      mockPrisma.order.findUnique.mockResolvedValue(existing);

      const result = await service.createOrder('cust-101', {
        productId: 'prod-pubg-60',
        playerFields: { player_id: '5123456789' },
        idempotencyKey: 'IDEMP-DUPLICATE-REPLAY',
      });

      expect(result).toEqual(existing);
      expect(mockLedgerService.holdWalletBalance).not.toHaveBeenCalled();
      expect(mockPrisma.order.create).not.toHaveBeenCalled();
    });

    it('5. should reject checkout if submitted player field fails regex validation', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);

      // Regex requires 5-15 digits. Passing letters:
      await expect(
        service.createOrder('cust-101', {
          productId: 'prod-pubg-60',
          playerFields: { player_id: 'INVALID_LETTERS' },
          idempotencyKey: 'IDEMP-REGEX-FAIL',
        }),
      ).rejects.toThrow(/Invalid format/);
    });

    it('should apply a configured branch price and snapshot the reseller commission', async () => {
      mockPrisma.order.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'ord-custom-price' });
      mockPrisma.user.findUnique.mockResolvedValue({
        role: 'SUB_AGENT',
        tierId: null,
        tier: null,
        parentAgentId: 'reseller-1',
        agentPricingMode: 'CUSTOM_PRICE',
        parentAgentCommissionPercent: new Prisma.Decimal(10),
        parentAgent: { id: 'reseller-1', tierId: 'reseller-tier', isActive: true },
      });
      mockPrisma.agentProductPrice.findUnique.mockResolvedValue({
        retailPrice: new Prisma.Decimal(700),
        isActive: true,
      });
      mockPrisma.productTierPrice.findFirst.mockResolvedValue({
        retailPrice: new Prisma.Decimal(550),
        isActive: true,
      });
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      mockPrisma.order.create.mockResolvedValue({ id: 'ord-custom-price' });

      await service.createOrder('branch-1', {
        productId: 'prod-pubg-60',
        currency: CurrencyCode.YER,
        playerFields: { player_id: '5123456789' },
        idempotencyKey: 'IDEMP-CUSTOM-PRICE',
        paymentMethod: PaymentChannelCode.JAIB,
      });

      expect(mockPrisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            snapshotRetailPrice: new Prisma.Decimal(700),
            agentParentUserId: 'reseller-1',
            agentCommissionAmount: new Prisma.Decimal(150),
          }),
        }),
      );
    });
  });

  describe('getOrderById (Customer Isolation & Security)', () => {
    it('6. should allow customer to view their own order', async () => {
      mockPrisma.order.findFirst.mockResolvedValue({
        id: 'ord-123',
        userId: 'cust-101',
        orderNumber: 'ORD-123',
      });

      const order = await service.getOrderById('cust-101', 'ord-123', false);
      expect(order).toBeDefined();
      expect(order.id).toBe('ord-123');
    });

    it('7. should forbid customer from viewing another customer order', async () => {
      mockPrisma.order.findFirst.mockResolvedValue({
        id: 'ord-456',
        userId: 'other-user-999',
        orderNumber: 'ORD-456',
      });

      await expect(
        service.getOrderById('cust-101', 'ord-456', false),
      ).rejects.toThrow(ForbiddenException);
    });

    it('8. should allow admin/staff to view any customer order', async () => {
      mockPrisma.order.findFirst.mockResolvedValue({
        id: 'ord-456',
        userId: 'other-user-999',
        orderNumber: 'ORD-456',
      });

      const order = await service.getOrderById('staff-admin-1', 'ord-456', true);
      expect(order).toBeDefined();
      expect(order.id).toBe('ord-456');
    });
  });

  describe('Admin Operations (Manual Fulfillment & Refunds)', () => {
    it('9. should delegate manual fulfillment to FulfillmentService', async () => {
      mockFulfillmentService.fulfillManualOrder.mockResolvedValue({
        id: 'ord-123',
        status: OrderStatus.Completed,
      });

      const res = await service.adminManualFulfill('staff-1', 'ord-123', {
        voucherCode: 'PUBG-PIN-1234',
        operatorNotes: 'تم التسليم يدوياً',
      });

      expect(mockFulfillmentService.fulfillManualOrder).toHaveBeenCalledWith('staff-1', 'ord-123', {
        voucherCode: 'PUBG-PIN-1234',
        operatorNotes: 'تم التسليم يدوياً',
      });
      expect(res.status).toBe(OrderStatus.Completed);
    });

    it('10. should delegate refund to FulfillmentService', async () => {
      mockFulfillmentService.refundOrder.mockResolvedValue({
        id: 'ord-123',
        status: OrderStatus.Refunded,
      });

      const res = await service.adminRefundOrder('staff-1', 'ord-123', {
        reason: 'طلب العميل إلغاء الشحنة',
      });

      expect(mockFulfillmentService.refundOrder).toHaveBeenCalledWith('staff-1', 'ord-123', {
        reason: 'طلب العميل إلغاء الشحنة',
      });
      expect(res.status).toBe(OrderStatus.Refunded);
    });
  });
});
