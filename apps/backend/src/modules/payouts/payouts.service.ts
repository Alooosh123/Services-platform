import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { WalletService } from '../wallet/wallet.service';
import { PaymentAdapterRegistry } from '../deposits/adapters/yemen-payment.adapters';
import {
  CurrencyCode,
  PaymentChannelCode,
  PayoutStatus,
  PaymentChannelMode,
  CreatePayoutDto,
  ApprovePayoutDto,
} from '@digital-topup/shared';
import { Prisma } from '@prisma/client';

export interface InMemoryPayout {
  id: string;
  payoutNumber: string;
  userId: string;
  walletId?: string | null;
  currency: CurrencyCode;
  amount: number;
  feeAmount: number;
  channelCode: PaymentChannelCode;
  destinationAccount: string;
  beneficiaryName: string;
  idempotencyKey: string;
  status: PayoutStatus;
  approvedByUserId?: string | null;
  approvalNotes?: string | null;
  externalReference?: string | null;
  failureReason?: string | null;
  ledgerTxId?: string | null;
  executedByUserId?: string | null;
  executedAt?: Date | null;
  executionNotes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);
  private memoryPayouts: Map<string, InMemoryPayout> = new Map();

  constructor(
    private prisma: PrismaService,
    private ledgerService: LedgerService,
    private walletService: WalletService,
    private adapterRegistry: PaymentAdapterRegistry,
  ) {
    this.seedDefaultPayouts();
  }

  private seedDefaultPayouts() {
    if (process.env.NODE_ENV === 'production') return;
    const po1: InMemoryPayout = {
      id: 'po-seed-001',
      payoutNumber: 'PO-20261010-0001',
      userId: 'user-customer-003',
      walletId: 'w-cust-yer',
      currency: CurrencyCode.YER,
      amount: 10000.0,
      feeAmount: 0,
      channelCode: PaymentChannelCode.JAIB,
      destinationAccount: '770998877',
      beneficiaryName: 'أحمد محمد الحاشدي',
      idempotencyKey: 'IDEMP-PO-SEED-1',
      status: PayoutStatus.CONFIRMED,
      approvedByUserId: 'user-finance-002',
      approvalNotes: 'تحويل معتمد بموجب إشعار بنكي رقم JB-778899',
      externalReference: 'JB-778899',
      ledgerTxId: 'LTX-PO-SEED-001',
      createdAt: new Date(Date.now() - 3600000 * 24),
      updatedAt: new Date(Date.now() - 3600000 * 20),
    };

    this.memoryPayouts.set(po1.id, po1);
  }

  /**
   * Customer or Admin creates a Payout Request
   * Validates:
   * 1. Idempotency key (strictly prevents duplicate submissions)
   * 2. Available balance in customer wallet
   * 3. Channel daily and per-transaction limits
   * 4. Places hold on wallet balance in lockedBalance atomically
   */
  async createPayoutRequest(
    userId: string,
    dto: CreatePayoutDto,
  ): Promise<{ success: boolean; payout: InMemoryPayout }> {
    if (!dto.idempotencyKey || dto.idempotencyKey.trim().length === 0) {
      throw new BadRequestException('مفتاح عدم التكرار (idempotencyKey) إلزامي لمنع الازدواج المالي');
    }

    if (dto.amount <= 0) {
      throw new BadRequestException('مبلغ السحب يجب أن يكون أكبر من صفر');
    }

    // 1. Idempotency Check
    const existing = await this.findByIdempotencyKey(dto.idempotencyKey);
    if (existing) {
      this.logger.log(`[IdempotentPayout] Returning existing payout for key: ${dto.idempotencyKey}`);
      return { success: true, payout: existing };
    }

    // 2. Channel Verification & Limits
    const adapter = this.adapterRegistry.getAdapter(dto.channelCode);
    if (!adapter) {
      throw new BadRequestException(`قناة السحب ${dto.channelCode} غير مدعومة`);
    }

    let channelInfo = adapter.getInfo();
    if (process.env.NODE_ENV === 'production') {
      if (dto.channelCode === PaymentChannelCode.WALLET) {
        throw new BadRequestException('قناة Sandbox/Wallet غير مسموح بها في عمليات السحب الإنتاجية.');
      }
      let durableChannel: any;
      try {
        durableChannel = await this.prisma.paymentChannelConfig.findUnique({ where: { code: dto.channelCode } });
      } catch {
        throw new ServiceUnavailableException('تعذر التحقق من إعداد قناة السحب المعتمد في MySQL.');
      }
      const currencies = Array.isArray(durableChannel?.supportedCurrencies)
        ? durableChannel.supportedCurrencies
        : [];
      if (
        !durableChannel ||
        !durableChannel.isActive ||
        durableChannel.verificationStatus !== 'VERIFIED' ||
        durableChannel.financeApprovalRequired ||
        durableChannel.mode !== PaymentChannelMode.MANUAL ||
        !durableChannel.accountNumber ||
        durableChannel.accountNumber === 'NOT_CONFIGURED' ||
        durableChannel.killSwitchReason ||
        !currencies.includes(dto.currency)
      ) {
        throw new BadRequestException('قناة السحب غير معتمدة مالياً أو غير مهيأة للتحويل اليدوي بهذه العملة.');
      }
      // Production outflows are manual only; no built-in sandbox or unverified API adapter is trusted.
      channelInfo = {
        ...channelInfo,
        isActive: true,
        mode: PaymentChannelMode.MANUAL,
        minAmount: Number(durableChannel.minAmount),
        maxAmount: Number(durableChannel.maxAmount),
        accountNumber: durableChannel.accountNumber,
        capabilities: { depositConfirm: false, transactionLookup: false, payout: false, balance: false, reconcile: false },
      };
    }
    if (!channelInfo.isActive) {
      throw new BadRequestException(`قناة السحب ${dto.channelCode} غير مفعلة حالياً`);
    }

    if (channelInfo.minAmount && dto.amount < channelInfo.minAmount) {
      throw new BadRequestException(
        `الحد الأدنى للسحب عبر ${dto.channelCode} هو ${channelInfo.minAmount} ${dto.currency}`,
      );
    }

    if (channelInfo.maxAmount && dto.amount > channelInfo.maxAmount) {
      throw new BadRequestException(
        `الحد الأقصى للسحب للعملية الواحدة عبر ${dto.channelCode} هو ${channelInfo.maxAmount} ${dto.currency}`,
      );
    }

    // Anti-Fraud: SIM Swap / Phone Cooling-Off Period (24h)
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { phoneVerifiedAt: true, createdAt: true },
      });
      if (user?.phoneVerifiedAt) {
        const timeSinceVerification = Date.now() - new Date(user.phoneVerifiedAt).getTime();
        const accountAge = Date.now() - new Date(user.createdAt).getTime();
        if (timeSinceVerification < 24 * 3600 * 1000 && accountAge > 24 * 3600 * 1000) {
          throw new BadRequestException(
            'طلب السحب معلق مؤقتاً (فترة تبريد أمني لمدة 24 ساعة بعد تحديث أو تأكيد رقم الهاتف لحماية الأموال من هجمات SIM Swap)',
          );
        }
      }
    } catch (simErr: unknown) {
      if (simErr instanceof BadRequestException) throw simErr;
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException('تعذر التحقق من فترة الحماية الأمنية لتغيير رقم الهاتف من قاعدة البيانات.');
      }
    }

    // Anti-Fraud Velocity: Max 5 payout requests in 24 hours
    let recentPayoutsCount: number;
    if (process.env.NODE_ENV === 'production') {
      try {
        recentPayoutsCount = await this.prisma.payoutRequest.count({
          where: { userId, createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } },
        });
      } catch {
        throw new ServiceUnavailableException('تعذر التحقق من حد السحوبات اليومي من قاعدة البيانات الدائمة.');
      }
    } else {
      recentPayoutsCount = Array.from(this.memoryPayouts.values()).filter(
        (p) => p.userId === userId && Date.now() - new Date(p.createdAt).getTime() < 24 * 3600 * 1000,
      ).length;
    }
    if (recentPayoutsCount >= 5) {
      throw new BadRequestException(
        'تم تجاوز الحد الأقصى لعدد طلبات السحب اليومية (5 طلبات خلال 24 ساعة). يرجى الانتظار لحين اكتمال الطلبات السابقة.',
      );
    }

    // 3. Customer Wallet & Balance Check
    const wallet = await this.walletService.getWallet(userId, dto.currency);
    const available = Number(wallet.balance) - Number(wallet.lockedBalance || 0);

    if (available < dto.amount) {
      throw new BadRequestException(
        `الرصيد المتاح غير كافٍ لإتمام السحب. المتاح: ${available} ${dto.currency}، المطلوب: ${dto.amount} ${dto.currency}`,
      );
    }

    // In production, the wallet hold and the payout request are one serializable transaction.
    // A unique idempotency key is checked again under the transaction to close concurrent-submit races.
    if (process.env.NODE_ENV === 'production') {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const duplicate = await tx.payoutRequest.findUnique({
            where: { idempotencyKey: dto.idempotencyKey },
          });
          if (duplicate) {
            return {
              success: true,
              payout: {
                id: duplicate.id,
                payoutNumber: duplicate.payoutNumber,
                userId: duplicate.userId,
                walletId: duplicate.walletId,
                currency: duplicate.currency as CurrencyCode,
                amount: Number(duplicate.amount),
                feeAmount: Number(duplicate.feeAmount),
                channelCode: duplicate.channelCode as PaymentChannelCode,
                destinationAccount: duplicate.destinationAccount,
                beneficiaryName: duplicate.beneficiaryName,
                idempotencyKey: duplicate.idempotencyKey,
                status: duplicate.status as PayoutStatus,
                approvedByUserId: duplicate.approvedByUserId,
                approvalNotes: duplicate.approvalNotes,
                externalReference: duplicate.externalReference,
                failureReason: duplicate.failureReason,
                ledgerTxId: duplicate.ledgerTxId,
                executedByUserId: duplicate.executedByUserId,
                executedAt: duplicate.executedAt,
                executionNotes: duplicate.executionNotes,
                createdAt: duplicate.createdAt,
                updatedAt: duplicate.updatedAt,
              },
            };
          }

          await this.ledgerService.holdWalletBalance(wallet.id, dto.amount, tx);
          const now = new Date();
          const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
          const payoutNumber = `PO-${dateStr}-${Math.floor(1000 + Math.random() * 9000)}`;
          const created = await tx.payoutRequest.create({
            data: {
              payoutNumber,
              userId,
              walletId: wallet.id,
              currency: dto.currency,
              amount: new Prisma.Decimal(dto.amount),
              feeAmount: new Prisma.Decimal(0),
              channelCode: dto.channelCode,
              destinationAccount: dto.destinationAccount,
              beneficiaryName: dto.beneficiaryName,
              idempotencyKey: dto.idempotencyKey,
              status: PayoutStatus.REQUESTED,
            },
          });
          return {
            success: true,
            payout: {
              id: created.id,
              payoutNumber: created.payoutNumber,
              userId: created.userId,
              walletId: created.walletId,
              currency: created.currency as CurrencyCode,
              amount: Number(created.amount),
              feeAmount: Number(created.feeAmount),
              channelCode: created.channelCode as PaymentChannelCode,
              destinationAccount: created.destinationAccount,
              beneficiaryName: created.beneficiaryName,
              idempotencyKey: created.idempotencyKey,
              status: created.status as PayoutStatus,
              createdAt: created.createdAt,
              updatedAt: created.updatedAt,
            },
          };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        // If the client lost the response after the DB commit, query the unique key before
        // reporting failure. A retry must never create a second hold or payout.
        try {
          const committed = await this.findByIdempotencyKey(dto.idempotencyKey);
          if (committed) return { success: true, payout: committed };
        } catch {
          // Database still unavailable: fail closed and require finance reconciliation.
        }
        if (error instanceof BadRequestException) throw error;
        throw new ServiceUnavailableException(
          'تعذر تأكيد إنشاء طلب السحب وحجز الرصيد ذرياً في MySQL. افحص idempotencyKey قبل إعادة المحاولة.',
        );
      }
    }

    // Test/development compatibility path; production never uses the in-memory fallback below.
    try {
      await this.ledgerService.holdWalletBalance(wallet.id, dto.amount);
    } catch (holdErr: any) {
      throw new BadRequestException(`فشل حجز رصيد السحب: ${holdErr?.message}`);
    }

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const payoutNumber = `PO-${dateStr}-${randomSuffix}`;
    const newId = `po-${Date.now()}`;

    // 5. Store PayoutRequest in DB or in-memory fallback
    try {
      const dbPayout = await this.prisma.payoutRequest.create({
        data: {
          payoutNumber,
          userId,
          walletId: wallet.id,
          currency: dto.currency,
          amount: new Prisma.Decimal(dto.amount),
          feeAmount: new Prisma.Decimal(0),
          channelCode: dto.channelCode,
          destinationAccount: dto.destinationAccount,
          beneficiaryName: dto.beneficiaryName,
          idempotencyKey: dto.idempotencyKey,
          status: PayoutStatus.REQUESTED,
        },
      });

      return {
        success: true,
        payout: {
          id: dbPayout.id,
          payoutNumber: dbPayout.payoutNumber,
          userId: dbPayout.userId,
          walletId: dbPayout.walletId,
          currency: dbPayout.currency as CurrencyCode,
          amount: Number(dbPayout.amount),
          feeAmount: Number(dbPayout.feeAmount),
          channelCode: dbPayout.channelCode as PaymentChannelCode,
          destinationAccount: dbPayout.destinationAccount,
          beneficiaryName: dbPayout.beneficiaryName,
          idempotencyKey: dbPayout.idempotencyKey,
          status: dbPayout.status as PayoutStatus,
          createdAt: dbPayout.createdAt,
          updatedAt: dbPayout.updatedAt,
        },
      };
    } catch (err: any) {
      if (process.env.NODE_ENV === 'production') {
        // The wallet hold has already been posted. A failed/ambiguous insert must not
        // become an in-memory success or release funds blindly; finance reconciles the idempotency key.
        throw new ServiceUnavailableException(
          'تعذر تأكيد حفظ طلب السحب في MySQL بعد حجز المبلغ. بقي الحجز قائماً لمنع الصرف المزدوج، ويلزم فحص مفتاح idempotency قبل أي إعادة محاولة.',
        );
      }
      this.logger.warn(`Prisma offline during createPayoutRequest (${err?.message})`);
    }

    const memPayout: InMemoryPayout = {
      id: newId,
      payoutNumber,
      userId,
      walletId: wallet.id,
      currency: dto.currency,
      amount: dto.amount,
      feeAmount: 0,
      channelCode: dto.channelCode,
      destinationAccount: dto.destinationAccount,
      beneficiaryName: dto.beneficiaryName,
      idempotencyKey: dto.idempotencyKey,
      status: PayoutStatus.REQUESTED,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.memoryPayouts.set(newId, memPayout);

    return { success: true, payout: memPayout };
  }

  /**
   * Finance Manager / Owner: Approve Payout Request
   */
  async approvePayout(
    staffUserId: string,
    payoutId: string,
    dto?: ApprovePayoutDto,
  ): Promise<{ success: boolean; payout: InMemoryPayout }> {
    const payout = await this.getPayoutById(payoutId);

    if (payout.status !== PayoutStatus.REQUESTED) {
      throw new BadRequestException(`لا يمكن اعتماد طلب السحب بحالته الحالية: ${payout.status}`);
    }

    // Four-Eyes Principle (Separation of Duties)
    if (payout.userId === staffUserId) {
      throw new ForbiddenException('تطبيق مبدأ الرقابة الثنائية: لا يمكن لمقدم طلب السحب اعتماده بنفسه');
    }

    const notes = dto?.reviewNotes || 'تمت الموافقة المالية على طلب السحب';

    try {
      await this.prisma.payoutRequest.update({
        where: { id: payoutId },
        data: {
          status: PayoutStatus.APPROVED,
          approvedByUserId: staffUserId,
          approvalNotes: notes,
        },
      });
    } catch {
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException('تعذر حفظ اعتماد طلب السحب في قاعدة البيانات الدائمة.');
      }
      // isolated test/development fallback
    }

    payout.status = PayoutStatus.APPROVED;
    payout.approvedByUserId = staffUserId;
    payout.approvalNotes = notes;
    payout.updatedAt = new Date();

    return { success: true, payout };
  }

  /**
   * P05 / AT-18 Outbound Execution:
   * Executes payout transfer through adapter or marks BLOCKED_EXTERNAL for manual SOP.
   * Strictly guarantees:
   * - No double debit on failure (hold released).
   * - On timeout/unknown: moves to UNKNOWN, leaves funds reserved, suspends automated retries, flags for reconciliation!
   */
  async dispatchPayout(
    staffUserId: string,
    payoutId: string,
  ): Promise<{ success: boolean; status: PayoutStatus; message: string; payout: InMemoryPayout }> {
    const payout = await this.getPayoutById(payoutId);

    if (payout.status !== PayoutStatus.APPROVED) {
      throw new BadRequestException(`طلب السحب ليس معتمداً وجاهزاً للإرسال (${payout.status})`);
    }
    if (payout.approvedByUserId === staffUserId) {
      throw new ForbiddenException('يجب أن ينفذ/يراجع السحب موظف مستقل عن الموظف الذي اعتمده.');
    }
    if (process.env.NODE_ENV === 'production') {
      return {
        success: false,
        status: PayoutStatus.APPROVED,
        message: 'لا يوجد مزود سحب آلي حقيقي معتمد. يجب تنفيذ التحويل يدوياً من الحساب المعتمد وإرفاق مرجع البنك عبر مسار Manual SOP.',
        payout,
      };
    }

    const adapter = this.adapterRegistry.getAdapter(payout.channelCode);
    if (!adapter) {
      throw new BadRequestException(`قناة التحويل ${payout.channelCode} غير متوفرة`);
    }

    const channelInfo = adapter.getInfo();

    // 1. Check BLOCKED_EXTERNAL / MANUAL Mode
    // Real Yemeni banks require official SOP manual transfer unless custom enterprise API is online
    if (
      channelInfo.mode === PaymentChannelMode.BLOCKED_EXTERNAL ||
      channelInfo.mode === PaymentChannelMode.MANUAL ||
      !channelInfo.capabilities?.payout
    ) {
      this.logger.warn(
        `[BlockedExternalPayout] Auto-payout blocked for ${payout.channelCode}. Manual SOP execution required.`,
      );
      return {
        success: false,
        status: PayoutStatus.APPROVED,
        message: `التحويل الآلي المباشر عبر ${payout.channelCode} محجوب خارجياً (BLOCKED_EXTERNAL). يجب على ضابط المالية تنفيذ التحويل يدوياً وإدخال رقم الإشعار البنكي لتأكيد التسوية.`,
        payout,
      };
    }

    // 2. Channel has Automated Payout Capability (e.g. Sandbox API)
    payout.status = PayoutStatus.PROCESSING;

    let result;
    try {
      result = await adapter.payout({
        payoutId: payout.id,
        payoutNumber: payout.payoutNumber,
        channelCode: payout.channelCode,
        destinationAccount: payout.destinationAccount,
        beneficiaryName: payout.beneficiaryName,
        amount: payout.amount,
        currency: payout.currency,
        idempotencyKey: payout.idempotencyKey,
      });
    } catch (err: any) {
      this.logger.error(`Adapter payout threw error: ${err?.message}`);
      result = {
        success: false,
        status: 'UNKNOWN' as any,
        message: `انقطاع في الاتصال مع بوابة الدفع أثناء السحب: ${err?.message}`,
      };
    }

    // 3. Handle Payout Result
    if (result.status === 'CONFIRMED') {
      // External success without a posted ledger entry is UNKNOWN, never falsely CONFIRMED.
      let ledgerTxId: string | undefined;
      let settlementError: unknown;
      try {
        const ledgerRes = await this.ledgerService.recordPayoutSettlement({
          payoutId: payout.id,
          payoutNumber: payout.payoutNumber,
          userId: payout.userId,
          walletId: payout.walletId || undefined,
          currency: payout.currency,
          amount: payout.amount,
          channelCode: payout.channelCode,
          destinationAccount: payout.destinationAccount,
          performedByUserId: staffUserId,
          notes: `تحويل مؤكد عبر ${payout.channelCode} (Ref: ${result.externalReference})`,
        });
        ledgerTxId = (ledgerRes as any)?.transaction?.id;
        if (!ledgerTxId) throw new Error('Ledger settlement did not return a posted transaction ID.');
      } catch (lErr: unknown) {
        settlementError = lErr;
        this.logger.error('Ledger payout settlement failed after external success; funds remain reserved for reconciliation.');
      }

      payout.externalReference = result.externalReference || null;
      payout.updatedAt = new Date();
      if (!ledgerTxId) {
        payout.status = PayoutStatus.UNKNOWN;
        payout.failureReason = 'نجح/أُكد التحويل خارجياً لكن تعذر إثبات قيد الأستاذ. الحجز المالي باقٍ للمطابقة اليدوية. ' +
          (settlementError instanceof Error ? settlementError.message : '');
        await this.syncPayoutToDb(payout);
        return {
          success: false,
          status: PayoutStatus.UNKNOWN,
          message: 'وصل تأكيد التحويل الخارجي لكن لم يُسجل قيد الأستاذ. لم يتم إعلان السحب مكتملاً، والمبلغ محفوظ للمطابقة دون إعادة إرسال تلقائي.',
          payout,
        };
      }

      payout.status = PayoutStatus.CONFIRMED;
      payout.ledgerTxId = ledgerTxId;
      payout.executedByUserId = staffUserId;
      payout.executedAt = new Date();
      payout.executionNotes = 'اكتمل التحويل مع قيد الأستاذ ' + ledgerTxId;
      await this.syncPayoutToDb(payout);

      return {
        success: true,
        status: PayoutStatus.CONFIRMED,
        message: 'تم تنفيذ السحب المالي وتسويته محاسبياً بنجاح.',
        payout,
      };
    } else if (result.status === 'FAILED') {
      // CONFIRMED FAILURE: Release hold immediately (NO double debit!)
      if (payout.walletId) {
        try {
          await this.ledgerService.releaseWalletHold(payout.walletId, payout.amount);
        } catch (rErr: any) {
          this.logger.error(`Failed to release wallet hold on payout failure: ${rErr?.message}`);
        }
      }

      payout.status = PayoutStatus.FAILED;
      payout.failureReason = result.message || 'فشل التحويل من طرف مزود القناة';
      payout.updatedAt = new Date();

      await this.syncPayoutToDb(payout);

      return {
        success: false,
        status: PayoutStatus.FAILED,
        message: payout.failureReason,
        payout,
      };
    } else {
      // UNKNOWN / TIMEOUT (AT-18):
      // Crucial: Funds remain reserved in lockedBalance. Do NOT release blind refund, do NOT auto-retry!
      // Routed to dispute and reconciliation queue.
      payout.status = PayoutStatus.UNKNOWN;
      payout.failureReason = result.message || 'استجابة مزود القناة غير مؤكدة (Timeout/Unknown)';
      payout.updatedAt = new Date();

      await this.syncPayoutToDb(payout);

      this.logger.warn(
        `[UnknownPayoutTriggered] Payout ${payout.payoutNumber} marked as UNKNOWN. Retries suspended. Sent to reconciliation.`,
      );

      return {
        success: false,
        status: PayoutStatus.UNKNOWN,
        message: 'حالة التحويل غير مؤكدة لدى المزود. تم إيقاف إعادة المحاولات وحجز المبلغ لمطابقة كشف الحساب اليومي (AT-18).',
        payout,
      };
    }
  }

  /**
   * P05 Manual Confirmation:
   * Finance officer marks manual wire transfer as confirmed, attaching official bank slip reference.
   */
  async confirmManualPayout(
    staffUserId: string,
    payoutId: string,
    externalRef: string,
    notes?: string,
  ): Promise<{ success: boolean; payout: InMemoryPayout }> {
    const payout = await this.getPayoutById(payoutId);

    if (payout.status !== PayoutStatus.APPROVED) {
      throw new BadRequestException('يجب اعتماد طلب السحب مالياً قبل تسجيل التحويل اليدوي.');
    }
    if (!payout.approvedByUserId || payout.approvedByUserId === staffUserId) {
      throw new ForbiddenException('يجب أن يكون منفذ التحويل اليدوي مختلفاً عن الموظف الذي اعتمد طلب السحب.');
    }

    if (!externalRef || externalRef.trim().length === 0) {
      throw new BadRequestException('رقم المرجع البنكي الخارجي إلزامي للتأكيد اليدوي');
    }

    if (process.env.NODE_ENV === 'production') {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const current = await tx.payoutRequest.findUnique({ where: { id: payoutId } });
          if (!current) throw new NotFoundException('طلب السحب غير موجود في قاعدة البيانات الدائمة.');
          if (current.status !== PayoutStatus.APPROVED) {
            throw new ConflictException('تغيرت حالة طلب السحب؛ أعد تحميل الطلب قبل إثبات التحويل.');
          }
          if (!current.approvedByUserId || current.approvedByUserId === staffUserId) {
            throw new ForbiddenException('يجب أن يكون منفذ التحويل اليدوي مختلفاً عن الموظف الذي اعتمد طلب السحب.');
          }

          const ledgerResult = await this.ledgerService.recordPayoutSettlement({
            payoutId: current.id,
            payoutNumber: current.payoutNumber,
            userId: current.userId,
            walletId: current.walletId || undefined,
            currency: current.currency as CurrencyCode,
            amount: Number(current.amount),
            channelCode: current.channelCode as PaymentChannelCode,
            destinationAccount: current.destinationAccount,
            performedByUserId: staffUserId,
            notes: notes || `تحويل يدوي معتمد بموجب سند خارجي ${externalRef.trim()}`,
          }, tx);
          const ledgerTxId = (ledgerResult as any)?.transaction?.id;
          const ledgerStatus = (ledgerResult as any)?.transaction?.status;
          if (!ledgerTxId || ledgerStatus !== 'POSTED') {
            throw new ConflictException('لم يرجع دفتر الأستاذ قيداً مرحّلاً مؤكداً للسحب.');
          }

          const changed = await tx.payoutRequest.updateMany({
            where: {
              id: payoutId,
              status: PayoutStatus.APPROVED,
              approvedByUserId: { not: staffUserId },
            },
            data: {
              status: PayoutStatus.CONFIRMED,
              externalReference: externalRef.trim(),
              ledgerTxId,
              executedByUserId: staffUserId,
              executedAt: new Date(),
              executionNotes: notes || 'تم التحقق من سند التحويل اليدوي وترحيل القيد المزدوج.',
            },
          });
          if (changed.count !== 1) {
            throw new ConflictException('تغير طلب السحب أثناء التسوية؛ تم التراجع عن قيد الأستاذ وتحرير الحجز.');
          }

          const updated = await tx.payoutRequest.findUnique({ where: { id: payoutId } });
          if (!updated) throw new ServiceUnavailableException('تعذر استرجاع طلب السحب بعد ترحيل التسوية.');
          return {
            success: true,
            payout: {
              id: updated.id,
              payoutNumber: updated.payoutNumber,
              userId: updated.userId,
              walletId: updated.walletId,
              currency: updated.currency as CurrencyCode,
              amount: Number(updated.amount),
              feeAmount: Number(updated.feeAmount),
              channelCode: updated.channelCode as PaymentChannelCode,
              destinationAccount: updated.destinationAccount,
              beneficiaryName: updated.beneficiaryName,
              idempotencyKey: updated.idempotencyKey,
              status: updated.status as PayoutStatus,
              approvedByUserId: updated.approvedByUserId,
              approvalNotes: updated.approvalNotes,
              externalReference: updated.externalReference,
              failureReason: updated.failureReason,
              ledgerTxId: updated.ledgerTxId,
              executedByUserId: updated.executedByUserId,
              executedAt: updated.executedAt,
              executionNotes: updated.executionNotes,
              createdAt: updated.createdAt,
              updatedAt: updated.updatedAt,
            },
          };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (
          error instanceof BadRequestException ||
          error instanceof ConflictException ||
          error instanceof ForbiddenException ||
          error instanceof NotFoundException
        ) throw error;

        // An external bank transfer may already have happened. The ledger + payout
        // status are atomic; after a failed transaction, retain the hold and mark UNKNOWN.
        const current = await this.getPayoutById(payoutId).catch(() => null);
        if (current?.status === PayoutStatus.CONFIRMED && current.ledgerTxId) {
          return { success: true, payout: current };
        }
        const uncertain = current || payout;
        uncertain.status = PayoutStatus.UNKNOWN;
        uncertain.externalReference = externalRef.trim();
        uncertain.executedByUserId = staffUserId;
        uncertain.executedAt = new Date();
        uncertain.executionNotes = notes || 'تم استلام مرجع التحويل اليدوي؛ يلزم التحقق من نتيجة معاملة القاعدة والدفتر.';
        uncertain.failureReason = 'تعذر تأكيد معاملة تسوية السحب؛ تم تعليق الطلب للمطابقة دون محاولة تحويل جديدة.';
        uncertain.updatedAt = new Date();
        await this.syncPayoutToDb(uncertain);
        return { success: false, payout: uncertain };
      }
    }

    // Test/development compatibility path.
    // The manual transfer may already have happened externally. If ledger posting fails,
    // record UNKNOWN and retain the hold; never write a synthetic transaction ID.
    let ledgerTxId: string | undefined;
    let settlementError: unknown;
    try {
      const ledgerRes = await this.ledgerService.recordPayoutSettlement({
        payoutId: payout.id,
        payoutNumber: payout.payoutNumber,
        userId: payout.userId,
        walletId: payout.walletId || undefined,
        currency: payout.currency,
        amount: payout.amount,
        channelCode: payout.channelCode,
        destinationAccount: payout.destinationAccount,
        performedByUserId: staffUserId,
        notes: notes || `تحويل يدوي معتمد بموجب سند خارجي ${externalRef}`,
      });
      ledgerTxId = (ledgerRes as any)?.transaction?.id;
      if (!ledgerTxId) throw new Error('Ledger settlement did not return a posted transaction ID.');
    } catch (lErr: unknown) {
      settlementError = lErr;
      this.logger.error('Ledger manual payout settlement failed; request remains UNKNOWN for reconciliation.');
    }

    payout.externalReference = externalRef.trim();
    payout.executedByUserId = staffUserId;
    payout.executedAt = new Date();
    payout.executionNotes = notes || 'تم استلام مرجع التحويل اليدوي؛ ينتظر إثبات قيد الأستاذ.';
    payout.updatedAt = new Date();
    if (!ledgerTxId) {
      payout.status = PayoutStatus.UNKNOWN;
      payout.failureReason = 'تم تسجيل دليل التحويل اليدوي لكن تعذر إثبات قيد الأستاذ؛ الحجز باقٍ للمطابقة. ' +
        (settlementError instanceof Error ? settlementError.message : '');
      await this.syncPayoutToDb(payout);
      return { success: false, payout };
    }

    payout.status = PayoutStatus.CONFIRMED;
    payout.ledgerTxId = ledgerTxId;
    payout.executionNotes = notes || 'تم التحويل اليدوي ومطابقة الإشعار البنكي';
    payout.updatedAt = new Date();

    await this.syncPayoutToDb(payout);
    return { success: true, payout };
  }

  /**
   * Reject Payout Request & release hold
   */
  async rejectPayout(
    staffUserId: string,
    payoutId: string,
    reason: string,
  ): Promise<{ success: boolean; payout: InMemoryPayout }> {
    const payout = await this.getPayoutById(payoutId);

    if (![PayoutStatus.REQUESTED, PayoutStatus.APPROVED].includes(payout.status)) {
      throw new ConflictException('لا يمكن رفض طلب سحب بدأ تنفيذه أو أصبحت نتيجته غير مؤكدة. يجب إحالته إلى المطابقة المالية أولاً.');
    }
    if (!reason || reason.trim().length < 8) {
      throw new BadRequestException('سبب رفض طلب السحب مطلوب ويجب ألا يقل عن 8 أحرف.');
    }

    if (payout.walletId) {
      await this.ledgerService.releaseWalletHold(payout.walletId, payout.amount);
    }

    payout.status = PayoutStatus.CANCELLED;
    payout.failureReason = reason;
    payout.approvedByUserId = staffUserId;
    payout.updatedAt = new Date();

    await this.syncPayoutToDb(payout);

    return { success: true, payout };
  }

  async getPayoutById(payoutId: string): Promise<InMemoryPayout> {
    try {
      const db = await this.prisma.payoutRequest.findUnique({
        where: { id: payoutId },
      });
      if (db) {
        return {
          id: db.id,
          payoutNumber: db.payoutNumber,
          userId: db.userId,
          walletId: db.walletId,
          currency: db.currency as CurrencyCode,
          amount: Number(db.amount),
          feeAmount: Number(db.feeAmount),
          channelCode: db.channelCode as PaymentChannelCode,
          destinationAccount: db.destinationAccount,
          beneficiaryName: db.beneficiaryName,
          idempotencyKey: db.idempotencyKey,
          status: db.status as PayoutStatus,
          approvedByUserId: db.approvedByUserId,
          approvalNotes: db.approvalNotes,
          externalReference: db.externalReference,
          failureReason: db.failureReason,
          ledgerTxId: db.ledgerTxId,
          executedByUserId: db.executedByUserId,
          executedAt: db.executedAt,
          executionNotes: db.executionNotes,
          createdAt: db.createdAt,
          updatedAt: db.updatedAt,
        };
      }
    } catch {
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException('تعذر قراءة طلب السحب من قاعدة البيانات الدائمة.');
      }
      // test/development fallback
    }

    if (process.env.NODE_ENV === 'production') throw new NotFoundException(`طلب السحب ${payoutId} غير موجود`);
    const mem = this.memoryPayouts.get(payoutId);
    if (!mem) {
      throw new NotFoundException(`طلب السحب ${payoutId} غير موجود`);
    }
    return mem;
  }

  async findByIdempotencyKey(key: string): Promise<InMemoryPayout | null> {
    try {
      const db = await this.prisma.payoutRequest.findUnique({
        where: { idempotencyKey: key },
      });
      if (db) {
        return {
          id: db.id,
          payoutNumber: db.payoutNumber,
          userId: db.userId,
          walletId: db.walletId,
          currency: db.currency as CurrencyCode,
          amount: Number(db.amount),
          feeAmount: Number(db.feeAmount),
          channelCode: db.channelCode as PaymentChannelCode,
          destinationAccount: db.destinationAccount,
          beneficiaryName: db.beneficiaryName,
          idempotencyKey: db.idempotencyKey,
          status: db.status as PayoutStatus,
          executedByUserId: db.executedByUserId,
          executedAt: db.executedAt,
          executionNotes: db.executionNotes,
          createdAt: db.createdAt,
          updatedAt: db.updatedAt,
        };
      }
    } catch {
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException('تعذر التحقق من idempotency لطلب السحب في قاعدة البيانات.');
      }
      // test/development fallback
    }

    if (process.env.NODE_ENV === 'production') return null;
    for (const p of this.memoryPayouts.values()) {
      if (p.idempotencyKey === key) return p;
    }
    return null;
  }

  async listPayouts(filters?: { status?: PayoutStatus; userId?: string }): Promise<InMemoryPayout[]> {
    try {
      const where: any = {};
      if (filters?.status) where.status = filters.status;
      if (filters?.userId) where.userId = filters.userId;

      const db = await this.prisma.payoutRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });

      if (process.env.NODE_ENV === 'production' || (db && db.length > 0)) {
        return db.map((p) => ({
          id: p.id,
          payoutNumber: p.payoutNumber,
          userId: p.userId,
          walletId: p.walletId,
          currency: p.currency as CurrencyCode,
          amount: Number(p.amount),
          feeAmount: Number(p.feeAmount),
          channelCode: p.channelCode as PaymentChannelCode,
          destinationAccount: p.destinationAccount,
          beneficiaryName: p.beneficiaryName,
          idempotencyKey: p.idempotencyKey,
          status: p.status as PayoutStatus,
          approvedByUserId: p.approvedByUserId,
          approvalNotes: p.approvalNotes,
          externalReference: p.externalReference,
          failureReason: p.failureReason,
          ledgerTxId: p.ledgerTxId,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        }));
      }
    } catch {
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException('تعذر قراءة طلبات السحب من قاعدة البيانات الدائمة.');
      }
      // test/development fallback
    }

    if (process.env.NODE_ENV === 'production') return [];
    let results = Array.from(this.memoryPayouts.values());
    if (filters?.status) results = results.filter((p) => p.status === filters.status);
    if (filters?.userId) results = results.filter((p) => p.userId === filters.userId);
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  private async syncPayoutToDb(payout: InMemoryPayout) {
    try {
      await this.prisma.payoutRequest.update({
        where: { id: payout.id },
        data: {
          status: payout.status,
          approvedByUserId: payout.approvedByUserId,
          approvalNotes: payout.approvalNotes,
          externalReference: payout.externalReference,
          failureReason: payout.failureReason,
          ledgerTxId: payout.ledgerTxId,
          executedByUserId: payout.executedByUserId || null,
          executedAt: payout.executedAt || null,
          executionNotes: payout.executionNotes || null,
        },
      });
    } catch {
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException('تعذر حفظ تحديث السحب في قاعدة البيانات الدائمة.');
      }
      // test/development memory fallback
    }
  }
}
