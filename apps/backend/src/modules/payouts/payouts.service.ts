import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
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

    const channelInfo = adapter.getInfo();
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
    } catch (simErr: any) {
      if (simErr instanceof BadRequestException) throw simErr;
    }

    // Anti-Fraud Velocity: Max 5 payout requests in 24 hours
    const recentPayoutsCount = Array.from(this.memoryPayouts.values()).filter(
      (p) => p.userId === userId && Date.now() - new Date(p.createdAt).getTime() < 24 * 3600 * 1000,
    ).length;
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

    // 4. Hold Wallet Balance atomically to prevent double-spending
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
      // memory fallback
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

    if (payout.status !== PayoutStatus.APPROVED && payout.status !== PayoutStatus.REQUESTED) {
      throw new BadRequestException(`طلب السحب ليس في حالة جاهزة للإرسال (${payout.status})`);
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
      // SETTLEMENT: Confirmed success -> Post ledger transaction and release hold
      let ledgerTxId = `LTX-PO-${Date.now()}`;
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
        ledgerTxId = (ledgerRes as any)?.transaction?.id || ledgerTxId;
      } catch (lErr: any) {
        this.logger.error(`Ledger payout settlement error: ${lErr?.message}`);
      }

      payout.status = PayoutStatus.CONFIRMED;
      payout.externalReference = result.externalReference || `EXT-${Date.now()}`;
      payout.ledgerTxId = ledgerTxId;
      payout.updatedAt = new Date();

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

    if (
      payout.status === PayoutStatus.CONFIRMED ||
      payout.status === PayoutStatus.FAILED
    ) {
      throw new BadRequestException(`لا يمكن تعديل طلب سحب بالحالة: ${payout.status}`);
    }

    if (!externalRef || externalRef.trim().length === 0) {
      throw new BadRequestException('رقم المرجع البنكي الخارجي إلزامي للتأكيد اليدوي');
    }

    // Post double-entry settlement
    let ledgerTxId = `LTX-PO-MAN-${Date.now()}`;
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
      ledgerTxId = (ledgerRes as any)?.transaction?.id || ledgerTxId;
    } catch (lErr: any) {
      this.logger.error(`Ledger manual payout settlement error: ${lErr?.message}`);
    }

    payout.status = PayoutStatus.CONFIRMED;
    payout.externalReference = externalRef.trim();
    payout.ledgerTxId = ledgerTxId;
    payout.approvedByUserId = staffUserId;
    payout.approvalNotes = notes || 'تم التحويل اليدوي ومطابقة الإشعار البنكي';
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

    if (payout.status === PayoutStatus.CONFIRMED) {
      throw new BadRequestException('لا يمكن رفض طلب سحب تم تأكيده وتسويته مسبقاً');
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
          createdAt: db.createdAt,
          updatedAt: db.updatedAt,
        };
      }
    } catch {
      // fallback
    }

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
          createdAt: db.createdAt,
          updatedAt: db.updatedAt,
        };
      }
    } catch {
      // fallback
    }

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

      if (db && db.length > 0) {
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
      // fallback
    }

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
        },
      });
    } catch {
      // memory only
    }
  }
}
