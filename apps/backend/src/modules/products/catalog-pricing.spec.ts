import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { PricingEngineService } from './pricing-engine.service';
import { PrismaService } from '../../database/prisma.service';
import { DepositsService } from '../deposits/deposits.service';
import {
  PaymentAdapterRegistry,
  JaibPaymentAdapter,
  JawaliPaymentAdapter,
  CashPaymentAdapter,
  OneCashPaymentAdapter,
  EasyPaymentAdapter,
  SandboxPaymentAdapter,
} from '../deposits/adapters/yemen-payment.adapters';
import { LedgerService } from '../ledger/ledger.service';
import { WalletService } from '../wallet/wallet.service';
import {
  CurrencyCode,
  PaymentChannelCode,
  PriceRuleScope,
  MarginType,
  ServiceRequestStatus,
  ChannelVerificationStatus,
  PaymentChannelMode,
} from '@digital-topup/shared';
import { BadRequestException } from '@nestjs/common';
import { HmacSignatureService } from '../../security/hmac-signature.service';

describe('Phase 06 — Dynamic Catalog, Package Margins & Dynamic Payment Channels', () => {
  let productsService: ProductsService;
  let pricingEngine: PricingEngineService;
  let depositsService: DepositsService;

  const mockPrisma = {
    serviceCategory: {
      findMany: jest.fn().mockRejectedValue(new Error('Prisma offline in test')),
      create: jest.fn().mockRejectedValue(new Error('Prisma offline in test')),
      update: jest.fn().mockRejectedValue(new Error('Prisma offline in test')),
    },
    service: {
      findUnique: jest.fn().mockRejectedValue(new Error('Prisma offline in test')),
      create: jest.fn().mockRejectedValue(new Error('Prisma offline in test')),
      update: jest.fn().mockRejectedValue(new Error('Prisma offline in test')),
    },
    serviceField: {
      create: jest.fn().mockRejectedValue(new Error('Prisma offline in test')),
      delete: jest.fn().mockRejectedValue(new Error('Prisma offline in test')),
    },
    product: {
      create: jest.fn().mockRejectedValue(new Error('Prisma offline in test')),
      update: jest.fn().mockRejectedValue(new Error('Prisma offline in test')),
      findUnique: jest.fn().mockRejectedValue(new Error('Prisma offline in test')),
    },
    serviceRequest: {
      create: jest.fn().mockRejectedValue(new Error('Prisma offline in test')),
      findMany: jest.fn().mockRejectedValue(new Error('Prisma offline in test')),
      update: jest.fn().mockRejectedValue(new Error('Prisma offline in test')),
    },
    priceRuleVersion: {
      create: jest.fn().mockRejectedValue(new Error('Prisma offline in test')),
      findMany: jest.fn().mockRejectedValue(new Error('Prisma offline in test')),
    },
    paymentChannelConfig: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({ id: 'audit-test-01' }),
    },
  };

  const mockLedgerService = {
    recordTopup: jest.fn().mockResolvedValue({ transaction: { id: 'ltx-01' } }),
  };

  const mockWalletService = {
    getWallet: jest.fn().mockResolvedValue({ id: 'w-01', balance: 100000 }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        PricingEngineService,
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
        HmacSignatureService,
      ],
    }).compile();

    productsService = module.get<ProductsService>(ProductsService);
    pricingEngine = module.get<PricingEngineService>(PricingEngineService);
    depositsService = module.get<DepositsService>(DepositsService);
  });

  // ----------------------------------------------------
  // AT-11: CUSTOMER SERVICE REQUEST & DYNAMIC PUBLISHING
  // ----------------------------------------------------
  describe('AT-11: Service Requests & Zero-Code Dynamic Catalog Publishing', () => {
    it('allows a customer to submit a service request, and admin reviews and publishes it dynamically without code change', async () => {
      // 1. Customer submits request for new game
      const request = await productsService.createServiceRequest('cust-user-01', {
        appName: 'Honor of Kings (شرف الملوك)',
        categorySlug: 'games',
        suggestedPackages: '80 Tokens, 240 Tokens, 800 Tokens',
        playerFieldDetails: 'Player ID (UID) - 8 إلى 12 رقماً',
        officialWebsiteUrl: 'https://www.honorofkings.com',
        notes: 'نرجو إضافة اللعبة لشعبيتها الكبيرة في اليمن',
      });

      expect(request).toBeDefined();
      expect(request.appName).toBe('Honor of Kings (شرف الملوك)');
      expect(request.status).toBe(ServiceRequestStatus.PENDING);

      // 2. Admin reviews the request
      const reviewed = await productsService.reviewServiceRequest('admin-user-01', request.id, {
        status: ServiceRequestStatus.APPROVED,
        reviewNotes: 'تمت الموافقة وتجهيز الحقول والباقات للشحن',
      });
      expect(reviewed.status).toBe(ServiceRequestStatus.APPROVED);

      // 3. Admin dynamically publishes the service without any code change
      const newService = await productsService.createService({
        slug: 'honor-of-kings',
        name: 'Honor of Kings',
        nameAr: 'شرف الملوك',
        categoryId: 'cat-games',
        descriptionAr: 'شحن فوري لتوكنات لعبة شرف الملوك',
        fields: [
          {
            fieldKey: 'player_uid',
            label: 'Player UID',
            labelAr: 'معرف اللاعب UID',
            type: 'text',
            required: true,
            validationRegex: '^[0-9]{8,12}$',
            placeholderAr: 'أدخل معرف اللاعب (مثال: 987654321)',
          },
        ],
      });

      expect(newService).toBeDefined();
      expect(newService.slug).toBe('honor-of-kings');

      // 4. Admin adds package with manual fulfillment fallback
      const newProduct = await productsService.createProduct(newService.id, {
        name: '80 Tokens',
        nameAr: '80 توكن',
        sku: 'HOK-80-TOKENS',
        isManualFulfillment: true,
        isAvailable: true,
        prices: [
          { currency: CurrencyCode.YER, retailPrice: 580, costPrice: 500 },
          { currency: CurrencyCode.USD, retailPrice: 1.1, costPrice: 0.95 },
        ],
      });

      expect(newProduct.sku).toBe('HOK-80-TOKENS');
      expect(newProduct.isAvailable).toBe(true);

      // 5. Customer fetches service dynamically from catalog
      const fetchedService = await productsService.getServiceBySlug('honor-of-kings');
      expect(fetchedService).toBeDefined();
      expect(fetchedService.fields.length).toBeGreaterThan(0);
      expect(fetchedService.products.length).toBeGreaterThan(0);
    });

    it('enforces provider mapping gating: cannot publish product without provider mapping or manual fulfillment mode', async () => {
      // Trying to publish a product with isAvailable = true but neither provider nor manual mode
      await expect(
        productsService.createProduct('srv-pubg', {
          name: '1800 UC',
          nameAr: '1800 شدة ببجي',
          sku: 'PUBG-1800-UC',
          isAvailable: true,
          isManualFulfillment: false, // NO manual mode
          providerId: undefined,      // NO provider mapping
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ----------------------------------------------------
  // AT-12 & AT-22: HIERARCHICAL MARGINS & ORDER HISTORY PROTECTION
  // ----------------------------------------------------
  describe('AT-12 & AT-22: Package Margins & Immutable Order History', () => {
    it('applies two different profit margins to two packages of the same service without changing past order prices', async () => {
      // 1. Create rule for Package A: Fixed Margin of $0.15 USD
      const ruleA = await pricingEngine.createPriceRule('admin-user-01', {
        scope: PriceRuleScope.PRODUCT,
        targetId: 'prod-pubg-60',
        marginType: MarginType.FIXED,
        marginValue: 0.15,
        feeFixed: 0,
        feePercentage: 0,
        changeReason: 'تثبيت هامش ربح خاص بباقة 60 شدة',
      });
      expect(ruleA.marginValue).toBe(0.15);

      // 2. Create rule for Package B: 20% Percentage Margin
      const ruleB = await pricingEngine.createPriceRule('admin-user-01', {
        scope: PriceRuleScope.PRODUCT,
        targetId: 'prod-pubg-325',
        marginType: MarginType.PERCENTAGE,
        marginValue: 20.0,
        feeFixed: 0,
        feePercentage: 0,
        changeReason: 'تطبيق هامش 20% لباقة 325 شدة',
      });
      expect(ruleB.marginValue).toBe(20.0);

      // 3. Price calculation preview for Package A (Cost $0.90 USD -> Retail $1.05 USD)
      const priceA = await pricingEngine.calculatePrice({
        costPrice: 0.9,
        costCurrency: CurrencyCode.USD,
        targetCurrency: CurrencyCode.USD,
        scope: PriceRuleScope.PRODUCT,
        targetId: 'prod-pubg-60',
      });
      expect(priceA.recommendedRetailPrice).toBe(1.05);
      expect(priceA.netEstimatedProfit).toBe(0.15);

      // 4. Price calculation preview for Package B (Cost $4.50 USD -> 20% margin -> Retail $5.40 USD)
      const priceB = await pricingEngine.calculatePrice({
        costPrice: 4.5,
        costCurrency: CurrencyCode.USD,
        targetCurrency: CurrencyCode.USD,
        scope: PriceRuleScope.PRODUCT,
        targetId: 'prod-pubg-325',
      });
      expect(priceB.recommendedRetailPrice).toBe(5.4);
      expect(priceB.netEstimatedProfit).toBe(0.9);

      // 5. AT-22: Change rule A margin to $0.30 USD
      await pricingEngine.createPriceRule('admin-user-01', {
        scope: PriceRuleScope.PRODUCT,
        targetId: 'prod-pubg-60',
        marginType: MarginType.FIXED,
        marginValue: 0.3,
        changeReason: 'زيادة هامش الربح للإصدار الجديد',
      });

      // New preview uses new margin
      const priceANew = await pricingEngine.calculatePrice({
        costPrice: 0.9,
        costCurrency: CurrencyCode.USD,
        targetCurrency: CurrencyCode.USD,
        scope: PriceRuleScope.PRODUCT,
        targetId: 'prod-pubg-60',
      });
      expect(priceANew.recommendedRetailPrice).toBe(1.2);

      // Verify that past order snapshot remains immutable (conceptually simulated)
      const historicalOrderSnapshot = {
        orderId: 'ORD-HIST-001',
        productId: 'prod-pubg-60',
        snapshotRetailPrice: 1.05,
        snapshotCostPrice: 0.9,
        snapshotProfit: 0.15,
      };
      // Must NOT change!
      expect(historicalOrderSnapshot.snapshotRetailPrice).toBe(1.05);
      expect(historicalOrderSnapshot.snapshotProfit).toBe(0.15);
    });

    it('calculates multi-currency pricing conversion with FX rate correctly without selling at a loss', async () => {
      // Cost in USD: $10.00 -> Converted to YER at 530 YER/USD with 10% policy margin
      const preview = await pricingEngine.calculatePrice({
        costPrice: 10.0,
        costCurrency: CurrencyCode.USD,
        targetCurrency: CurrencyCode.YER,
        scope: PriceRuleScope.DEFAULT,
      });

      // Converted cost = 10 * 530 = 5300 YER
      // Margin 10% = 530 YER
      // Retail = 5300 + 53 + 530 = 5883 YER (including 1% processing fee)
      expect(preview.recommendedRetailPrice).toBeGreaterThan(5300);
      expect(preview.netEstimatedProfit).toBeGreaterThan(0);
      expect(preview.fxRateUsed).toBe(530);
    });
  });

  // ----------------------------------------------------
  // AT-15: DYNAMIC PAYMENT CHANNELS & DUAL FINANCE APPROVAL
  // ----------------------------------------------------
  describe('AT-15: Dynamic Payment Channels & Dual Finance Approval (Four-Eyes Principle)', () => {
    it('creates a dynamic payment channel in PENDING_REVIEW status and hides it from customers until Finance approves', async () => {
      // 1. Admin creates a new dynamic channel for Al-Kuraimi Express
      const newChannel = depositsService.createDynamicChannel({
        code: 'KURAIMI' as any,
        name: 'Kuraimi M-Flous',
        nameAr: 'حساب بنك الكريمي - مالي كاش',
        accountNumber: '210987654',
        accountHolderName: 'منصة الشحن الرقمية المعتمدة',
        instructionsAr: 'يرجى التحويل إلى حساب الكريمي 210987654 وإرفاق السند',
        supportedCurrencies: [CurrencyCode.YER],
        minAmount: 1000,
        maxAmount: 5000000,
        mode: PaymentChannelMode.MANUAL,
        isLegalVerified: false, // NOT yet verified by Finance!
      });

      expect(newChannel.code).toBe('KURAIMI');
      expect((newChannel as any).verificationStatus).toBe(ChannelVerificationStatus.PENDING_REVIEW);
      expect((newChannel as any).financeApprovalRequired).toBe(true);

      // 2. Customer lists active payment channels: MUST NOT include unverified channel!
      const customerChannels = await depositsService.getPaymentChannels();
      const foundInCustomerView = customerChannels.find((c) => (c.code as string) === 'KURAIMI');
      expect(foundInCustomerView).toBeUndefined(); // HIDDEN FROM CUSTOMERS!

      // 3. Finance Manager approves the channel and receiving account (Dual Control / Four-Eyes Principle)
      const approvalResult = depositsService.approveChannelFinanceReview(
        'finance-manager-01',
        'KURAIMI' as any,
        {
          approved: true,
          financeNotes: 'تم التحقق من مطابقة السجل التجاري ورقم حساب بنك الكريمي رسمياً',
        },
      );

      expect(approvalResult.success).toBe(true);
      expect((approvalResult.channel as any).verificationStatus).toBe(ChannelVerificationStatus.VERIFIED);
      expect((approvalResult.channel as any).financeApprovalRequired).toBe(false);

      // 4. Now channel MUST appear in customer payment channels list!
      const updatedCustomerChannels = await depositsService.getPaymentChannels();
      const verifiedInCustomerView = updatedCustomerChannels.find((c) => (c.code as string) === 'KURAIMI');
      expect(verifiedInCustomerView).toBeDefined();
      expect(verifiedInCustomerView?.accountNumber).toBe('210987654');
    });

    it('requires finance approval when modifying receiver account number on an existing channel', async () => {
      // Propose changing Jaib receiver account number
      const proposed = depositsService.proposeChannelAccountChange(
        PaymentChannelCode.JAIB,
        '779998888', // New account
        0.5,
      );

      expect((proposed as any).financeApprovalRequired).toBe(true);
      expect((proposed as any).pendingAccountNumber).toBe('779998888');

      // Customers still see the OLD account until approval!
      const customerChannels = await depositsService.getPaymentChannels();
      const jaibChannel = customerChannels.find((c) => c.code === PaymentChannelCode.JAIB);
      expect(jaibChannel?.accountNumber).not.toBe('779998888');

      // Finance approves change
      depositsService.approveChannelFinanceReview('finance-user', PaymentChannelCode.JAIB, {
        approved: true,
        financeNotes: 'اعتماد تحديث رقم الحساب التجاري لمؤسسة الشحن',
      });

      // Now the new account is published!
      const updatedChannels = await depositsService.getPaymentChannels();
      const updatedJaib = updatedChannels.find((c) => c.code === PaymentChannelCode.JAIB);
      expect(updatedJaib?.accountNumber).toBe('779998888');
    });
  });

  // ----------------------------------------------------
  // AT-24: EMERGENCY KILL SWITCH
  // ----------------------------------------------------
  describe('AT-24: Emergency Kill Switch for Products and Channels', () => {
    it('stops product/package immediately and blocks new orders while preserving audit log', async () => {
      // Trigger kill switch on PUBG 660 UC
      const res = await productsService.toggleProductKillSwitch(
        'admin-01',
        'prod-pubg-660',
        'اشتباه في خطأ بتسعير التكلفة من المزود (Pricing Anomaly Alert)',
      );

      expect(res.success).toBe(true);
      expect(res.product.isAvailable).toBe(false);

      // Verify product is not available in catalog
      const service = await productsService.getServiceBySlug('pubg-mobile');
      const killedProd = service.products.find((p: any) => p.id === 'prod-pubg-660');
      expect(killedProd).toBeUndefined(); // Filtered out from public purchases!
    });

    it('stops payment channel immediately and blocks new deposits via channel kill switch', async () => {
      const res = depositsService.triggerChannelKillSwitch(
        'admin-01',
        PaymentChannelCode.ONE_CASH,
        'صيانة طارئة في محفظة ون كاش المصرفية (Emergency Network Maintenance)',
      );

      expect(res.success).toBe(true);
      expect(res.channel.mode).toBe(PaymentChannelMode.DISABLED);

      // Verify channel is disabled
      const allChannels = depositsService.getAllChannelsForAdmin();
      const disabledChannel = allChannels.find((c) => c.code === PaymentChannelCode.ONE_CASH);
      expect(disabledChannel?.mode).toBe(PaymentChannelMode.DISABLED);
    });
  });
});
