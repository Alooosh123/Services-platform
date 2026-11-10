import { randomUUID } from 'crypto';
import {
  CurrencyCode,
  PaymentChannelCode,
  PaymentChannelMode,
  ChannelVerificationStatus,
  PaymentSenderIdentifierType,
  UserRole,
} from '@digital-topup/shared';
import { PrismaService } from '../../database/prisma.service';
import { EncryptionService } from '../../security/encryption.service';
import { PaymentSenderAccountsService } from './payment-sender-accounts.service';
import { DepositsService } from './deposits.service';
import { HmacSignatureService } from '../../security/hmac-signature.service';
import { PaymentAdapterRegistry, SandboxPaymentAdapter, JaibPaymentAdapter, JawaliPaymentAdapter, CashPaymentAdapter, OneCashPaymentAdapter, EasyPaymentAdapter } from './adapters/yemen-payment.adapters';

const databaseEnabled = !!process.env.DATABASE_URL && process.env.NODE_ENV === 'test';
const databaseDescribe = databaseEnabled ? describe : describe.skip;

databaseDescribe('Wallet sender identity approval database workflow (PostgreSQL)', () => {
  const previousEncryptionKey = process.env.ENCRYPTION_KEY;
  let prisma: PrismaService;
  let encryption: EncryptionService;
  let senderAccounts: PaymentSenderAccountsService;
  let deposits: DepositsService;
  let customerId: string | null = null;
  let ownerId: string | null = null;
  let channelId: string | null = null;
  let walletId: string | null = null;
  let accountId: string | null = null;

  beforeAll(async () => {
    process.env.ENCRYPTION_KEY = 'e'.repeat(64);
    prisma = new PrismaService();
    await prisma.onModuleInit();
    encryption = new EncryptionService();
    senderAccounts = new PaymentSenderAccountsService(prisma, encryption);

    const suffix = randomUUID().replace(/-/g, '').slice(0, 12);
    const owner = await prisma.user.create({
      data: {
        email: `wallet-owner-${suffix}@example.test`,
        phone: `+96777${suffix}`,
        passwordHash: 'e2e-not-used-password-hash',
        fullName: 'E2E Wallet Owner',
        fullNameAr: 'مالك اختبار المحافظ',
        role: UserRole.SUPER_ADMIN,
        isActive: true,
        isVerified: true,
      },
    });
    ownerId = owner.id;

    const customer = await prisma.user.create({
      data: {
        email: `wallet-customer-${suffix}@example.test`,
        phone: `+96778${suffix}`,
        passwordHash: 'e2e-not-used-password-hash',
        fullName: 'E2E Wallet Customer',
        fullNameAr: 'عميل اختبار المحافظ',
        role: UserRole.CUSTOMER,
        isActive: true,
        isVerified: true,
        phoneVerifiedAt: new Date(),
        wallets: {
          create: { currency: CurrencyCode.YER, balance: 0 },
        },
      },
      include: { wallets: true },
    });
    customerId = customer.id;
    walletId = customer.wallets.find((wallet) => wallet.currency === CurrencyCode.YER)!.id;

    const channel = await prisma.paymentChannelConfig.create({
      data: {
        code: PaymentChannelCode.WALLET,
        name: 'E2E Test Wallet',
        nameAr: 'محفظة اختبار التكامل',
        accountNumber: '7700001234',
        accountHolderName: 'E2E Official Receiver',
        instructionsAr: 'قناة اختبارية داخل قاعدة الاختبار فقط.',
        supportedCurrencies: ['YER'],
        senderIdentifierType: PaymentSenderIdentifierType.PHONE,
        minAmount: 1,
        maxAmount: 100000,
        mode: PaymentChannelMode.MANUAL,
        verificationStatus: ChannelVerificationStatus.VERIFIED,
        regulatoryApprovalReference: 'E2E-REGULATORY-REF',
        regulatoryApprovalDocumentUrl: 'https://example.test/e2e-regulatory.pdf',
        providerAgreementReference: 'E2E-MERCHANT-AGREEMENT',
        providerAgreementDocumentUrl: 'https://example.test/e2e-agreement.pdf',
        isActive: true,
      },
    });
    channelId = channel.id;

    const walletService = {
      getWallet: async (userId: string, currency: CurrencyCode) => {
        const wallet = await prisma.wallet.findFirst({ where: { userId, currency } });
        if (!wallet) throw new Error('Test wallet was not found.');
        return wallet;
      },
    };
    const adapterRegistry = new PaymentAdapterRegistry(
      new JaibPaymentAdapter(),
      new JawaliPaymentAdapter(),
      new CashPaymentAdapter(),
      new OneCashPaymentAdapter(),
      new EasyPaymentAdapter(),
      new SandboxPaymentAdapter(),
    );

    deposits = new DepositsService(
      prisma,
      {} as any,
      walletService as any,
      adapterRegistry,
      new HmacSignatureService(),
    );
  }, 30000);

  afterAll(async () => {
    try {
      if (customerId) {
        await prisma.walletAgentOperation.deleteMany({ where: { customerUserId: customerId } });
        await prisma.depositRequest.deleteMany({ where: { userId: customerId } });
        await prisma.paymentSenderAccount.deleteMany({ where: { userId: customerId } });
      }
      const actorIds = [customerId, ownerId].filter(Boolean) as string[];
      if (actorIds.length) {
        await prisma.notification.deleteMany({ where: { userId: { in: actorIds } } });
        await prisma.auditLog.deleteMany({ where: { userId: { in: actorIds } } });
      }
      if (walletId) await prisma.wallet.deleteMany({ where: { id: walletId } });
      if (channelId) await prisma.paymentChannelConfig.deleteMany({ where: { id: channelId } });
      if (actorIds.length) await prisma.user.deleteMany({ where: { id: { in: actorIds } } });
      await prisma?.onModuleDestroy();
    } finally {
      if (previousEncryptionKey === undefined) delete process.env.ENCRYPTION_KEY;
      else process.env.ENCRYPTION_KEY = previousEncryptionKey;
    }
  }, 30000);

  it('persists a once-only sender ID, waits for owner approval, then reuses it in a deposit request', async () => {
    const customer = customerId!;
    const owner = ownerId!;
    const identifier = '967771234567';

    const saved = await senderAccounts.saveForCustomer(customer, {
      channelCode: PaymentChannelCode.WALLET,
      identifierType: PaymentSenderIdentifierType.PHONE,
      identifier,
      consentAccepted: true,
    } as any);
    accountId = saved.id;

    expect(saved.status).toBe('PENDING_VERIFICATION');
    expect(saved.maskedIdentifier).toBe('•••• 4567');
    expect(encryption.decrypt(
      (await prisma.paymentSenderAccount.findUnique({ where: { id: saved.id } }))!.identifierCiphertext,
    )).toBe(identifier);

    await expect(
      deposits.createDepositRequest(customer, {
        currency: CurrencyCode.YER,
        amount: 5000,
        paymentMethodCode: PaymentChannelCode.WALLET,
        referenceNumber: `E2E-BEFORE-APPROVAL-${randomUUID().slice(0, 8)}`,
      } as any),
    ).rejects.toThrow('انتظر موافقة صاحب التطبيق');

    const ownerAlerts = await prisma.notification.findMany({
      where: { userId: owner, type: 'PAYMENT_SENDER_ACCOUNT_REVIEW' },
    });
    expect(ownerAlerts.some((item) => (item.data as any)?.paymentSenderAccountId === saved.id)).toBe(true);

    const approved = await senderAccounts.approveForOwner(saved.id, owner, 'تمت مراجعة بيانات رقم العميل.');
    expect(approved?.status).toBe('VERIFIED');
    expect(approved?.reviewedByUserId).toBe(owner);
    expect(approved?.verifiedAt).toBeInstanceOf(Date);

    const customerAlerts = await prisma.notification.findMany({
      where: { userId: customer, type: 'PAYMENT_SENDER_ACCOUNT_APPROVED' },
    });
    expect(customerAlerts.some((item) => (item.data as any)?.paymentSenderAccountId === saved.id)).toBe(true);

    // No senderAccountId is supplied by the customer: the backend must resolve
    // the one owner-approved record and attach it to this next deposit.
    const request = await deposits.createDepositRequest(customer, {
      currency: CurrencyCode.YER,
      amount: 5000,
      paymentMethodCode: PaymentChannelCode.WALLET,
      referenceNumber: `E2E-AFTER-APPROVAL-${randomUUID().replace(/-/g, '').slice(0, 12)}`,
    } as any);

    expect(request.success).toBe(true);
    expect(request.deposit.senderAccountId).toBe(saved.id);
    expect(request.deposit.userId).toBe(customer);
    expect(request.deposit.status).toBe('PENDING');
    const persistedWallet = await prisma.wallet.findUnique({ where: { id: walletId! } });
    expect(Number(persistedWallet?.balance)).toBe(0);
  });
});
