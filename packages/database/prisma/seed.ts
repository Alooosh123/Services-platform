import {
  PrismaClient,
  UserRole,
  CurrencyCode,
  PaymentChannelCode,
  LedgerAccountType,
  LedgerTransactionType,
  PaymentStatus,
  DepositStatus,
  ChannelVerificationStatus,
  PaymentChannelMode,
} from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

// Load root or local .env
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const prisma = new PrismaClient();

const defaultTiers = [
  { code: 'B2C', name: 'Standard Customer', nameAr: 'عميل عادي', displayOrder: 1 },
  { code: 'BRONZE', name: 'Bronze Reseller', nameAr: 'وكيل برونزي', displayOrder: 2 },
  { code: 'SILVER', name: 'Silver Reseller', nameAr: 'وكيل فضي', displayOrder: 3 },
  { code: 'GOLD', name: 'Gold Reseller', nameAr: 'وكيل ذهبي', displayOrder: 4 },
  { code: 'MASTER', name: 'Master Distributor', nameAr: 'موزع رئيسي', displayOrder: 5 },
];

async function seedTiers() {
  for (const tier of defaultTiers) {
    await prisma.tier.upsert({
      where: { code: tier.code },
      create: { ...tier, defaultDiscountPercent: 0 },
      update: {},
    });
  }
}

async function ensureSuperAdmin() {
  const email = process.env.SEED_SUPER_ADMIN_EMAIL;
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD;
  if (process.env.NODE_ENV === 'production') throw new Error('Development seed is disabled in production.');
  if (!email || !password || password.length < 20) throw new Error('Set SEED_SUPER_ADMIN_EMAIL and a unique SEED_SUPER_ADMIN_PASSWORD of at least 20 characters.');

  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      fullName: 'Super Administrator',
      fullNameAr: 'المدير العام للمنصة',
      role: UserRole.SUPER_ADMIN,
      isVerified: true,
      emailVerifiedAt: new Date(),
    },
    update: {},
  });
}

async function main() {
  console.log('--- Starting Yemen Market Database Seeder ---');
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Development seed is disabled in production.');
  }

  const resetSeedData = process.env.RESET_DATABASE_SEED === 'true';
  const existingUsers = await prisma.user.count();
  const existingCurrencies = await prisma.currency.count();

  if (!resetSeedData && (existingUsers > 0 || existingCurrencies > 0)) {
    await seedTiers();
    await ensureSuperAdmin();
    console.log('Existing application data preserved; identity tiers and bootstrap administrator are ready.');
    return;
  }

  if (resetSeedData) {
    console.warn('RESET_DATABASE_SEED=true: deleting existing development seed data.');
    await prisma.auditLog.deleteMany();
    await prisma.manualFulfillment.deleteMany();
    await prisma.orderStatusHistory.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.order.deleteMany();
    await prisma.productPrice.deleteMany();
    await prisma.product.deleteMany();
    await prisma.serviceField.deleteMany();
    await prisma.service.deleteMany();
    await prisma.serviceCategory.deleteMany();
    await prisma.depositStatusHistory.deleteMany();
    await prisma.depositRequest.deleteMany();
    await prisma.paymentChannelConfig.deleteMany();
    await prisma.ledgerEntry.deleteMany();
    await prisma.ledgerTransaction.deleteMany();
    await prisma.ledgerAccount.deleteMany();
    await prisma.walletTopup.deleteMany();
    await prisma.currencyExchange.deleteMany();
    await prisma.wallet.deleteMany();
    await prisma.fxRate.deleteMany();
    await prisma.paymentMethod.deleteMany();
    await prisma.currency.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
  }

  await seedTiers();

  // 2. Seed Supported Currencies
  console.log('Seeding Currencies (YER, USD, SAR)...');
  await prisma.currency.create({
    data: {
      code: CurrencyCode.YER,
      name: 'Yemeni Rial',
      nameAr: 'ريال يمني',
      symbol: 'YR',
      symbolAr: 'ر.ي',
      decimals: 2,
      isBase: false,
      isActive: true,
    },
  });

  await prisma.currency.create({
    data: {
      code: CurrencyCode.USD,
      name: 'US Dollar',
      nameAr: 'دولار أمريكي',
      symbol: '$',
      symbolAr: '$',
      decimals: 2,
      isBase: true,
      isActive: true,
    },
  });

  await prisma.currency.create({
    data: {
      code: CurrencyCode.SAR,
      name: 'Saudi Rial',
      nameAr: 'ريال سعودي',
      symbol: 'SAR',
      symbolAr: 'ر.س',
      decimals: 2,
      isBase: false,
      isActive: true,
    },
  });

  // 3. Seed Reference FX Rates
  console.log('Seeding FX Rates...');
  await prisma.fxRate.createMany({
    data: [
      { fromCurrency: CurrencyCode.USD, toCurrency: CurrencyCode.YER, rate: 535.0, buyMargin: 0.01, sellMargin: 0.01 },
      { fromCurrency: CurrencyCode.YER, toCurrency: CurrencyCode.USD, rate: 0.001869, buyMargin: 0.01, sellMargin: 0.01 },
      { fromCurrency: CurrencyCode.SAR, toCurrency: CurrencyCode.YER, rate: 142.5, buyMargin: 0.01, sellMargin: 0.01 },
      { fromCurrency: CurrencyCode.YER, toCurrency: CurrencyCode.SAR, rate: 0.007018, buyMargin: 0.01, sellMargin: 0.01 },
      { fromCurrency: CurrencyCode.USD, toCurrency: CurrencyCode.SAR, rate: 3.75, buyMargin: 0.005, sellMargin: 0.005 },
      { fromCurrency: CurrencyCode.SAR, toCurrency: CurrencyCode.USD, rate: 0.266667, buyMargin: 0.005, sellMargin: 0.005 },
    ],
  });

  // 4. Seed Yemeni Payment Methods & Real Channel Configurations
  console.log('Seeding Payment Methods & Channel Configs...');
  const paymentMethodsData = [
    {
      code: PaymentChannelCode.JAIB,
      name: 'Jaib Wallet (CAC Bank)',
      nameAr: 'محفظة جيب (بنك التسليف التعاوني الزراعي CAC)',
      type: 'MANUAL',
      supportedCurrencies: [CurrencyCode.YER],
      instructionsAr: 'القناة غير مهيأة. ستتاح بعد إضافة حساب المستفيد الحقيقي واعتماده.',
      isActive: false,
      isMock: false,
    },
    {
      code: PaymentChannelCode.JAWALI,
      name: 'Jawali Wallet (YKB Bank)',
      nameAr: 'محفظة جوالي (بنك اليمن والكويت)',
      type: 'MANUAL',
      supportedCurrencies: [CurrencyCode.YER],
      instructionsAr: 'القناة غير مهيأة. ستتاح بعد إضافة حساب المستفيد الحقيقي واعتماده.',
      isActive: false,
      isMock: false,
    },
    {
      code: PaymentChannelCode.CASH,
      name: 'Cash Wallet (Saba Bank)',
      nameAr: 'محفظة كاش (بنك سبأ الإسلامي)',
      type: 'MANUAL',
      supportedCurrencies: [CurrencyCode.YER],
      instructionsAr: 'القناة غير مهيأة. ستتاح بعد إضافة حساب المستفيد الحقيقي واعتماده.',
      isActive: false,
      isMock: false,
    },
    {
      code: PaymentChannelCode.ONE_CASH,
      name: 'One Cash (YOU Telecom)',
      nameAr: 'ون كاش (شركة YOU)',
      type: 'MANUAL',
      supportedCurrencies: [CurrencyCode.YER],
      instructionsAr: 'القناة غير مهيأة. ستتاح بعد إضافة حساب المستفيد الحقيقي واعتماده.',
      isActive: false,
      isMock: false,
    },
    {
      code: PaymentChannelCode.EASY,
      name: 'Easy Wallet',
      nameAr: 'محفظة إيزي',
      type: 'MANUAL',
      supportedCurrencies: [CurrencyCode.YER],
      instructionsAr: 'القناة غير مهيأة. ستتاح بعد إضافة حساب المستفيد الحقيقي واعتماده.',
      isActive: false,
      isMock: false,
    },
    {
      code: PaymentChannelCode.WALLET,
      name: 'Internal Digital Wallet',
      nameAr: 'رصيد المحفظة الداخلي',
      type: 'WALLET',
      supportedCurrencies: [CurrencyCode.YER, CurrencyCode.USD, CurrencyCode.SAR],
      instructionsAr: 'الدفع المباشر والآني من رصيد محفظتك المتاح.',
      isActive: true,
      isMock: false,
    },
  ];

  for (const pm of paymentMethodsData) {
    await prisma.paymentMethod.upsert({
      where: { code: pm.code },
      create: pm,
      update: {
        name: pm.name, nameAr: pm.nameAr, type: pm.type,
        supportedCurrencies: pm.supportedCurrencies, instructionsAr: pm.instructionsAr,
        isActive: pm.isActive, isMock: pm.isMock,
      },
    });
  }

  // Seed Genuine Payment Channel Receiver Configurations
  const channelConfigsData = [
    {
      code: PaymentChannelCode.JAIB,
      name: 'Jaib Wallet (CAC Bank)',
      nameAr: 'محفظة جيب - بنك التسليف التعاوني الزراعي',
      accountNumber: 'NOT_CONFIGURED',
      accountHolderName: 'غير مهيأ',
      instructionsAr: 'القناة غير مفعلة. أدخل بيانات المستفيد الحقيقية وتحقق منها واعتمدها من الإدارة المالية قبل الإتاحة للعملاء.',
      supportedCurrencies: ['YER'],
      mode: PaymentChannelMode.MANUAL,
      verificationStatus: ChannelVerificationStatus.PENDING_REVIEW,
      financeApprovalRequired: true,
      minAmount: 500,
      maxAmount: 2000000,
      isActive: false,
    },
    {
      code: PaymentChannelCode.JAWALI,
      name: 'Jawali Wallet (YKB Bank)',
      nameAr: 'محفظة جوالي - بنك اليمن والكويت',
      accountNumber: 'NOT_CONFIGURED',
      accountHolderName: 'غير مهيأ',
      instructionsAr: 'القناة غير مفعلة. أدخل بيانات المستفيد الحقيقية وتحقق منها واعتمدها من الإدارة المالية قبل الإتاحة للعملاء.',
      supportedCurrencies: ['YER'],
      mode: PaymentChannelMode.MANUAL,
      verificationStatus: ChannelVerificationStatus.PENDING_REVIEW,
      financeApprovalRequired: true,
      minAmount: 500,
      maxAmount: 2000000,
      isActive: false,
    },
    {
      code: PaymentChannelCode.CASH,
      name: 'Cash Wallet (Saba Bank)',
      nameAr: 'محفظة كاش - بنك سبأ الإسلامي',
      accountNumber: 'NOT_CONFIGURED',
      accountHolderName: 'غير مهيأ',
      instructionsAr: 'القناة غير مفعلة. أدخل بيانات المستفيد الحقيقية وتحقق منها واعتمدها من الإدارة المالية قبل الإتاحة للعملاء.',
      supportedCurrencies: ['YER'],
      mode: PaymentChannelMode.MANUAL,
      verificationStatus: ChannelVerificationStatus.PENDING_REVIEW,
      financeApprovalRequired: true,
      minAmount: 500,
      maxAmount: 2000000,
      isActive: false,
    },
    {
      code: PaymentChannelCode.ONE_CASH,
      name: 'One Cash (YOU Telecom)',
      nameAr: 'ون كاش - شركة YOU',
      accountNumber: 'NOT_CONFIGURED',
      accountHolderName: 'غير مهيأ',
      instructionsAr: 'القناة غير مفعلة. أدخل بيانات المستفيد الحقيقية وتحقق منها واعتمدها من الإدارة المالية قبل الإتاحة للعملاء.',
      supportedCurrencies: ['YER'],
      mode: PaymentChannelMode.MANUAL,
      verificationStatus: ChannelVerificationStatus.PENDING_REVIEW,
      financeApprovalRequired: true,
      minAmount: 500,
      maxAmount: 1500000,
      isActive: false,
    },
    {
      code: PaymentChannelCode.EASY,
      name: 'Easy Wallet',
      nameAr: 'محفظة إيزي للدفع الإلكتروني',
      accountNumber: 'NOT_CONFIGURED',
      accountHolderName: 'غير مهيأ',
      instructionsAr: 'القناة غير مفعلة. أدخل بيانات المستفيد الحقيقية وتحقق منها واعتمدها من الإدارة المالية قبل الإتاحة للعملاء.',
      supportedCurrencies: ['YER'],
      mode: PaymentChannelMode.MANUAL,
      verificationStatus: ChannelVerificationStatus.PENDING_REVIEW,
      financeApprovalRequired: true,
      minAmount: 500,
      maxAmount: 1500000,
      isActive: false,
    },
  ];

  for (const cfg of channelConfigsData) {
    await prisma.paymentChannelConfig.upsert({
      where: { code: cfg.code },
      create: cfg,
      // Reseeding intentionally disables previous example/external channels.
      update: {
        name: cfg.name,
        nameAr: cfg.nameAr,
        accountNumber: 'NOT_CONFIGURED',
        accountHolderName: 'غير مهيأ',
        instructionsAr: cfg.instructionsAr,
        supportedCurrencies: cfg.supportedCurrencies,
        mode: PaymentChannelMode.MANUAL,
        verificationStatus: ChannelVerificationStatus.PENDING_REVIEW,
        financeApprovalRequired: true,
        minAmount: cfg.minAmount,
        maxAmount: cfg.maxAmount,
        isActive: false,
      },
    });
  }

  // 5. Seed Chart of Accounts for Strict Double-Entry Ledger
  console.log('Seeding Ledger Chart of Accounts...');
  const cashJaibAccount = await prisma.ledgerAccount.create({
    data: {
      code: '1001-CASH-JAIB',
      name: 'Cash Clearing - Jaib Wallet',
      type: LedgerAccountType.ASSET,
      currency: CurrencyCode.YER,
      description: 'حساب وسيط لتسوية مدفوعات محفظة جيب بالريال اليمني',
    },
  });

  await prisma.ledgerAccount.createMany({
    data: [
      {
        code: '1002-CASH-JAWALI',
        name: 'Cash Clearing - Jawali Wallet',
        type: LedgerAccountType.ASSET,
        currency: CurrencyCode.YER,
        description: 'حساب وسيط لتسوية مدفوعات محفظة جوالي بالريال اليمني',
      },
      {
        code: '1003-CASH-SABA',
        name: 'Cash Clearing - Saba Cash Wallet',
        type: LedgerAccountType.ASSET,
        currency: CurrencyCode.YER,
        description: 'حساب وسيط لتسوية مدفوعات محفظة كاش بالريال اليمني',
      },
      {
        code: '1004-CASH-ONECASH',
        name: 'Cash Clearing - One Cash',
        type: LedgerAccountType.ASSET,
        currency: CurrencyCode.YER,
        description: 'حساب وسيط لتسوية مدفوعات ون كاش بالريال اليمني',
      },
      {
        code: '1005-CASH-EASY',
        name: 'Cash Clearing - Easy Wallet',
        type: LedgerAccountType.ASSET,
        currency: CurrencyCode.YER,
        description: 'حساب وسيط لتسوية مدفوعات محفظة إيزي بالريال اليمني',
      },
    ],
  });

  const clearingUsdAccount = await prisma.ledgerAccount.create({
    data: {
      code: '1010-CLEARING-USD',
      name: 'USD Payment Clearing Account',
      type: LedgerAccountType.ASSET,
      currency: CurrencyCode.USD,
      description: 'حساب وسيط لتسوية مدفوعات الدولار الأمريكي',
    },
  });

  await prisma.ledgerAccount.create({
    data: {
      code: '1011-CLEARING-SAR',
      name: 'SAR Payment Clearing Account',
      type: LedgerAccountType.ASSET,
      currency: CurrencyCode.SAR,
      description: 'حساب وسيط لتسوية مدفوعات الريال السعودي',
    },
  });

  const customerWalletsYerAccount = await prisma.ledgerAccount.create({
    data: {
      code: '2001-CUSTOMER-WALLETS-YER',
      name: 'Customer Wallet Balances - YER',
      type: LedgerAccountType.LIABILITY,
      currency: CurrencyCode.YER,
      description: 'إجمالي التزامات المنصة تجاه أرصدة محافظ العملاء بالريال اليمني',
    },
  });

  const customerWalletsUsdAccount = await prisma.ledgerAccount.create({
    data: {
      code: '2002-CUSTOMER-WALLETS-USD',
      name: 'Customer Wallet Balances - USD',
      type: LedgerAccountType.LIABILITY,
      currency: CurrencyCode.USD,
      description: 'إجمالي التزامات المنصة تجاه أرصدة محافظ العملاء بالدولار الأمريكي',
    },
  });

  await prisma.ledgerAccount.create({
    data: {
      code: '2003-CUSTOMER-WALLETS-SAR',
      name: 'Customer Wallet Balances - SAR',
      type: LedgerAccountType.LIABILITY,
      currency: CurrencyCode.SAR,
      description: 'إجمالي التزامات المنصة تجاه أرصدة محافظ العملاء بالريال السعودي',
    },
  });

  await prisma.ledgerAccount.createMany({
    data: [
      {
        code: '4001-REVENUE-YER',
        name: 'TopUp Sales Revenue - YER',
        type: LedgerAccountType.REVENUE,
        currency: CurrencyCode.YER,
        description: 'إيرادات مبيعات الشحن بالريال اليمني',
      },
      {
        code: '4002-REVENUE-USD',
        name: 'TopUp Sales Revenue - USD',
        type: LedgerAccountType.REVENUE,
        currency: CurrencyCode.USD,
        description: 'إيرادات مبيعات الشحن بالدولار',
      },
      {
        code: '5001-COGS-YER',
        name: 'Cost of Goods Sold - YER',
        type: LedgerAccountType.EXPENSE,
        currency: CurrencyCode.YER,
        description: 'تكلفة المشتريات من المزودين بالريال اليمني',
      },
      {
        code: '5002-COGS-USD',
        name: 'Cost of Goods Sold - USD',
        type: LedgerAccountType.EXPENSE,
        currency: CurrencyCode.USD,
        description: 'تكلفة المشتريات من المزودين بالدولار',
      },
    ],
  });

  // 6. Seed non-login synthetic identities and one explicitly configured bootstrap administrator.
  console.log('Seeding users and wallets...');
  const adminEmail = process.env.SEED_SUPER_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_SUPER_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword || adminPassword.length < 20) throw new Error('Set SEED_SUPER_ADMIN_EMAIL and a unique SEED_SUPER_ADMIN_PASSWORD of at least 20 characters.');
  const adminPasswordHash = await bcrypt.hash(adminPassword, 12);
  const syntheticPasswordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
  const syntheticCustomerPasswordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
  const superAdmin = await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail, phone: null, passwordHash: adminPasswordHash,
      fullName: 'Super Administrator', fullNameAr: 'المدير العام للمنصة',
      role: UserRole.SUPER_ADMIN, isVerified: true, isActive: true, emailVerifiedAt: new Date(),
      wallets: { create: [
        { currency: CurrencyCode.YER, balance: 0.0 },
        { currency: CurrencyCode.USD, balance: 0.0 },
        { currency: CurrencyCode.SAR, balance: 0.0 },
      ] },
    },
    update: {},
  });
  const financeOfficer = await prisma.user.create({
    data: {
      email: 'seed-finance-' + crypto.randomUUID() + '@example.invalid', phone: null,
      passwordHash: syntheticPasswordHash, fullName: 'Disabled Synthetic Finance User',
      fullNameAr: 'حساب مالي تجريبي معطل', role: UserRole.FINANCE,
      isVerified: false, isActive: false, emailVerifiedAt: null, phoneVerifiedAt: null,
      wallets: { create: [
        { currency: CurrencyCode.YER, balance: 0.0 },
        { currency: CurrencyCode.USD, balance: 0.0 },
        { currency: CurrencyCode.SAR, balance: 0.0 },
      ] },
    },
  });
  const testCustomer = await prisma.user.create({
    data: {
      email: 'seed-customer-' + crypto.randomUUID() + '@example.invalid', phone: null,
      passwordHash: syntheticCustomerPasswordHash, fullName: 'Disabled Synthetic Test Customer',
      fullNameAr: 'عميل تجريبي معطل', role: UserRole.CUSTOMER,
      tier: { connect: { code: 'B2C' } }, isVerified: false, isActive: false,
      emailVerifiedAt: null, phoneVerifiedAt: null,
      wallets: { create: [
        { currency: CurrencyCode.YER, balance: 50000.0, lockedBalance: 0.0 },
        { currency: CurrencyCode.USD, balance: 100.0, lockedBalance: 0.0 },
        { currency: CurrencyCode.SAR, balance: 200.0, lockedBalance: 0.0 },
      ] },
    },
    include: { wallets: true },
  });
  const yerWallet = testCustomer.wallets.find((w) => w.currency === CurrencyCode.YER)!;
  const usdWallet = testCustomer.wallets.find((w) => w.currency === CurrencyCode.USD)!;

  // 7. Seed Strict Double-Entry Ledger Transactions for Initial Balances
  console.log('Seeding Balanced Ledger Transactions...');

  // YER Transaction: Debit Cash Clearing (Asset +), Credit Customer Wallet (Liability +)
  const initYerTx = await prisma.ledgerTransaction.create({
    data: {
      txNumber: 'LTX-INIT-YER-001',
      type: LedgerTransactionType.TOPUP,
      status: 'POSTED',
      referenceType: 'INITIAL_SEED',
      referenceId: yerWallet.id,
      notes: 'Initial test deposit for YER wallet',
      createdByUserId: superAdmin.id,
      entries: {
        create: [
          {
            accountId: cashJaibAccount.id,
            debitAmount: 50000.0,
            creditAmount: 0.0,
            currency: CurrencyCode.YER,
            notes: 'Cash received into Jaib clearing',
          },
          {
            accountId: customerWalletsYerAccount.id,
            walletId: yerWallet.id,
            debitAmount: 0.0,
            creditAmount: 50000.0,
            currency: CurrencyCode.YER,
            notes: 'Customer liability credited',
          },
        ],
      },
    },
  });

  // USD Transaction: Debit USD Clearing (Asset +), Credit Customer Wallet (Liability +)
  await prisma.ledgerTransaction.create({
    data: {
      txNumber: 'LTX-INIT-USD-001',
      type: LedgerTransactionType.TOPUP,
      status: 'POSTED',
      referenceType: 'INITIAL_SEED',
      referenceId: usdWallet.id,
      notes: 'Initial test deposit for USD wallet',
      createdByUserId: superAdmin.id,
      entries: {
        create: [
          {
            accountId: clearingUsdAccount.id,
            debitAmount: 100.0,
            creditAmount: 0.0,
            currency: CurrencyCode.USD,
            notes: 'Clearing account debited',
          },
          {
            accountId: customerWalletsUsdAccount.id,
            walletId: usdWallet.id,
            debitAmount: 0.0,
            creditAmount: 100.0,
            currency: CurrencyCode.USD,
            notes: 'Customer USD wallet liability credited',
          },
        ],
      },
    },
  });

  // 7.1 Seed Sample Deposit Requests for Customer Verification & Admin Flow
  console.log('Seeding Deposit Requests for Phase 2 Verification...');
  // Deposit 1: CREDITED (Historical deposit that funded the 50,000 YER)
  const deposit1 = await prisma.depositRequest.create({
    data: {
      depositNumber: 'DEP-20261009-0001',
      userId: testCustomer.id,
      walletId: yerWallet.id,
      currency: CurrencyCode.YER,
      amount: 50000.0,
      paymentMethodCode: PaymentChannelCode.JAIB,
      referenceNumber: 'REF-JAIB-112233',
      proofImageUrl: '/images/proofs/sample-receipt-1.png',
      senderName: 'أحمد محمد الحاشدي',
      senderPhone: '+967770000003',
      status: DepositStatus.CREDITED,
      reviewedByUserId: financeOfficer.id,
      reviewNotes: 'تم التحقق من استلام المبلغ وتغذيته في المحفظة بواسطة النظام المحاسبي المزدوج.',
      ledgerTxId: initYerTx.id,
      statusHistory: {
        create: [
          {
            fromStatus: null,
            toStatus: DepositStatus.PENDING,
            changedByUserId: testCustomer.id,
            notes: 'طلب إيداع أولي من العميل',
          },
          {
            fromStatus: DepositStatus.PENDING,
            toStatus: DepositStatus.UNDER_REVIEW,
            changedByUserId: financeOfficer.id,
            notes: 'قيد مراجعة إشعار بنك CAC',
          },
          {
            fromStatus: DepositStatus.UNDER_REVIEW,
            toStatus: DepositStatus.APPROVED,
            changedByUserId: financeOfficer.id,
            notes: 'تمت الموافقة المبدئية والتحقق',
          },
          {
            fromStatus: DepositStatus.APPROVED,
            toStatus: DepositStatus.CREDITED,
            changedByUserId: financeOfficer.id,
            notes: 'تم قيد العملية في دفتر الأستاذ العام وتغذية رصيد المحفظة',
          },
        ],
      },
    },
  });

  // Deposit 2: PENDING (Customer just submitted via Jawali)
  await prisma.depositRequest.create({
    data: {
      depositNumber: 'DEP-20261009-0002',
      userId: testCustomer.id,
      walletId: yerWallet.id,
      currency: CurrencyCode.YER,
      amount: 25000.0,
      paymentMethodCode: PaymentChannelCode.JAWALI,
      referenceNumber: 'REF-JAWALI-998877',
      proofImageUrl: '/images/proofs/sample-receipt-2.png',
      senderName: 'أحمد محمد الحاشدي',
      senderPhone: '+967770000003',
      status: DepositStatus.PENDING,
      statusHistory: {
        create: [
          {
            fromStatus: null,
            toStatus: DepositStatus.PENDING,
            changedByUserId: testCustomer.id,
            notes: 'طلب إيداع قيد الانتظار لمراجعة الإدارة المالية',
          },
        ],
      },
    },
  });

  // Deposit 3: UNDER_REVIEW (Finance is actively checking with Saba Cash)
  await prisma.depositRequest.create({
    data: {
      depositNumber: 'DEP-20261009-0003',
      userId: testCustomer.id,
      walletId: yerWallet.id,
      currency: CurrencyCode.YER,
      amount: 15000.0,
      paymentMethodCode: PaymentChannelCode.CASH,
      referenceNumber: 'REF-CASH-445566',
      proofImageUrl: '/images/proofs/sample-receipt-3.png',
      senderName: 'أحمد محمد الحاشدي',
      senderPhone: '+967770000003',
      status: DepositStatus.UNDER_REVIEW,
      reviewedByUserId: financeOfficer.id,
      reviewNotes: 'جاري مطابقة الحوالة مع كشف حساب بنك سبأ الإسلامي',
      statusHistory: {
        create: [
          {
            fromStatus: null,
            toStatus: DepositStatus.PENDING,
            changedByUserId: testCustomer.id,
            notes: 'طلب إيداع قيد الانتظار',
          },
          {
            fromStatus: DepositStatus.PENDING,
            toStatus: DepositStatus.UNDER_REVIEW,
            changedByUserId: financeOfficer.id,
            notes: 'بدء التدقيق المالي من قبل ضابط المالية',
          },
        ],
      },
    },
  });

  // 8. Seed Dynamic Service Categories
  console.log('Seeding Service Categories...');
  const gamesCategory = await prisma.serviceCategory.create({
    data: {
      slug: 'games',
      name: 'Mobile & Online Games',
      nameAr: 'ألعاب الموبايل والإنترنت',
      icon: 'gamepad-2',
      displayOrder: 1,
    },
  });

  const appsCategory = await prisma.serviceCategory.create({
    data: {
      slug: 'apps',
      name: 'Social & Chat Apps',
      nameAr: 'تطبيقات الدردشة والترفيه',
      icon: 'message-circle',
      displayOrder: 2,
    },
  });

  // 9. Seed Service 1: PUBG Mobile
  console.log('Seeding PUBG Mobile Service...');
  const pubgService = await prisma.service.create({
    data: {
      slug: 'pubg-mobile',
      categoryId: gamesCategory.id,
      name: 'PUBG Mobile',
      nameAr: 'ببجي موبايل',
      description: 'Instant PUBG Mobile Unknown Cash (UC) direct player recharge',
      descriptionAr: 'شحن فوري ومباشر لشدات ببجي موبايل عبر الآيدي (Player ID)',
      iconUrl: '/images/services/pubg.png',
      displayOrder: 1,
      fields: {
        create: [
          {
            fieldKey: 'player_id',
            label: 'Player ID',
            labelAr: 'معرف اللاعب (Player ID)',
            type: 'text',
            required: true,
            validationRegex: '^[0-9]{5,15}$',
            placeholderAr: 'أدخل معرف اللاعب (مثال: 5123456789)',
            helperTextAr: 'تجد الآيدي بالضغط على صورتك الشخصية داخل لعبة ببجي',
            displayOrder: 1,
          },
        ],
      },
    },
  });

  const pubgProducts = [
    { name: '60 UC', nameAr: '60 شدة ببجي', sku: 'PUBG-60-UC', yer: 550, usd: 1.05, sar: 4.0 },
    { name: '325 UC', nameAr: '325 شدة ببجي', sku: 'PUBG-325-UC', yer: 2750, usd: 5.25, sar: 20.0 },
    { name: '660 UC', nameAr: '660 شدة ببجي', sku: 'PUBG-660-UC', yer: 5500, usd: 10.49, sar: 39.5 },
    { name: '1800 UC', nameAr: '1800 شدة ببجي', sku: 'PUBG-1800-UC', yer: 13500, usd: 25.99, sar: 98.0 },
    { name: '3850 UC', nameAr: '3850 شدة ببجي', sku: 'PUBG-3850-UC', yer: 27000, usd: 51.99, sar: 195.0 },
  ];

  for (let i = 0; i < pubgProducts.length; i++) {
    const p = pubgProducts[i];
    await prisma.product.create({
      data: {
        serviceId: pubgService.id,
        name: p.name,
        nameAr: p.nameAr,
        sku: p.sku,
        displayOrder: i + 1,
        prices: {
          create: [
            { currency: CurrencyCode.YER, retailPrice: p.yer, costPrice: p.yer * 0.9 },
            { currency: CurrencyCode.USD, retailPrice: p.usd, costPrice: p.usd * 0.9 },
            { currency: CurrencyCode.SAR, retailPrice: p.sar, costPrice: p.sar * 0.9 },
          ],
        },
      },
    });
  }

  // 10. Seed Service 2: YoYo (Voice Chat & Party)
  console.log('Seeding YoYo Service...');
  const yoyoService = await prisma.service.create({
    data: {
      slug: 'yoyo',
      categoryId: appsCategory.id,
      name: 'YoYo - Voice Chat Rooms',
      nameAr: 'يويو - غرف الدردشة الصوتية',
      description: 'Recharge YoYo Coins directly to your account ID',
      descriptionAr: 'شحن عملات تطبيق يويو الصوتي بالآيدي فوري',
      iconUrl: '/images/services/yoyo.png',
      displayOrder: 2,
      fields: {
        create: [
          {
            fieldKey: 'user_id',
            label: 'YoYo User ID',
            labelAr: 'معرف المستخدم في يويو (YoYo ID)',
            type: 'text',
            required: true,
            validationRegex: '^[0-9]{4,12}$',
            placeholderAr: 'أدخل آيدي حساب يويو (مثال: 7654321)',
            helperTextAr: 'تجد معرف الحساب في الملف الشخصي في تطبيق YoYo',
            displayOrder: 1,
          },
        ],
      },
    },
  });

  const yoyoProducts = [
    { name: '1,000 Coins', nameAr: '1,000 عملة يويو', sku: 'YOYO-1000-COINS', yer: 500, usd: 0.99, sar: 3.75 },
    { name: '5,000 Coins', nameAr: '5,000 عملة يويو', sku: 'YOYO-5000-COINS', yer: 2500, usd: 4.9, sar: 18.5 },
    { name: '10,000 Coins', nameAr: '10,000 عملة يويو', sku: 'YOYO-10000-COINS', yer: 4900, usd: 9.5, sar: 36.0 },
    { name: '50,000 Coins', nameAr: '50,000 عملة يويو', sku: 'YOYO-50000-COINS', yer: 24000, usd: 46.0, sar: 175.0 },
  ];

  for (let i = 0; i < yoyoProducts.length; i++) {
    const p = yoyoProducts[i];
    await prisma.product.create({
      data: {
        serviceId: yoyoService.id,
        name: p.name,
        nameAr: p.nameAr,
        sku: p.sku,
        displayOrder: i + 1,
        prices: {
          create: [
            { currency: CurrencyCode.YER, retailPrice: p.yer, costPrice: p.yer * 0.9 },
            { currency: CurrencyCode.USD, retailPrice: p.usd, costPrice: p.usd * 0.9 },
            { currency: CurrencyCode.SAR, retailPrice: p.sar, costPrice: p.sar * 0.9 },
          ],
        },
      },
    });
  }

  // 11. Seed Service 3: TopTop (Online Board Games)
  console.log('Seeding TopTop Service...');
  const toptopService = await prisma.service.create({
    data: {
      slug: 'toptop',
      categoryId: appsCategory.id,
      name: 'TopTop: Games & Voice',
      nameAr: 'توب توب - جلسات وألعاب',
      description: 'Recharge TopTop Diamonds instantly using User ID',
      descriptionAr: 'شحن ماسات توب توب المباشر عبر معرف الحساب',
      iconUrl: '/images/services/toptop.png',
      displayOrder: 3,
      fields: {
        create: [
          {
            fieldKey: 'user_id',
            label: 'TopTop ID',
            labelAr: 'معرف حساب توب توب (TopTop ID)',
            type: 'text',
            required: true,
            validationRegex: '^[0-9]{4,12}$',
            placeholderAr: 'أدخل آيدي حساب توب توب (مثال: 987654)',
            helperTextAr: 'انسخ المعرف المكون من أرقام من صفحة حسابك',
            displayOrder: 1,
          },
        ],
      },
    },
  });

  const toptopProducts = [
    { name: '1,500 Diamonds', nameAr: '1,500 ماسة توب توب', sku: 'TOPTOP-1500-DIA', yer: 520, usd: 1.0, sar: 3.8 },
    { name: '7,500 Diamonds', nameAr: '7,500 ماسة توب توب', sku: 'TOPTOP-7500-DIA', yer: 2600, usd: 4.95, sar: 19.0 },
    { name: '15,000 Diamonds', nameAr: '15,000 ماسة توب توب', sku: 'TOPTOP-15000-DIA', yer: 5100, usd: 9.8, sar: 37.0 },
    { name: '80,000 Diamonds', nameAr: '80,000 ماسة توب توب', sku: 'TOPTOP-80000-DIA', yer: 26000, usd: 49.99, sar: 190.0 },
  ];

  for (let i = 0; i < toptopProducts.length; i++) {
    const p = toptopProducts[i];
    await prisma.product.create({
      data: {
        serviceId: toptopService.id,
        name: p.name,
        nameAr: p.nameAr,
        sku: p.sku,
        displayOrder: i + 1,
        prices: {
          create: [
            { currency: CurrencyCode.YER, retailPrice: p.yer, costPrice: p.yer * 0.9 },
            { currency: CurrencyCode.USD, retailPrice: p.usd, costPrice: p.usd * 0.9 },
            { currency: CurrencyCode.SAR, retailPrice: p.sar, costPrice: p.sar * 0.9 },
          ],
        },
      },
    });
  }

  // 12. Create Initial Audit Log
  await prisma.auditLog.create({
    data: {
      userId: superAdmin.id,
      userRole: superAdmin.role,
      action: 'SYSTEM_INITIALIZATION',
      entityName: 'SYSTEM',
      entityId: 'ROOT',
      newValues: {
        market: 'YEMEN',
        version: '1.0.0',
        supportedCurrencies: ['YER', 'USD', 'SAR'],
        seededServices: ['PUBG Mobile', 'YoYo', 'TopTop'],
        ledgerStatus: 'INITIALIZED_BALANCED',
      },
      ipAddress: '127.0.0.1',
      userAgent: 'Prisma Seeder Script',
    },
  });

  console.log('--- Yemen Market Database Seeder Completed Successfully ---');
  console.log(`Super Admin: ${adminEmail}`);
  console.log('Synthetic finance/customer seed identities are disabled and have random unusable credentials.');
  console.log(`Initial Customer Balances: 50,000 YER | 100.00 USD | 200.00 SAR`);
}

main()
  .catch((e) => {
    console.error('Seeding Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
