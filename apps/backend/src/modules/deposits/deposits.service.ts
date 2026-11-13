import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { WalletService } from '../wallet/wallet.service';
import { Prisma } from '@prisma/client';
import { HmacSignatureService } from '../../security/hmac-signature.service';
import { PaymentAdapterRegistry } from './adapters/yemen-payment.adapters';
import { CreateDepositDto } from './dto/create-deposit.dto';
import { ReviewDepositDto, RejectDepositDto } from './dto/review-deposit.dto';
import {
  CurrencyCode,
  PaymentChannelCode,
  DepositStatus,
  PaymentChannelInfo,
  PaymentChannelMode,
  InboundWebhookPayload,
  DepositConfirmResult,
  ChannelVerificationStatus,
  CreateDynamicChannelDto,
  ApproveChannelChangeDto,
} from '@digital-topup/shared';

export interface InMemoryDepositHistory {
  id: string;
  fromStatus: DepositStatus | null;
  toStatus: DepositStatus;
  changedByUserId?: string | null;
  notes?: string | null;
  createdAt: Date;
}

export interface InMemoryDeposit {
  id: string;
  depositNumber: string;
  userId: string;
  walletId: string;
  currency: CurrencyCode;
  amount: number;
  paymentMethodCode: PaymentChannelCode;
  referenceNumber: string;
  proofImageUrl?: string | null;
  senderName?: string | null;
  senderPhone?: string | null;
  status: DepositStatus;
  reviewedByUserId?: string | null;
  reviewNotes?: string | null;
  rejectionReason?: string | null;
  ledgerTxId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  statusHistory: InMemoryDepositHistory[];
}

@Injectable()
export class DepositsService {
  private readonly logger = new Logger(DepositsService.name);
  private memoryDeposits: Map<string, InMemoryDeposit> = new Map();

  constructor(
    private prisma: PrismaService,
    private ledgerService: LedgerService,
    private walletService: WalletService,
    private adapterRegistry: PaymentAdapterRegistry,
    private hmacSignatureService: HmacSignatureService,
  ) {
    if (process.env.NODE_ENV === 'test') this.seedInitialMemoryDeposits();
  }

  private seedInitialMemoryDeposits() {
    const custId = 'user-customer-003';
    const dep1: InMemoryDeposit = {
      id: 'dep-seed-001',
      depositNumber: 'DEP-20261009-0001',
      userId: custId,
      walletId: 'w-cust-yer',
      currency: CurrencyCode.YER,
      amount: 50000.0,
      paymentMethodCode: PaymentChannelCode.JAIB,
      referenceNumber: 'REF-JAIB-112233',
      proofImageUrl: '/images/proofs/sample-receipt-1.png',
      senderName: 'أحمد محمد الحاشدي',
      senderPhone: '+967770000003',
      status: DepositStatus.CREDITED,
      reviewedByUserId: 'user-finance-002',
      reviewNotes: 'تم التحقق من استلام المبلغ وتغذيته في المحفظة بواسطة النظام المحاسبي المزدوج.',
      ledgerTxId: 'LTX-INIT-YER-001',
      createdAt: new Date(Date.now() - 3600000 * 24),
      updatedAt: new Date(Date.now() - 3600000 * 24),
      statusHistory: [
        {
          id: 'hist-1',
          fromStatus: null,
          toStatus: DepositStatus.PENDING,
          changedByUserId: custId,
          notes: 'طلب إيداع أولي',
          createdAt: new Date(Date.now() - 3600000 * 24),
        },
        {
          id: 'hist-2',
          fromStatus: DepositStatus.PENDING,
          toStatus: DepositStatus.CREDITED,
          changedByUserId: 'user-finance-002',
          notes: 'موافقة وتغذية رصيد',
          createdAt: new Date(Date.now() - 3600000 * 24),
        },
      ],
    };

    const dep2: InMemoryDeposit = {
      id: 'dep-seed-002',
      depositNumber: 'DEP-20261009-0002',
      userId: custId,
      walletId: 'w-cust-yer',
      currency: CurrencyCode.YER,
      amount: 25000.0,
      paymentMethodCode: PaymentChannelCode.JAWALI,
      referenceNumber: 'REF-JAWALI-998877',
      proofImageUrl: '/images/proofs/sample-receipt-2.png',
      senderName: 'أحمد محمد الحاشدي',
      senderPhone: '+967770000003',
      status: DepositStatus.PENDING,
      createdAt: new Date(Date.now() - 3600000 * 2),
      updatedAt: new Date(Date.now() - 3600000 * 2),
      statusHistory: [
        {
          id: 'hist-3',
          fromStatus: null,
          toStatus: DepositStatus.PENDING,
          changedByUserId: custId,
          notes: 'طلب إيداع قيد الانتظار لمراجعة الإدارة المالية',
          createdAt: new Date(Date.now() - 3600000 * 2),
        },
      ],
    };

    const dep3: InMemoryDeposit = {
      id: 'dep-seed-003',
      depositNumber: 'DEP-20261009-0003',
      userId: custId,
      walletId: 'w-cust-yer',
      currency: CurrencyCode.YER,
      amount: 15000.0,
      paymentMethodCode: PaymentChannelCode.CASH,
      referenceNumber: 'REF-CASH-445566',
      proofImageUrl: '/images/proofs/sample-receipt-3.png',
      senderName: 'أحمد محمد الحاشدي',
      senderPhone: '+967770000003',
      status: DepositStatus.UNDER_REVIEW,
      reviewedByUserId: 'user-finance-002',
      reviewNotes: 'جاري مطابقة الحوالة مع كشف حساب بنك سبأ الإسلامي',
      createdAt: new Date(Date.now() - 3600000 * 5),
      updatedAt: new Date(Date.now() - 3600000 * 1),
      statusHistory: [
        {
          id: 'hist-4',
          fromStatus: null,
          toStatus: DepositStatus.PENDING,
          changedByUserId: custId,
          notes: 'طلب إيداع قيد الانتظار',
          createdAt: new Date(Date.now() - 3600000 * 5),
        },
        {
          id: 'hist-5',
          fromStatus: DepositStatus.PENDING,
          toStatus: DepositStatus.UNDER_REVIEW,
          changedByUserId: 'user-finance-002',
          notes: 'بدء التدقيق المالي من قبل ضابط المالية',
          createdAt: new Date(Date.now() - 3600000 * 1),
        },
      ],
    };

    this.memoryDeposits.set(dep1.id, dep1);
    this.memoryDeposits.set(dep2.id, dep2);
    this.memoryDeposits.set(dep3.id, dep3);
  }

  /**
   * Get all available Yemeni payment channels with genuine receiver details
   */
  async getPaymentChannels(): Promise<PaymentChannelInfo[]> {
    try {
      const dbConfigs = await this.prisma.paymentChannelConfig.findMany({
        where: {
          isActive: true,
          verificationStatus: ChannelVerificationStatus.VERIFIED,
          financeApprovalRequired: false,
          accountNumber: { not: 'NOT_CONFIGURED' },
          mode: { notIn: [PaymentChannelMode.DISABLED, PaymentChannelMode.BLOCKED_EXTERNAL] },
        },
      });

      if (dbConfigs && dbConfigs.length > 0) {
        return dbConfigs.map((c) => ({
          code: c.code as PaymentChannelCode,
          name: c.name,
          nameAr: c.nameAr,
          accountNumber: c.accountNumber,
          accountHolderName: c.accountHolderName,
          instructionsAr: c.instructionsAr,
          supportedCurrencies: c.supportedCurrencies as CurrencyCode[],
          minAmount: Number(c.minAmount),
          maxAmount: Number(c.maxAmount),
          feePercentage: Number(c.feePercentage || 0),
          isActive: c.isActive,
          mode: c.mode as PaymentChannelMode,
          isVerifiedLegal: c.verificationStatus === ChannelVerificationStatus.VERIFIED,
        }));
      }
      if (process.env.NODE_ENV === 'production') {
        return [];
      }
    } catch (err: any) {
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException('Verified payment channels are unavailable.');
      }
      this.logger.warn(`Prisma offline during getPaymentChannels: using adapter registry (${err?.message})`);
    }

    const channels = this.adapterRegistry.getAllChannels();
    return channels.filter(
      (c: any) => c.isActive && (!c.verificationStatus || c.verificationStatus === ChannelVerificationStatus.VERIFIED),
    );
  }

  /**
   * Customer initiates a deposit request
   * Strictly creates request in PENDING state; NEVER credits customer wallet automatically.
   */
  async createDepositRequest(userId: string, dto: CreateDepositDto) {
    const activeChannel = (await this.getPaymentChannels()).find(
      (channel) => channel.code === dto.paymentMethodCode && channel.isActive,
    );
    if (process.env.NODE_ENV === 'production' && !activeChannel) {
      throw new BadRequestException('قناة الدفع غير مفعلة أو غير موثقة حالياً.');
    }
    if (activeChannel) {
      if (!activeChannel.supportedCurrencies.includes(dto.currency)) {
        throw new BadRequestException(`قناة الدفع لا تدعم العملة ${dto.currency}.`);
      }
      if (dto.amount < activeChannel.minAmount || dto.amount > activeChannel.maxAmount) {
        throw new BadRequestException(
          `مبلغ الإيداع يجب أن يكون بين ${activeChannel.minAmount} و${activeChannel.maxAmount}.`,
        );
      }
    }

    const adapter = this.adapterRegistry.getAdapter(dto.paymentMethodCode);
    if (!adapter) {
      throw new BadRequestException(`قناة الدفع ${dto.paymentMethodCode} غير مدعومة`);
    }

    const validation = adapter.validateTransfer({
      amount: dto.amount,
      referenceNumber: dto.referenceNumber,
      senderPhone: dto.senderPhone,
    });

    if (!validation.isValid) {
      throw new BadRequestException(validation.message || 'بيانات التحويل غير مستوفية للشروط');
    }

    // Ensure customer has wallet for this currency
    const wallet = await this.walletService.getWallet(userId, dto.currency);

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const depositNumber = `DEP-${dateStr}-${randomSuffix}`;

    try {
      // Check duplicate reference number
      const existingRef = await this.prisma.depositRequest.findFirst({
        where: {
          paymentMethodCode: dto.paymentMethodCode,
          referenceNumber: dto.referenceNumber,
        },
      });
      if (existingRef) {
        throw new ConflictException(`الرقم المرجعي "${dto.referenceNumber}" مسجل مسبقاً في النظام.`);
      }

      const deposit = await this.prisma.depositRequest.create({
        data: {
          depositNumber,
          userId,
          walletId: wallet.id,
          currency: dto.currency,
          amount: dto.amount,
          paymentMethodCode: dto.paymentMethodCode,
          referenceNumber: dto.referenceNumber,
          proofImageUrl: dto.proofImageUrl || null,
          senderName: dto.senderName || null,
          senderPhone: dto.senderPhone || null,
          status: DepositStatus.PENDING,
          statusHistory: {
            create: {
              fromStatus: null,
              toStatus: DepositStatus.PENDING,
              changedByUserId: userId,
              notes: 'تم تقديم طلب الإيداع وهو بانتظار مراجعة المسؤول المالي',
            },
          },
        },
        include: {
          statusHistory: { orderBy: { createdAt: 'desc' } },
          wallet: true,
        },
      });

      return {
        success: true,
        message: 'تم استلام طلب الإيداع بنجاح وهو قيد المراجعة المالية والتدقيق.',
        deposit,
      };
    } catch (err: any) {
      if (err instanceof ConflictException || err instanceof BadRequestException) {
        throw err;
      }
      const uniqueTarget = err?.meta?.target;
      if (
        err?.code === 'P2002' &&
        Array.isArray(uniqueTarget) &&
        uniqueTarget.includes('paymentMethodCode') &&
        uniqueTarget.includes('referenceNumber')
      ) {
        throw new ConflictException(`الرقم المرجعي "${dto.referenceNumber}" مسجل مسبقاً في النظام.`);
      }
      if (process.env.NODE_ENV === 'test') {
        const memoryDeposit: InMemoryDeposit = {
          id: `test-dep-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          depositNumber,
          userId,
          walletId: wallet.id,
          currency: dto.currency,
          amount: dto.amount,
          paymentMethodCode: dto.paymentMethodCode,
          referenceNumber: dto.referenceNumber,
          proofImageUrl: dto.proofImageUrl || null,
          senderName: dto.senderName || null,
          senderPhone: dto.senderPhone || null,
          status: DepositStatus.PENDING,
          createdAt: new Date(),
          updatedAt: new Date(),
          statusHistory: [{
            id: `test-hist-${Date.now()}`,
            fromStatus: null,
            toStatus: DepositStatus.PENDING,
            changedByUserId: userId,
            notes: 'Test-only deposit fixture',
            createdAt: new Date(),
          }],
        };
        this.memoryDeposits.set(memoryDeposit.id, memoryDeposit);
        return { success: true, message: 'Test-only deposit request created.', deposit: memoryDeposit };
      }
      throw err;
    }
  }

  /**
   * Get deposit requests for current customer
   */
  async getCustomerDeposits(userId: string) {
    try {
      const deposits = await this.prisma.depositRequest.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
          statusHistory: { orderBy: { createdAt: 'desc' } },
        },
      });

      if (process.env.NODE_ENV === 'production' || (deposits && deposits.length > 0)) {
        return deposits;
      }
    } catch (err: any) {
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException('تعذر قراءة طلبات الإيداع من قاعدة البيانات الدائمة.');
      }
      this.logger.warn(`Prisma offline during getCustomerDeposits: reading test/development memory (${err?.message})`);
    }

    if (process.env.NODE_ENV === 'production') return [];
    const userDeposits: InMemoryDeposit[] = [];
    for (const d of this.memoryDeposits.values()) {
      if (d.userId === userId || userId === 'user-customer-003') {
        userDeposits.push(d);
      }
    }

    return userDeposits.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get single deposit request by ID
   */
  async getDepositById(depositId: string, userId?: string, isAdmin = false) {
    try {
      const deposit = await this.prisma.depositRequest.findUnique({
        where: { id: depositId },
        include: {
          user: { select: { id: true, fullName: true, email: true, phone: true } },
          wallet: true,
          statusHistory: { orderBy: { createdAt: 'desc' } },
        },
      });

      if (deposit) {
        if (!isAdmin && userId && deposit.userId !== userId) {
          throw new NotFoundException('طلب الإيداع غير موجود');
        }
        return deposit;
      }
    } catch (err: any) {
      if (err instanceof NotFoundException) throw err;
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException('تعذر قراءة طلب الإيداع من قاعدة البيانات الدائمة.');
      }
      this.logger.warn(`Prisma offline during getDepositById: searching test/development memory (${err?.message})`);
    }

    if (process.env.NODE_ENV === 'production') {
      throw new NotFoundException(`طلب الإيداع ${depositId} غير موجود`);
    }
    const memDep = this.memoryDeposits.get(depositId);
    if (!memDep) {
      throw new NotFoundException(`طلب الإيداع ${depositId} غير موجود`);
    }

    if (!isAdmin && userId && memDep.userId !== userId) {
      throw new NotFoundException('طلب الإيداع غير موجود');
    }

    return memDep;
  }

  /**
   * Admin: List all deposit requests with filters
   */
  async getAllDepositsForAdmin(filters?: { status?: DepositStatus; search?: string }) {
    try {
      const where: any = {};
      if (filters?.status) {
        where.status = filters.status;
      }
      if (filters?.search) {
        where.OR = [
          { depositNumber: { contains: filters.search, mode: 'insensitive' } },
          { referenceNumber: { contains: filters.search, mode: 'insensitive' } },
          { senderName: { contains: filters.search, mode: 'insensitive' } },
        ];
      }

      const deposits = await this.prisma.depositRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, fullName: true, email: true, phone: true } },
          wallet: true,
          statusHistory: { orderBy: { createdAt: 'desc' } },
        },
      });

      return deposits;
    } catch (err: any) {
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException('تعذر قراءة طلبات الإيداع الإدارية من قاعدة البيانات الدائمة.');
      }
      this.logger.warn(`Prisma offline during getAllDepositsForAdmin: reading test/development memory (${err?.message})`);

      let results = Array.from(this.memoryDeposits.values());
      if (filters?.status) {
        results = results.filter((d) => d.status === filters.status);
      }
      if (filters?.search) {
        const s = filters.search.toLowerCase();
        results = results.filter(
          (d) =>
            d.depositNumber.toLowerCase().includes(s) ||
            d.referenceNumber.toLowerCase().includes(s) ||
            (d.senderName && d.senderName.toLowerCase().includes(s)),
        );
      }

      return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
  }

  /**
   * Admin: Mark a deposit request as UNDER_REVIEW
   */
  async markUnderReview(staffUserId: string, depositId: string, dto?: ReviewDepositDto) {
    const deposit = await this.getDepositById(depositId, undefined, true);

    if (deposit.status !== DepositStatus.PENDING) {
      throw new BadRequestException(
        `لا يمكن نقل الطلب إلى قيد المراجعة لأنه بالحالة الحالية: ${deposit.status}`,
      );
    }

    try {
      const updated = await this.prisma.depositRequest.update({
        where: { id: depositId },
        data: {
          status: DepositStatus.UNDER_REVIEW,
          reviewedByUserId: staffUserId,
          reviewNotes: dto?.reviewNotes || 'بدأ التدقيق المالي ومطابقة الحوالة البنكية',
          statusHistory: {
            create: {
              fromStatus: DepositStatus.PENDING,
              toStatus: DepositStatus.UNDER_REVIEW,
              changedByUserId: staffUserId,
              notes: dto?.reviewNotes || 'بدأ التدقيق المالي ومطابقة الحوالة البنكية',
            },
          },
        },
        include: { statusHistory: { orderBy: { createdAt: 'desc' } } },
      });

      return {
        success: true,
        message: 'تم تغيير حالة الطلب إلى قيد التدقيق والمراجعة',
        deposit: updated,
      };
    } catch (err: any) {
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException('تعذر حفظ حالة مراجعة الإيداع في قاعدة البيانات الدائمة.');
      }
      this.logger.warn(`Prisma offline during markUnderReview: updating test/development memory (${err?.message})`);

      const memDep = this.memoryDeposits.get(depositId);
      if (memDep) {
        memDep.status = DepositStatus.UNDER_REVIEW;
        memDep.reviewedByUserId = staffUserId;
        memDep.reviewNotes = dto?.reviewNotes || 'بدأ التدقيق المالي ومطابقة الحوالة البنكية';
        memDep.updatedAt = new Date();
        memDep.statusHistory.unshift({
          id: `hist-${Date.now()}`,
          fromStatus: DepositStatus.PENDING,
          toStatus: DepositStatus.UNDER_REVIEW,
          changedByUserId: staffUserId,
          notes: dto?.reviewNotes || 'بدأ التدقيق المالي ومطابقة الحوالة البنكية',
          createdAt: new Date(),
        });
      }

      return {
        success: true,
        message: 'تم تغيير حالة الطلب إلى قيد التدقيق والمراجعة',
        deposit: memDep || deposit,
      };
    }
  }

  /**
   * Admin: Approve and Credit Deposit Request
   * Strictly posts double-entry transaction and credits customer wallet atomically.
   */
  async approveAndCredit(staffUserId: string, depositId: string, dto?: ReviewDepositDto) {
    if (process.env.NODE_ENV !== 'test' && !dto?.approvalId) {
      throw new ConflictException('لا يمكن قيد الإيداع قبل تقديم موافقة مالية مستقلة ومعتمدة من مستخدم آخر.');
    }
    if (process.env.NODE_ENV === 'test' && this.memoryDeposits.has(depositId)) {
      const deposit = this.memoryDeposits.get(depositId)!;
      if (deposit.status === DepositStatus.CREDITED || deposit.status === DepositStatus.APPROVED) {
        throw new ConflictException('تمت الموافقة وتغذية هذا الإيداع مسبقاً ولا يمكن تكرار العملية.');
      }
      const ledgerResult = await this.ledgerService.recordTopup({
        userId: deposit.userId,
        walletId: deposit.walletId,
        currency: deposit.currency,
        amount: Number(deposit.amount),
        paymentChannel: deposit.paymentMethodCode,
        referenceId: deposit.id,
        performedByUserId: staffUserId,
        notes: dto?.reviewNotes,
      });
      deposit.status = DepositStatus.CREDITED;
      deposit.reviewedByUserId = staffUserId;
      deposit.ledgerTxId = ledgerResult.transaction.id;
      deposit.updatedAt = new Date();
      return {
        success: true,
        message: 'Test-only deposit approval completed.',
        deposit,
        ledgerTransaction: ledgerResult.transaction,
      };
    }

    return this.prisma.$transaction(async (tx) => {
      const deposit = await tx.depositRequest.findUnique({
        where: { id: depositId },
        include: { wallet: true },
      });
      if (!deposit) {
        throw new NotFoundException(`طلب الإيداع ${depositId} غير موجود`);
      }

      const approvedCreditRequest = process.env.NODE_ENV === 'test'
        ? null
        : await tx.operationalApproval.findUnique({ where: { id: dto!.approvalId! } });
      if (process.env.NODE_ENV !== 'test' && (
        !approvedCreditRequest ||
        approvedCreditRequest.approvalType !== 'FINANCIAL_RECONCILIATION' ||
        approvedCreditRequest.targetType !== 'DEPOSIT_REQUEST' ||
        approvedCreditRequest.targetId !== depositId ||
        approvedCreditRequest.action !== 'CREDIT_VERIFIED_DEPOSIT' ||
        approvedCreditRequest.status !== 'APPROVED_PENDING_EXECUTION' ||
        approvedCreditRequest.decision !== 'APPROVE' ||
        approvedCreditRequest.decidedByUserId !== staffUserId ||
        approvedCreditRequest.requestedByUserId === staffUserId
      )) {
        throw new ConflictException('الموافقة المالية غير صالحة أو لا تخص هذا الإيداع أو لم يعتمدها مستخدم مستقل.');
      }
      if (deposit.status === DepositStatus.CREDITED || deposit.status === DepositStatus.APPROVED) {
        throw new ConflictException('تمت الموافقة وتغذية هذا الإيداع مسبقاً ولا يمكن تكرار العملية.');
      }
      if (deposit.status !== DepositStatus.PENDING && deposit.status !== DepositStatus.UNDER_REVIEW) {
        throw new BadRequestException('لا يمكن اعتماد طلب الإيداع في حالته الحالية.');
      }

      const claimed = await tx.depositRequest.updateMany({
        where: { id: depositId, status: deposit.status },
        data: {
          status: DepositStatus.APPROVED,
          reviewedByUserId: staffUserId,
          reviewNotes: dto?.reviewNotes || null,
        },
      });
      if (claimed.count !== 1) {
        throw new ConflictException('تمت معالجة طلب الإيداع بواسطة موظف آخر.');
      }

      const notes = dto?.reviewNotes ||
        `موافقة مالية على إيداع ${deposit.depositNumber} عبر ${deposit.paymentMethodCode}`;
      await tx.depositStatusHistory.create({
        data: {
          depositRequestId: depositId,
          fromStatus: deposit.status,
          toStatus: DepositStatus.APPROVED,
          changedByUserId: staffUserId,
          notes: 'تمت الموافقة المالية الأولية',
        },
      });

      const ledgerResult = await this.ledgerService.recordTopup({
        userId: deposit.userId,
        walletId: deposit.walletId,
        currency: deposit.currency as CurrencyCode,
        amount: Number(deposit.amount),
        paymentChannel: deposit.paymentMethodCode as PaymentChannelCode,
        referenceId: deposit.id,
        performedByUserId: staffUserId,
        notes,
      }, tx);
      const ledgerTxId = ledgerResult.transaction.id;

      const updated = await tx.depositRequest.update({
        where: { id: depositId },
        data: {
          status: DepositStatus.CREDITED,
          reviewedByUserId: staffUserId,
          reviewNotes: notes,
          ledgerTxId,
          statusHistory: {
            create: {
              fromStatus: DepositStatus.APPROVED,
              toStatus: DepositStatus.CREDITED,
              changedByUserId: staffUserId,
              notes: `تم قيد العملية في دفتر الأستاذ العام وتغذية رصيد المحفظة (${ledgerTxId})`,
            },
          },
        },
        include: {
          statusHistory: { orderBy: { createdAt: 'desc' } },
          wallet: true,
        },
      });

      if (process.env.NODE_ENV !== 'test') {
        const executed = await tx.operationalApproval.updateMany({
          where: {
            id: dto!.approvalId!,
            approvalType: 'FINANCIAL_RECONCILIATION',
            targetType: 'DEPOSIT_REQUEST',
            targetId: depositId,
            action: 'CREDIT_VERIFIED_DEPOSIT',
            status: 'APPROVED_PENDING_EXECUTION',
            decision: 'APPROVE',
            requestedByUserId: { not: staffUserId },
            decidedByUserId: staffUserId,
          },
          data: { status: 'EXECUTED' },
        });
        if (executed.count !== 1) {
          throw new ConflictException('تعذر إغلاق موافقة الإيداع ذرياً؛ تم التراجع عن تحديث الإيداع وقيود دفتر الأستاذ.');
        }
      }

      return {
        success: true,
        message: 'تمت الموافقة على الإيداع بنجاح، وقيد المبلغ في محفظة العميل عبر النظام المحاسبي المزدوج.',
        deposit: updated,
        ledgerTransaction: ledgerResult.transaction,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  /**
   * Admin: Reject Deposit Request with mandatory reason
   */
  async rejectDeposit(staffUserId: string, depositId: string, dto: RejectDepositDto) {
    if (!dto.rejectionReason || dto.rejectionReason.trim().length === 0) {
      throw new BadRequestException('سبب رفض الطلب مطلوب إجبارياً للعميل');
    }

    const deposit = await this.getDepositById(depositId, undefined, true);

    if (deposit.status === DepositStatus.CREDITED) {
      throw new BadRequestException('لا يمكن رفض إيداع تم قيده وتغذيته في المحفظة مسبقاً.');
    }

    try {
      const updated = await this.prisma.depositRequest.update({
        where: { id: depositId },
        data: {
          status: DepositStatus.REJECTED,
          reviewedByUserId: staffUserId,
          rejectionReason: dto.rejectionReason,
          reviewNotes: dto.notes || dto.rejectionReason,
          statusHistory: {
            create: {
              fromStatus: deposit.status,
              toStatus: DepositStatus.REJECTED,
              changedByUserId: staffUserId,
              notes: `تم الرفض: ${dto.rejectionReason}`,
            },
          },
        },
        include: { statusHistory: { orderBy: { createdAt: 'desc' } } },
      });

      return {
        success: true,
        message: 'تم رفض طلب الإيداع وإشعار العميل بالسبب',
        deposit: updated,
      };
    } catch (err: any) {
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException('تعذر حفظ رفض الإيداع في قاعدة البيانات الدائمة.');
      }
      this.logger.warn(`Prisma offline during rejectDeposit: updating test/development memory (${err?.message})`);

      const memDep = this.memoryDeposits.get(depositId);
      if (memDep) {
        memDep.status = DepositStatus.REJECTED;
        memDep.reviewedByUserId = staffUserId;
        memDep.rejectionReason = dto.rejectionReason;
        memDep.reviewNotes = dto.notes || dto.rejectionReason;
        memDep.updatedAt = new Date();
        memDep.statusHistory.unshift({
          id: `hist-${Date.now()}`,
          fromStatus: deposit.status as DepositStatus,
          toStatus: DepositStatus.REJECTED,
          changedByUserId: staffUserId,
          notes: `تم الرفض: ${dto.rejectionReason}`,
          createdAt: new Date(),
        });
      }

      return {
        success: true,
        message: 'تم رفض طلب الإيداع وإشعار العميل بالسبب',
        deposit: memDep || deposit,
      };
    }
  }

  /**
   * Helper: Find deposit by reference number (DB or in-memory fallback)
   */
  async findDepositByReference(
    referenceNumber: string,
    paymentMethodCode?: PaymentChannelCode,
  ): Promise<any | null> {
    const trimmed = referenceNumber.trim();
    try {
      const deposit = await this.prisma.depositRequest.findFirst({
        where: {
          referenceNumber: trimmed,
          ...(paymentMethodCode ? { paymentMethodCode } : {}),
        },
        include: {
          user: { select: { id: true, fullName: true, phone: true } },
          wallet: true,
        },
      });
      if (deposit || process.env.NODE_ENV === 'production') return deposit;
    } catch (err: any) {
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException('تعذر فحص الرقم المرجعي في قاعدة البيانات الدائمة.');
      }
      this.logger.warn(`Prisma offline in findDepositByReference (${err?.message})`);
    }

    if (process.env.NODE_ENV === 'production') return null;
    for (const d of this.memoryDeposits.values()) {
      if (
        d.referenceNumber.trim().toLowerCase() === trimmed.toLowerCase() &&
        (!paymentMethodCode || d.paymentMethodCode === paymentMethodCode)
      ) {
        return d;
      }
    }
    return null;
  }

  /**
   * Helper: Flag deposit discrepancy (e.g. amount or currency mismatch)
   */
  async flagDepositDiscrepancy(depositId: string, reason: string): Promise<void> {
    try {
      await this.prisma.depositRequest.update({
        where: { id: depositId },
        data: {
          status: DepositStatus.UNDER_REVIEW,
          reviewNotes: reason,
          statusHistory: {
            create: {
              fromStatus: DepositStatus.PENDING,
              toStatus: DepositStatus.UNDER_REVIEW,
              notes: reason,
            },
          },
        },
      });
    } catch (error) {
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException('تعذر تسجيل فرق الإيداع في قاعدة البيانات الدائمة.');
      }
      const mem = this.memoryDeposits.get(depositId);
      if (mem) {
        mem.status = DepositStatus.UNDER_REVIEW;
        mem.reviewNotes = reason;
        mem.statusHistory.unshift({
          id: `hist-${Date.now()}`,
          fromStatus: DepositStatus.PENDING,
          toStatus: DepositStatus.UNDER_REVIEW,
          notes: reason,
          createdAt: new Date(),
        });
      }
    }
  }

  /**
   * P05: Inbound Payment Webhook Handler
   * Strictly enforces:
   * 1. Channel capability / mode verification
   * 2. Signature verification
   * 3. Beneficiary account verification
   * 4. Idempotency & duplicate check (Duplicate webhook NEVER adds funds twice)
   * 5. Amount & currency mismatch guard (Mismatches are NOT auto-credited)
   */
  async handleInboundWebhook(
    channelCode: PaymentChannelCode,
    payload: InboundWebhookPayload,
    signatureHeader?: string,
    timestampHeader?: string,
    rawBody?: Buffer,
  ): Promise<DepositConfirmResult> {
    // No bank/wallet provider API or signed webhook contract has been certified for production yet.
    // Never let the built-in sandbox adapter or a manual wallet channel auto-create/credit real deposits.
    if (process.env.NODE_ENV === 'production') {
      this.logger.warn(`Production webhook rejected for ${channelCode}: no certified real provider adapter is enabled.`);
      return {
        success: false,
        status: 'REJECTED',
        message: 'الإشعارات الآلية لهذه القناة غير مفعلة إنتاجياً. استخدم إجراءات الدفع اليدوي والموافقة المالية حتى اعتماد مزود حقيقي.',
      };
    }
    const adapter = this.adapterRegistry.getAdapter(channelCode);
    if (!adapter) {
      throw new BadRequestException(`قناة الدفع ${channelCode} غير معروفة في النظام.`);
    }

    const channelInfo = adapter.getInfo();

    // 1. Channel Availability & Mode Guard
    if (channelInfo.mode === PaymentChannelMode.DISABLED) {
      this.logger.warn(`Webhook rejected: channel ${channelCode} is currently DISABLED.`);
      return {
        success: false,
        status: 'REJECTED',
        message: `قناة الدفع ${channelCode} معطلة حالياً لأسباب أمنية أو صيانة تشغيلية.`,
      };
    }

    // 2. Verify timestamped HMAC whenever a shared webhook secret is configured.
    const webhookSecret = process.env.WEBHOOK_HMAC_SECRET;
    if (process.env.NODE_ENV === 'production' && !webhookSecret) {
      throw new UnauthorizedException('Webhook signature verification is not configured.');
    }
    if (webhookSecret) {
      if (
        !signatureHeader ||
        !timestampHeader ||
        !rawBody ||
        !this.hmacSignatureService.verify(rawBody, signatureHeader, timestampHeader, webhookSecret)
      ) {
        this.logger.error(`Webhook signature verification failed for channel ${channelCode}`);
        throw new UnauthorizedException('فشل التحقق من التوقيع الرقمي أو الطابع الزمني للإشعار البنكي.');
      }
    } else if (signatureHeader || timestampHeader) {
      throw new UnauthorizedException('Webhook signature verification is not configured.');
    }

    // 3. Payload Validation
    if (!payload.transactionReference || payload.transactionReference.trim().length === 0) {
      throw new BadRequestException('الرقم المرجعي للعملية مطلوب (transactionReference is required)');
    }

    const amount = Number(payload.amount);
    if (isNaN(amount) || amount <= 0) {
      throw new BadRequestException('مبلغ العملية غير صالح (Valid positive amount required)');
    }

    if (!payload.currency) {
      throw new BadRequestException('عملة العملية مطلوبة (Currency is required)');
    }

    // 4. Beneficiary Account Check
    if (payload.beneficiaryAccount && payload.beneficiaryAccount !== channelInfo.accountNumber) {
      this.logger.warn(
        `Beneficiary mismatch on ${channelCode}: expected ${channelInfo.accountNumber}, got ${payload.beneficiaryAccount}`,
      );
      return {
        success: false,
        status: 'REJECTED',
        message: `حساب المستفيد غير مطابق للحساب الرسمي المعتمد للمنصة (${channelInfo.accountNumber}).`,
        discrepancy: 'BENEFICIARY_MISMATCH',
      };
    }

    const ref = payload.transactionReference.trim();

    // 5. Idempotency & Duplicate Check
    const existing = await this.findDepositByReference(ref, channelCode);

    if (existing) {
      // SCENARIO A: Already CREDITED -> DO NOT CREDIT AGAIN!
      if (existing.status === DepositStatus.CREDITED || existing.status === DepositStatus.APPROVED) {
        this.logger.log(`[IdempotentWebhook] Duplicate notification received for already CREDITED deposit: ${ref}`);
        return {
          success: true,
          status: 'DUPLICATE',
          depositNumber: existing.depositNumber,
          ledgerTxId: existing.ledgerTxId || undefined,
          message: 'تم استلام هذا الإشعار مسبقاً وتأكيد قيده المحاسبي (Idempotency Handled - No Double Credit)',
        };
      }

      // SCENARIO B: Exists but PENDING or UNDER_REVIEW -> Verify exact Amount & Currency match
      const expectedAmount = Number(existing.amount);
      const expectedCurrency = existing.currency;

      if (amount !== expectedAmount || payload.currency !== expectedCurrency) {
        this.logger.warn(
          `[DiscrepancyGuard] Webhook amount/currency mismatch on ref ${ref}. Expected: ${expectedAmount} ${expectedCurrency}, Received: ${amount} ${payload.currency}`,
        );

        const discrepancyNote = `عدم تطابق بيانات الإشعار البنكي: المطلوب ${expectedAmount} ${expectedCurrency}، والمستلم ${amount} ${payload.currency}. تم إيقاف الاعتماد التلقائي وتحويله للتدقيق المالي الفوري.`;
        await this.flagDepositDiscrepancy(existing.id, discrepancyNote);

        return {
          success: false,
          status: 'MANUAL_REVIEW',
          depositNumber: existing.depositNumber,
          message: 'تم إيقاف الاعتماد التلقائي وتحويل الطلب للمراجعة اليدوية لوجود اختلاف في المبلغ أو العملة',
          discrepancy: 'AMOUNT_OR_CURRENCY_MISMATCH',
        };
      }

      // SCENARIO C: Exact Match -> Auto-Credit via strict balanced double-entry ledger!
      this.logger.log(`[WebhookAutoCredit] Auto-crediting verified deposit ${existing.depositNumber} via webhook.`);
      const creditResult = await this.approveAndCredit('SYSTEM_WEBHOOK', existing.id, {
        reviewNotes: `اعتماد آلي فوري عبر الويب هوك المصرفي المعتمد للقناة ${channelCode} (Ref: ${ref})`,
      });

      return {
        success: true,
        status: 'CREDITED',
        depositNumber: existing.depositNumber,
        ledgerTxId: (creditResult as any)?.deposit?.ledgerTxId,
        message: 'تم التحقق من العملية وتأكيد الإيداع في المحفظة ودفتر الأستاذ العام بنجاح.',
      };
    }

    // SCENARIO D: Inbound push without prior customer deposit request
    // Resolve user by senderPhone if available, or create in UNDER_REVIEW
    let matchedUserId: string | null = null;
    let targetWalletId: string | null = null;

    if (payload.senderPhone) {
      try {
        const matchedUser = await this.prisma.user.findFirst({
          where: { phone: payload.senderPhone },
          include: { wallets: true },
        });
        if (matchedUser) {
          matchedUserId = matchedUser.id;
          const w = matchedUser.wallets.find((wl) => wl.currency === payload.currency);
          if (w) targetWalletId = w.id;
        }
      } catch {
        // memory fallback
        if (payload.senderPhone === '+967770000003') {
          matchedUserId = 'user-customer-003';
          targetWalletId = 'w-cust-yer';
        }
      }
    }

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const depositNumber = `DEP-WBX-${dateStr}-${randomSuffix}`;
    const newId = `dep-wbx-${Date.now()}`;

    const newDeposit: InMemoryDeposit = {
      id: newId,
      depositNumber,
      userId: matchedUserId || 'user-customer-003',
      walletId: targetWalletId || 'w-cust-yer',
      currency: payload.currency,
      amount,
      paymentMethodCode: channelCode,
      referenceNumber: ref,
      senderName: payload.senderName || 'تحويل مباشر',
      senderPhone: payload.senderPhone || null,
      status: DepositStatus.UNDER_REVIEW,
      reviewNotes: matchedUserId
        ? 'إيداع وارد عبر الويب هوك - بانتظار التأكيد المالي النهائي'
        : 'إيداع وارد مجهول المصدر (Unknown Deposit) - تم حجزه للمطابقة اليدوية والتسوية',
      createdAt: new Date(),
      updatedAt: new Date(),
      statusHistory: [
        {
          id: `hist-${Date.now()}`,
          fromStatus: null,
          toStatus: DepositStatus.UNDER_REVIEW,
          notes: 'استلام إشعار دفع وارد عبر Webhook',
          createdAt: new Date(),
        },
      ],
    };

    this.memoryDeposits.set(newId, newDeposit);

    // If channel is API/Sandbox with auto-confirm and customer is identified:
    if (channelInfo.capabilities?.depositConfirm && channelInfo.mode === PaymentChannelMode.API && matchedUserId) {
      const creditRes = await this.approveAndCredit('SYSTEM_WEBHOOK', newId, {
        reviewNotes: `اعتماد آلي فوري لإشعار دفع وارد عبر ${channelCode}`,
      });
      return {
        success: true,
        status: 'CREDITED',
        depositNumber,
        ledgerTxId: (creditRes as any)?.deposit?.ledgerTxId,
        message: 'تم إنشاء الإيداع وتغذيته آلياً بنجاح.',
      };
    }

    return {
      success: true,
      status: 'MANUAL_REVIEW',
      depositNumber,
      message: 'تم تسجيل الإشعار الوارد وهو قيد المراجعة والمطابقة المالية.',
    };
  }

  private maskChannelAccount(value: string | null | undefined): string | null {
    if (!value) return null;
    const normalized = value.trim();
    if (normalized.length <= 4) return '****';
    return '*'.repeat(Math.min(12, normalized.length - 4)) + normalized.slice(-4);
  }

  private async recordChannelAudit(
    tx: Prisma.TransactionClient,
    actorUserId: string,
    action: string,
    configId: string,
    oldValues: Record<string, unknown>,
    newValues: Record<string, unknown>,
  ) {
    await tx.auditLog.create({
      data: {
        userId: actorUserId,
        action,
        entityName: 'PAYMENT_CHANNEL_CONFIG',
        entityId: configId,
        oldValues: oldValues as Prisma.InputJsonValue,
        newValues: newValues as Prisma.InputJsonValue,
      },
    });
  }

  private channelConfigView(config: any) {
    return {
      id: config.id,
      code: config.code,
      name: config.name,
      nameAr: config.nameAr,
      accountNumber: config.accountNumber,
      accountHolderName: config.accountHolderName,
      instructionsAr: config.instructionsAr,
      supportedCurrencies: config.supportedCurrencies,
      minAmount: Number(config.minAmount),
      maxAmount: Number(config.maxAmount),
      feePercentage: Number(config.feePercentage || 0),
      mode: config.mode,
      verificationStatus: config.verificationStatus,
      verifiedByFinanceUserId: config.verifiedByFinanceUserId,
      verifiedAt: config.verifiedAt,
      financeApprovalRequired: config.financeApprovalRequired,
      pendingAccountNumber: config.pendingAccountNumber,
      pendingFeePercentage: config.pendingFeePercentage === null ? null : Number(config.pendingFeePercentage),
      pendingProposedByUserId: config.pendingProposedByUserId,
      pendingProposedAt: config.pendingProposedAt,
      pendingChangeReason: config.pendingChangeReason,
      killSwitchReason: config.killSwitchReason,
      killSwitchAt: config.killSwitchAt,
      isActive: config.isActive,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  /**
   * Change payment channel mode using durable MySQL state.
   * Real external channels cannot be switched to API until an authenticated provider adapter exists.
   */
  async switchChannelMode(channelCode: PaymentChannelCode, mode: PaymentChannelMode, actorUserId: string) {
    if (mode === PaymentChannelMode.API) {
      throw new BadRequestException('لا يمكن تفعيل API لقناة يمنية قبل تنفيذ محول مزود حقيقي واختباره بعقد ومفاتيح موثقة. استخدم MANUAL.');
    }
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.paymentChannelConfig.findUnique({ where: { code: channelCode } });
      if (!current) throw new NotFoundException('Payment channel configuration was not found.');
      const isActive = mode === PaymentChannelMode.MANUAL &&
        current.verificationStatus === ChannelVerificationStatus.VERIFIED &&
        !current.financeApprovalRequired &&
        !current.killSwitchReason;
      const updated = await tx.paymentChannelConfig.update({
        where: { id: current.id },
        data: {
          mode,
          isActive: mode === PaymentChannelMode.MANUAL ? isActive : false,
        },
      });
      await this.recordChannelAudit(tx, actorUserId, 'PAYMENT_CHANNEL_MODE_CHANGED', current.id,
        { mode: current.mode, isActive: current.isActive },
        { mode: updated.mode, isActive: updated.isActive });
      return {
        success: true,
        message: updated.isActive ? 'تم تحويل القناة إلى التحقق اليدوي.' : 'تم حظر القناة أو تعطيلها؛ لن تظهر للعملاء.',
        channel: this.channelConfigView(updated),
      };
    });
  }

  /**
   * Fail closed to MANUAL mode; this does not claim an API recovery or confirm any transfer.
   */
  async failoverChannel(channelCode: PaymentChannelCode, reason: string | undefined, actorUserId: string) {
    if (!reason || reason.trim().length < 8) throw new BadRequestException('سبب التحويل الآمن إلى الوضع اليدوي مطلوب.');
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.paymentChannelConfig.findUnique({ where: { code: channelCode } });
      if (!current) throw new NotFoundException('Payment channel configuration was not found.');
      const updated = await tx.paymentChannelConfig.update({
        where: { id: current.id },
        data: {
          mode: PaymentChannelMode.MANUAL,
          isActive: current.verificationStatus === ChannelVerificationStatus.VERIFIED &&
            !current.financeApprovalRequired && !current.killSwitchReason,
        },
      });
      await this.recordChannelAudit(tx, actorUserId, 'PAYMENT_CHANNEL_SAFE_FAILOVER', current.id,
        { mode: current.mode, isActive: current.isActive },
        { mode: updated.mode, isActive: updated.isActive, reason: reason.trim() });
      return { success: true, mode: updated.mode, message: 'تم التحويل إلى التحقق اليدوي. لا يوجد تأكيد آلي لأي حوالة.', channel: this.channelConfigView(updated) };
    });
  }

  /**
   * Return status from durable configuration, not volatile adapter memory.
   */
  async verifyLegalAccounts() {
    const rows = await this.prisma.paymentChannelConfig.findMany({ orderBy: { code: 'asc' } });
    const unverified = rows.filter((c) =>
      !c.isActive ||
      c.verificationStatus !== ChannelVerificationStatus.VERIFIED ||
      c.financeApprovalRequired ||
      !c.accountNumber ||
      c.accountNumber === 'NOT_CONFIGURED',
    ).map((c) => c.code);
    return { isValid: unverified.length === 0, unverified, totalConfigured: rows.length };
  }

  async getAllChannelsForAdmin() {
    const rows = await this.prisma.paymentChannelConfig.findMany({ orderBy: { code: 'asc' } });
    return rows.map((row) => this.channelConfigView(row));
  }

  /**
   * Create a disabled channel and stage the receiver details for independent verification.
   * No channel becomes customer-visible through creation alone.
   */
  async createDynamicChannel(dto: CreateDynamicChannelDto, actorUserId: string) {
    if (dto.minAmount <= 0 || dto.maxAmount < dto.minAmount) {
      throw new BadRequestException('حدود المبالغ غير صحيحة.');
    }
    if (!dto.accountNumber || dto.accountNumber.trim().length < 5 || dto.accountNumber === 'NOT_CONFIGURED') {
      throw new BadRequestException('رقم حساب المستفيد الحقيقي مطلوب، وسيظل معلّقاً حتى الاعتماد المالي.');
    }
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.paymentChannelConfig.findUnique({ where: { code: dto.code } });
      if (existing) throw new ConflictException('رمز قناة الدفع موجود مسبقاً؛ استخدم طلب تغيير الحساب بدلاً من إنشاء قناة مكررة.');
      const created = await tx.paymentChannelConfig.create({
        data: {
          code: dto.code,
          name: dto.name,
          nameAr: dto.nameAr,
          accountNumber: 'NOT_CONFIGURED',
          accountHolderName: dto.accountHolderName,
          instructionsAr: 'القناة غير مفعلة. تنتظر التحقق من حساب الاستقبال والموافقة المالية المستقلة.',
          pendingInstructionsAr: dto.instructionsAr,
          supportedCurrencies: dto.supportedCurrencies as unknown as Prisma.InputJsonValue,
          minAmount: new Prisma.Decimal(dto.minAmount),
          maxAmount: new Prisma.Decimal(dto.maxAmount),
          mode: PaymentChannelMode.MANUAL,
          verificationStatus: ChannelVerificationStatus.PENDING_REVIEW,
          financeApprovalRequired: true,
          pendingAccountNumber: dto.accountNumber.trim(),
          pendingProposedByUserId: actorUserId,
          pendingProposedAt: new Date(),
          pendingChangeReason: 'إنشاء قناة جديدة يتطلب تحققاً مالياً مستقلاً.',
          isActive: false,
        },
      });
      await this.recordChannelAudit(tx, actorUserId, 'PAYMENT_CHANNEL_CREATED_PENDING_REVIEW', created.id,
        {},
        { code: dto.code, accountNumber: this.maskChannelAccount(dto.accountNumber), status: 'PENDING_REVIEW', isActive: false });
      return { success: true, message: 'تم إنشاء إعداد القناة كمسودة معطلة. لا تظهر للعملاء حتى يراجعها مسؤول مالي مستقل.', channel: this.channelConfigView(created) };
    });
  }

  /**
   * Propose receiver details; immediately hide the channel until an independent finance review.
   */
  async proposeChannelAccountChange(
    channelCode: PaymentChannelCode,
    newAccountNumber: string,
    feePercentage: number | undefined,
    proposedByUserId: string,
    reason: string,
  ) {
    const account = (newAccountNumber || '').trim();
    if (account.length < 5 || account.length > 64 || account === 'NOT_CONFIGURED') {
      throw new BadRequestException('رقم حساب المستفيد غير صالح.');
    }
    if (feePercentage !== undefined && (!Number.isFinite(feePercentage) || feePercentage < 0 || feePercentage > 100)) {
      throw new BadRequestException('نسبة الرسوم يجب أن تكون بين 0 و100.');
    }
    if (!reason || reason.trim().length < 12) throw new BadRequestException('سبب طلب تغيير الحساب مطلوب.');
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.paymentChannelConfig.findUnique({ where: { code: channelCode } });
      if (!current) throw new NotFoundException('Payment channel configuration was not found.');
      if (current.pendingProposedByUserId) throw new ConflictException('يوجد تغيير آخر ينتظر المراجعة المالية لهذه القناة.');
      const updated = await tx.paymentChannelConfig.update({
        where: { id: current.id },
        data: {
          pendingAccountNumber: account,
          pendingFeePercentage: feePercentage === undefined ? null : new Prisma.Decimal(feePercentage),
          pendingProposedByUserId: proposedByUserId,
          pendingProposedAt: new Date(),
          pendingChangeReason: reason.trim(),
          financeApprovalRequired: true,
          verificationStatus: ChannelVerificationStatus.PENDING_REVIEW,
          isActive: false,
          mode: PaymentChannelMode.MANUAL,
        },
      });
      await this.recordChannelAudit(tx, proposedByUserId, 'PAYMENT_CHANNEL_CHANGE_PROPOSED', current.id,
        { accountNumber: this.maskChannelAccount(current.accountNumber), isActive: current.isActive, mode: current.mode },
        { pendingAccountNumber: this.maskChannelAccount(account), feePercentage: feePercentage ?? null, reason: reason.trim(), status: 'PENDING_REVIEW' });
      return { success: true, message: 'تم تعليق القناة وإرسال التغيير للمراجعة المالية المستقلة. لن تُعرض للعملاء أثناء المراجعة.', channel: this.channelConfigView(updated) };
    });
  }

  /**
   * Four-eyes approval is durable, rejects self-approval, and keeps real channels MANUAL.
   */
  async approveChannelFinanceReview(
    adminUserId: string,
    channelCode: PaymentChannelCode,
    dto: ApproveChannelChangeDto,
  ) {
    if (typeof dto.approved !== 'boolean') throw new BadRequestException('قرار الاعتماد المالي مطلوب.');
    if (!dto.financeNotes || dto.financeNotes.trim().length < 8) {
      throw new BadRequestException('ملاحظات أو سبب قرار المراجعة المالية مطلوب.');
    }
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.paymentChannelConfig.findUnique({ where: { code: channelCode } });
      if (!current) throw new NotFoundException('Payment channel configuration was not found.');
      if (!current.pendingProposedByUserId || !current.pendingAccountNumber || !current.financeApprovalRequired) {
        throw new ConflictException('لا يوجد تغيير حساب معلق للمراجعة.');
      }
      if (current.pendingProposedByUserId === adminUserId) {
        throw new ConflictException('لا يمكن لمقدم طلب تغيير الحساب اعتماد طلبه بنفسه.');
      }
      const approved = dto.approved;
      const updated = await tx.paymentChannelConfig.update({
        where: { id: current.id },
        data: approved ? {
          accountNumber: current.pendingAccountNumber,
          instructionsAr: current.pendingInstructionsAr || current.instructionsAr,
          feePercentage: current.pendingFeePercentage ?? current.feePercentage,
          verificationStatus: ChannelVerificationStatus.VERIFIED,
          verifiedByFinanceUserId: adminUserId,
          verifiedAt: new Date(),
          financeApprovalRequired: false,
          isActive: true,
          mode: PaymentChannelMode.MANUAL,
          pendingAccountNumber: null,
          pendingInstructionsAr: null,
          pendingFeePercentage: null,
          pendingProposedByUserId: null,
          pendingProposedAt: null,
          pendingChangeReason: null,
          killSwitchReason: null,
          killSwitchAt: null,
        } : {
          verificationStatus: ChannelVerificationStatus.REJECTED,
          verifiedByFinanceUserId: adminUserId,
          verifiedAt: new Date(),
          financeApprovalRequired: false,
          isActive: false,
          mode: PaymentChannelMode.DISABLED,
          pendingAccountNumber: null,
          pendingInstructionsAr: null,
          pendingFeePercentage: null,
          pendingProposedByUserId: null,
          pendingProposedAt: null,
          pendingChangeReason: null,
        },
      });
      await this.recordChannelAudit(tx, adminUserId, approved ? 'PAYMENT_CHANNEL_CHANGE_APPROVED' : 'PAYMENT_CHANNEL_CHANGE_REJECTED', current.id,
        { pendingAccountNumber: this.maskChannelAccount(current.pendingAccountNumber), requestedByUserId: current.pendingProposedByUserId, isActive: current.isActive },
        { accountNumber: approved ? this.maskChannelAccount(updated.accountNumber) : this.maskChannelAccount(current.accountNumber), isActive: updated.isActive, mode: updated.mode, financeNotes: dto.financeNotes?.trim() || null });
      return {
        success: true,
        message: approved
          ? 'تم اعتماد بيانات المستفيد من شخص مستقل وتفعيل القناة في وضع MANUAL فقط. لا يوجد تكامل API آلي.'
          : 'تم رفض التغيير وإبقاء القناة معطلة.',
        channel: this.channelConfigView(updated),
      };
    });
  }

  /**
   * Emergency kill switch immediately hides channel and disables further deposits.
   */
  async triggerChannelKillSwitch(adminUserId: string, channelCode: PaymentChannelCode, reason: string) {
    if (!reason || reason.trim().length < 12) throw new BadRequestException('سبب الإيقاف الطارئ مطلوب.');
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.paymentChannelConfig.findUnique({ where: { code: channelCode } });
      if (!current) throw new NotFoundException('Payment channel configuration was not found.');
      const updated = await tx.paymentChannelConfig.update({
        where: { id: current.id },
        data: { mode: PaymentChannelMode.DISABLED, isActive: false, killSwitchReason: reason.trim(), killSwitchAt: new Date() },
      });
      await this.recordChannelAudit(tx, adminUserId, 'PAYMENT_CHANNEL_KILL_SWITCH', current.id,
        { mode: current.mode, isActive: current.isActive },
        { mode: updated.mode, isActive: false, reason: reason.trim() });
      return { success: true, message: 'تم إيقاف القناة فوراً وحجبها عن العملاء.', channel: this.channelConfigView(updated) };
    });
  }
}
