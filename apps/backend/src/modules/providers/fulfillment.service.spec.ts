import { Test, TestingModule } from '@nestjs/testing';
import { FulfillmentService } from './fulfillment.service';
import { PrismaService } from '../../database/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { ProvidersService } from './providers.service';
import { OrderStatus, CurrencyCode } from '@digital-topup/shared';
import { Prisma } from '@prisma/client';

describe('FulfillmentService (Phase 3 — Reliable Queue & Settlement)', () => {
  let service: FulfillmentService;

  const mockOrder = {
    id: 'ord-test-1',
    orderNumber: 'ORD-20261009-0001',
    userId: 'cust-101',
    status: OrderStatus.Queued,
    snapshotServiceName: 'PUBG Mobile',
    snapshotRetailPrice: new Prisma.Decimal(550.0),
    snapshotCostPrice: new Prisma.Decimal(495.0),
    snapshotCurrency: CurrencyCode.YER,
    snapshotBeneficiaryFields: { player_id: '5123456789' },
    product: { sku: 'PUBG-60-UC' },
    provider: { code: 'MOCK' },
    user: {
      wallets: [
        {
          id: 'wallet-yer-1',
          currency: CurrencyCode.YER,
          balance: new Prisma.Decimal(50000.0),
          lockedBalance: new Prisma.Decimal(550.0),
        },
      ],
    },
  };

  const mockPrisma = {
    order: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    wallet: {
      findUnique: jest.fn(),
    },
    manualFulfillment: {
      upsert: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrisma)),
  };

  const mockLedgerService = {
    recordOrderSettlement: jest.fn(),
    releaseWalletHold: jest.fn(),
    recordOrderRefund: jest.fn(),
    recordAgentCommission: jest.fn(),
    reverseAgentCommission: jest.fn(),
  };

  const mockAdapter = {
    submitOrder: jest.fn(),
  };

  const mockProvidersService = {
    getAdapter: jest.fn().mockReturnValue(mockAdapter),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FulfillmentService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LedgerService, useValue: mockLedgerService },
        { provide: ProvidersService, useValue: mockProvidersService },
      ],
    }).compile();

    service = module.get<FulfillmentService>(FulfillmentService);
  });

  describe('dispatchOrder', () => {
    it('1. should complete order and settle ledger on provider success', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
      mockAdapter.submitOrder.mockResolvedValue({
        status: 'SUCCESS',
        success: true,
        providerOrderId: 'MOCK-TX-7788',
        pinCode: 'PUBG-PIN-9988',
      });

      const res = await service.dispatchOrder('ord-test-1');

      expect(res.status).toBe(OrderStatus.Completed);
      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ord-test-1' },
          data: expect.objectContaining({
            status: OrderStatus.Completed,
            voucherCode: 'PUBG-PIN-9988',
          }),
        }),
      );
      expect(mockLedgerService.recordOrderSettlement).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: mockOrder.orderNumber,
          retailPrice: 550,
          costPrice: 495,
        }),
      );
    });

    it('2. should mark order failed and release balance hold on provider rejection', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
      mockAdapter.submitOrder.mockResolvedValue({
        status: 'FAILED',
        success: false,
        errorMessage: 'Player ID banned',
      });

      const res = await service.dispatchOrder('ord-test-1');

      expect(res.status).toBe(OrderStatus.Failed);
      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: OrderStatus.Failed,
            errorMessage: 'Player ID banned',
          }),
        }),
      );
      expect(mockLedgerService.releaseWalletHold).toHaveBeenCalledWith('wallet-yer-1', 550);
    });

    it('3. should move order to ManualReview and preserve balance hold on timeout', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
      mockAdapter.submitOrder.mockResolvedValue({
        status: 'PENDING',
        success: false,
        errorMessage: 'Provider gateway timeout',
      });

      const res = await service.dispatchOrder('ord-test-1');

      expect(res.status).toBe(OrderStatus.ManualReview);
      expect(mockLedgerService.releaseWalletHold).not.toHaveBeenCalled();
      expect(mockLedgerService.recordOrderSettlement).not.toHaveBeenCalled();
    });

    it('should credit reseller commission only after successful ledger settlement', async () => {
      const commissionOrder = {
        ...mockOrder,
        agentParentUserId: 'reseller-1',
        agentCommissionAmount: new Prisma.Decimal(5),
      };
      mockPrisma.order.findUnique
        .mockResolvedValueOnce(commissionOrder)
        .mockResolvedValueOnce(commissionOrder);
      mockPrisma.wallet.findUnique.mockResolvedValue({ id: 'reseller-wallet-1' });
      mockAdapter.submitOrder.mockResolvedValue({
        status: 'SUCCESS',
        success: true,
        providerOrderId: 'MOCK-TX-7789',
      });

      await service.dispatchOrder('ord-test-1');

      expect(mockLedgerService.recordAgentCommission).toHaveBeenCalledWith(
        expect.objectContaining({
          parentAgentId: 'reseller-1',
          orderId: commissionOrder.orderNumber,
          walletId: 'reseller-wallet-1',
          amount: 5,
        }),
      );
    });
  });

  describe('fulfillManualOrder', () => {
    it('4. should fulfill order manually, record proof, and settle ledger', async () => {
      mockPrisma.order.findUnique
        .mockResolvedValueOnce({
          ...mockOrder,
          status: OrderStatus.ManualReview,
        })
        .mockResolvedValueOnce({
          ...mockOrder,
          status: OrderStatus.Completed,
        });

      await service.fulfillManualOrder('staff-op-1', 'ord-test-1', {
        voucherCode: 'MANUAL-PIN-5544',
        proofScreenshotUrl: 'https://proofs.com/receipt-1.jpg',
        operatorNotes: 'تم التسليم بالاتصال مع الموزع',
      });

      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: OrderStatus.Completed,
            voucherCode: 'MANUAL-PIN-5544',
          }),
        }),
      );
      expect(mockLedgerService.recordOrderSettlement).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: mockOrder.orderNumber,
          providerCode: 'MANUAL',
        }),
      );
    });
  });

  describe('refundOrder', () => {
    it('5. should refund completed order and reverse double-entry transaction', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.Completed,
      });

      await service.refundOrder('staff-admin-1', 'ord-test-1', {
        reason: 'استرجاع بناء على شكوى العميل',
      });

      expect(mockLedgerService.recordOrderRefund).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: mockOrder.orderNumber,
          amount: 550,
          reason: 'استرجاع بناء على شكوى العميل',
        }),
      );
      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: OrderStatus.Refunded,
          }),
        }),
      );
    });
  });
});
