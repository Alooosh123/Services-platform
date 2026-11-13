import { Test, TestingModule } from '@nestjs/testing';
import { DepositsService } from './deposits.service';
import {
  PaymentAdapterRegistry,
  JaibPaymentAdapter,
  JawaliPaymentAdapter,
  CashPaymentAdapter,
  OneCashPaymentAdapter,
  EasyPaymentAdapter,
  SandboxPaymentAdapter,
} from './adapters/yemen-payment.adapters';
import { PrismaService } from '../../database/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { WalletService } from '../wallet/wallet.service';
import {
  CurrencyCode,
  PaymentChannelCode,
  PaymentChannelMode,
  DepositStatus,
} from '@digital-topup/shared';
import { BadRequestException } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { HmacSignatureService } from '../../security/hmac-signature.service';

describe('Phase 05 — Inbound Payment Webhooks, Idempotency & Channel Safe Mode', () => {
  let depositsService: DepositsService;
  let adapterRegistry: PaymentAdapterRegistry;
  let ledgerService: LedgerService;

  const mockPrisma = {
    paymentChannelConfig: { findMany: jest.fn().mockResolvedValue([]) },
    depositRequest: {
      findUnique: jest.fn().mockRejectedValue(new Error('Prisma offline in test')),
      findFirst: jest.fn().mockRejectedValue(new Error('Prisma offline in test')),
      create: jest.fn().mockRejectedValue(new Error('Prisma offline in test')),
      update: jest.fn().mockRejectedValue(new Error('Prisma offline in test')),
    },
    user: {
      findFirst: jest.fn().mockRejectedValue(new Error('Prisma offline in test')),
    },
    wallet: {
      findUnique: jest.fn().mockRejectedValue(new Error('Prisma offline in test')),
      update: jest.fn().mockRejectedValue(new Error('Prisma offline in test')),
    },
  };

  const mockLedgerService = {
    recordTopup: jest.fn().mockResolvedValue({
      transaction: { id: 'LTX-TEST-WBX-01', txNumber: 'LTX-WBX-001', status: 'POSTED' },
    }),
  };

  const mockWalletService = {
    getWallet: jest.fn().mockResolvedValue({
      id: 'w-cust-yer',
      userId: 'user-customer-003',
      currency: CurrencyCode.YER,
      balance: 100000,
      lockedBalance: 0,
      isFrozen: false,
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
    DepositsService,
    PaymentAdapterRegistry,
    JaibPaymentAdapter,
    JawaliPaymentAdapter,
    CashPaymentAdapter,
    OneCashPaymentAdapter,
    EasyPaymentAdapter,
    SandboxPaymentAdapter,
    { provide: PrismaService, useValue: mockPrisma },
    { provide: LedgerService, useValue: mockLedgerService },
    { provide: WalletService, useValue: mockWalletService },
    { provide: HmacSignatureService, useValue: new HmacSignatureService() },
      ],
    }).compile();

    depositsService = module.get<DepositsService>(DepositsService);
    adapterRegistry = module.get<PaymentAdapterRegistry>(PaymentAdapterRegistry);
    ledgerService = module.get<LedgerService>(LedgerService);
  });

  describe('P05 Acceptance Criteria: Duplicate Webhook Idempotency', () => {
    it('مكرر webhook لا يضيف رصيدًا مرتين: Duplicate webhook notification does NOT credit wallet or ledger twice', async () => {
      // Create a customer deposit first
      const createRes = await depositsService.createDepositRequest('user-customer-003', {
        currency: CurrencyCode.YER,
        amount: 50000,
        paymentMethodCode: PaymentChannelCode.JAIB,
        referenceNumber: 'REF-IDEMP-JAIB-99',
        senderPhone: '+967770000003',
      });

      expect(createRes.success).toBe(true);
      expect(createRes.deposit.status).toBe(DepositStatus.PENDING);

      // Webhook arrival #1: First delivery -> Credits deposit atomically
      const firstWebhook = await depositsService.handleInboundWebhook(PaymentChannelCode.JAIB, {
        channelCode: PaymentChannelCode.JAIB,
        transactionReference: 'REF-IDEMP-JAIB-99',
        amount: 50000,
        currency: CurrencyCode.YER,
        beneficiaryAccount: '770123456',
        senderPhone: '+967770000003',
      });

      expect(firstWebhook.success).toBe(true);
      expect(firstWebhook.status).toBe('CREDITED');
      expect(mockLedgerService.recordTopup).toHaveBeenCalledTimes(1);

      // Webhook arrival #2: Duplicate delivery (same reference)
      const secondWebhook = await depositsService.handleInboundWebhook(PaymentChannelCode.JAIB, {
        channelCode: PaymentChannelCode.JAIB,
        transactionReference: 'REF-IDEMP-JAIB-99',
        amount: 50000,
        currency: CurrencyCode.YER,
        beneficiaryAccount: '770123456',
        senderPhone: '+967770000003',
      });

      // MUST NOT credit wallet or ledger a second time!
      expect(secondWebhook.success).toBe(true);
      expect(secondWebhook.status).toBe('DUPLICATE');
      expect(secondWebhook.message).toContain('Idempotency Handled - No Double Credit');
      expect(mockLedgerService.recordTopup).toHaveBeenCalledTimes(1); // STILL 1, NEVER 2!
    });
  });

  describe('Timestamped webhook signature verification', () => {
    const originalSecret = process.env.WEBHOOK_HMAC_SECRET;

    afterAll(() => {
      if (originalSecret === undefined) {
        delete process.env.WEBHOOK_HMAC_SECRET;
      } else {
        process.env.WEBHOOK_HMAC_SECRET = originalSecret;
      }
    });

    it('rejects missing signatures when webhook signing is configured', async () => {
      process.env.WEBHOOK_HMAC_SECRET = 'webhook-test-secret-'.repeat(2);
      await expect(
        depositsService.handleInboundWebhook(PaymentChannelCode.JAIB, {
          transactionReference: 'REF-SIGNED-001',
          amount: 500,
          currency: CurrencyCode.YER,
        } as any),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a replayed timestamp even when the HMAC is otherwise valid', async () => {
      process.env.WEBHOOK_HMAC_SECRET = 'webhook-test-secret-'.repeat(2);
      const rawBody = Buffer.from('{"transactionReference":"REF-SIGNED-002"}');
      const timestamp = String(Math.floor(Date.now() / 1000) - 301);
      const signature = new HmacSignatureService().sign(rawBody, process.env.WEBHOOK_HMAC_SECRET, Number(timestamp));

      await expect(
        depositsService.handleInboundWebhook(
          PaymentChannelCode.JAIB,
          {
            transactionReference: 'REF-SIGNED-002',
            amount: 500,
            currency: CurrencyCode.YER,
          } as any,
          signature,
          timestamp,
          rawBody,
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('accepts a correctly signed raw request body with a fresh timestamp', async () => {
      process.env.WEBHOOK_HMAC_SECRET = 'webhook-test-secret-'.repeat(2);
      const referenceNumber = 'REF-SIGNED-VALID-003';
      await depositsService.createDepositRequest('user-customer-003', {
        currency: CurrencyCode.YER,
        amount: 500,
        paymentMethodCode: PaymentChannelCode.JAIB,
        referenceNumber,
        senderPhone: '+967770000003',
      });

      const payload = {
        channelCode: PaymentChannelCode.JAIB,
        transactionReference: referenceNumber,
        amount: 500,
        currency: CurrencyCode.YER,
        beneficiaryAccount: '770123456',
        senderPhone: '+967770000003',
      };
      const rawBody = Buffer.from(JSON.stringify(payload));
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = new HmacSignatureService().sign(
        rawBody,
        process.env.WEBHOOK_HMAC_SECRET,
        Number(timestamp),
      );

      const result = await depositsService.handleInboundWebhook(
        PaymentChannelCode.JAIB,
        payload,
        signature,
        timestamp,
        rawBody,
      );

      expect(result.success).toBe(true);
      expect(result.status).toBe('CREDITED');
    });
  });

  describe('P05 Acceptance Criteria: Mismatch Guard (Amount / Currency)', () => {
    it('مرجع إيداع لا يطابق المبلغ أو العملة لا يعتمد تلقائيًا: Amount or currency mismatch is rejected from auto-crediting', async () => {
      // Customer requested 50,000 YER
      await depositsService.createDepositRequest('user-customer-003', {
        currency: CurrencyCode.YER,
        amount: 50000,
        paymentMethodCode: PaymentChannelCode.JAIB,
        referenceNumber: 'REF-MISMATCH-001',
        senderPhone: '+967770000003',
      });

      // Bank webhook arrives with mismatched amount: 45,000 YER
      const webhookRes = await depositsService.handleInboundWebhook(PaymentChannelCode.JAIB, {
        channelCode: PaymentChannelCode.JAIB,
        transactionReference: 'REF-MISMATCH-001',
        amount: 45000, // MISMATCH
        currency: CurrencyCode.YER,
        beneficiaryAccount: '770123456',
        senderPhone: '+967770000003',
      });

      // MUST NOT auto-credit
      expect(webhookRes.success).toBe(false);
      expect(webhookRes.status).toBe('MANUAL_REVIEW');
      expect(webhookRes.discrepancy).toBe('AMOUNT_OR_CURRENCY_MISMATCH');
      expect(mockLedgerService.recordTopup).not.toHaveBeenCalled();

      // Check deposit status is held in UNDER_REVIEW
      const dep = await depositsService.getDepositById(webhookRes.depositNumber ? (await depositsService.findDepositByReference('REF-MISMATCH-001')).id : 'any');
      expect(dep.status).toBe(DepositStatus.UNDER_REVIEW);
      expect(dep.reviewNotes).toContain('المطلوب 50000 YER، والمستلم 45000 YER');
    });

    it('rejects webhook if beneficiary receiving account does not match platform registered account', async () => {
      const webhookRes = await depositsService.handleInboundWebhook(PaymentChannelCode.JAIB, {
        channelCode: PaymentChannelCode.JAIB,
        transactionReference: 'REF-BENEF-FAKE-01',
        amount: 10000,
        currency: CurrencyCode.YER,
        beneficiaryAccount: 'WRONG_ACCOUNT_NUMBER', // Fraud / Wrong beneficiary
      });

      expect(webhookRes.success).toBe(false);
      expect(webhookRes.status).toBe('REJECTED');
      expect(webhookRes.discrepancy).toBe('BENEFICIARY_MISMATCH');
    });
  });

;
});
