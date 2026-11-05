import { Test, TestingModule } from '@nestjs/testing';
import { FulfillmentService } from './fulfillment.service';
import { PrismaService } from '../../database/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { ProvidersService } from './providers.service';
import { MockProviderAdapter } from './adapters/mock-provider.adapter';
import { ManualProviderAdapter } from './adapters/manual-provider.adapter';
import { ExternalApiAdapter } from './adapters/external-api.adapter';
import { OrdersService } from '../orders/orders.service';
import { DepositsService } from '../deposits/deposits.service';
import { WalletService } from '../wallet/wallet.service';
import { ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { SsrfValidator } from './utils/ssrf-validator.util';
import { validateProductionSecrets } from '../../main';
import { Logger } from '@nestjs/common';
import { CurrencyCode, OrderStatus } from '@digital-topup/shared';
import { HmacSignatureService } from '../../security/hmac-signature.service';

describe('SecurityGate (SG-03, SG-04, SG-05)', () => {
  let fulfillmentService: FulfillmentService;
  let mockAdapter: MockProviderAdapter;
  let externalAdapter: ExternalApiAdapter;

  const mockPrisma = {
    order: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn().mockResolvedValue({ id: 'ord-1' }),
    },
    depositRequest: {
      findUnique: jest.fn(),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({ id: 'aud-1' }),
    },
  };

  const mockLedgerService = {
    recordOrderSettlement: jest.fn().mockResolvedValue({}),
    releaseWalletHold: jest.fn().mockResolvedValue({}),
  };

  beforeAll(async () => {
    mockAdapter = new MockProviderAdapter();
    externalAdapter = new ExternalApiAdapter();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FulfillmentService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LedgerService, useValue: mockLedgerService },
        {
          provide: ProvidersService,
          useValue: {
            getAdapter: jest.fn().mockReturnValue(mockAdapter),
          },
        },
      ],
    }).compile();

    fulfillmentService = module.get<FulfillmentService>(FulfillmentService);
  });

  describe('SG-03: Provider Integrity & Sandbox Isolation in Production', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('should throw ForbiddenException if MockProviderAdapter is invoked in production', async () => {
      process.env.NODE_ENV = 'production';

      await expect(
        mockAdapter.submitOrder({
          orderId: 'ord-prod-1',
          orderNumber: 'ORD-20261010-001',
          providerSku: 'PUBG-60',
          playerFields: { player_id: '12345678' },
          amount: 0.99,
          currency: CurrencyCode.USD,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should halt fulfillment dispatch and forbid ledger settlement with MOCK provider in production', async () => {
      process.env.NODE_ENV = 'production';

      mockPrisma.order.findUnique.mockResolvedValueOnce({
        id: 'ord-prod-99',
        orderNumber: 'ORD-PROD-99',
        status: OrderStatus.Paid,
        snapshotRetailPrice: 10,
        snapshotCostPrice: 8,
        snapshotCurrency: CurrencyCode.USD,
        snapshotServiceName: 'PUBG Mobile',
        provider: { code: 'MOCK' },
        user: { wallets: [{ id: 'w-1', currency: CurrencyCode.USD }] },
      });

      await expect(
        fulfillmentService.dispatchOrder('ord-prod-99'),
      ).rejects.toThrow(ForbiddenException);

      // Verify that ledger settlement was NEVER called
      expect(mockLedgerService.recordOrderSettlement).not.toHaveBeenCalled();
    });
  });

  describe('SG-04: Object-Level Authorization (BOLA / IDOR Prevention)', () => {
    it('OrdersService should strictly block Customer A from reading Customer B order', async () => {
      const ordersService = new OrdersService(
        mockPrisma as any,
        mockLedgerService as any,
        {} as any,
        {} as any,
        {} as any,
      );

      mockPrisma.order.findFirst.mockResolvedValueOnce({
        id: 'order-101',
        orderNumber: 'ORD-101',
        userId: 'customer-b', // Belongs to customer B
      });

      // Customer A tries to access Customer B's order without staff privileges
      await expect(
        ordersService.getOrderById('customer-a', 'order-101', false),
      ).rejects.toThrow(ForbiddenException);
    });

    it('DepositsService should block Customer A from reading Customer B deposit request', async () => {
      const depositsService = new DepositsService(
        mockPrisma as any,
        mockLedgerService as any,
        {} as any,
        {} as any,
        new HmacSignatureService(),
      );

      mockPrisma.depositRequest.findUnique.mockResolvedValueOnce({
        id: 'dep-202',
        userId: 'customer-b', // Belongs to customer B
      });

      // Customer A tries to access Customer B's deposit
      await expect(
        depositsService.getDepositById('dep-202', 'customer-a', false),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('SG-04: SSRF Prevention in External HTTP Provider Adapter', () => {
    it('should block requests to Loopback IP (127.0.0.1)', () => {
      expect(() => {
        SsrfValidator.validateUrl('http://127.0.0.1:8080/api/topup');
      }).toThrow('SSRF Blocked');
    });

    it('should block requests to Localhost hostname', () => {
      expect(() => {
        SsrfValidator.validateUrl('http://localhost/admin');
      }).toThrow('SSRF Blocked');
    });

    it('should block requests to RFC 1918 Private Class A IP (10.0.0.1)', () => {
      expect(() => {
        SsrfValidator.validateUrl('http://10.0.0.1/webhook');
      }).toThrow('SSRF Blocked');
    });

    it('should block requests to RFC 1918 Private Class C IP (192.168.1.1)', () => {
      expect(() => {
        SsrfValidator.validateUrl('http://192.168.1.1/router');
      }).toThrow('SSRF Blocked');
    });

    it('should block requests to AWS/GCP Cloud Metadata IP (169.254.169.254)', () => {
      expect(() => {
        SsrfValidator.validateUrl('http://169.254.169.254/latest/meta-data/');
      }).toThrow('SSRF Blocked');
    });

    it('should enforce HTTPS protocol in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      expect(() => {
        SsrfValidator.validateUrl('http://api.topup-provider.com/submit');
      }).toThrow('يجب استخدام بروتوكول HTTPS المشفر');

      process.env.NODE_ENV = originalEnv;
    });

    it('should allow legitimate external HTTPS provider domains', () => {
      const parsed = SsrfValidator.validateUrl('https://api.topup-provider.com/v1/orders');
      expect(parsed.hostname).toBe('api.topup-provider.com');
      expect(parsed.protocol).toBe('https:');
    });
  });

  describe('SG-05: Startup Secrets Hygiene & Production Hardening', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalJwt = process.env.JWT_SECRET;
    const originalRefresh = process.env.JWT_REFRESH_SECRET;
    const originalEncryptionKey = process.env.ENCRYPTION_KEY;
    const originalWebhookSecret = process.env.WEBHOOK_HMAC_SECRET;
    const originalRedisUrl = process.env.REDIS_URL;
    const testLogger = new Logger('TestSecretsValidation');

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
      process.env.JWT_SECRET = originalJwt;
      process.env.JWT_REFRESH_SECRET = originalRefresh;
      process.env.ENCRYPTION_KEY = originalEncryptionKey;
      process.env.WEBHOOK_HMAC_SECRET = originalWebhookSecret;
      process.env.REDIS_URL = originalRedisUrl;
    });

    it('should throw Error and halt startup if JWT_SECRET is missing or default in production', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.JWT_SECRET;

      expect(() => {
        validateProductionSecrets(testLogger);
      }).toThrow('CRITICAL SECURITY GATE FAILURE');
    });

    it('should throw Error if JWT_SECRET is using insecure placeholder in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'digital-topup-jwt-access-token-secret-replace-in-production-key-998877';

      expect(() => {
        validateProductionSecrets(testLogger);
      }).toThrow('CRITICAL SECURITY GATE FAILURE');
    });

    it('should succeed startup if strong custom secrets (>= 32 chars) are configured in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'a-very-strong-production-jwt-access-token-secret-key-2026-xyz!';
      process.env.JWT_REFRESH_SECRET = 'a-very-strong-production-jwt-refresh-token-secret-key-2026-xyz!';
      process.env.ENCRYPTION_KEY = 'c'.repeat(64);
      process.env.WEBHOOK_HMAC_SECRET = 'webhook-production-secret-'.repeat(2);
      process.env.REDIS_URL = 'redis://localhost:6379';

      expect(() => {
        validateProductionSecrets(testLogger);
      }).not.toThrow();
    });
  });
});
