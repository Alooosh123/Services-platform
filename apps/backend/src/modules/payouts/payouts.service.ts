import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { getCurrentTenantId } from '../../tenant/tenant-context.store';
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

  constructor(
    private prisma: PrismaService,
    private ledgerService: LedgerService,
    private walletService: WalletService,
    private adapterRegistry: PaymentAdapterRegistry,
  ) {}

  private get isRegulatedRuntime(): boolean {
    return process.env.NODE_ENV === 'production' || !!getCurrentTenantId();
  }

  private assertCustomerPayoutsEnabled(): void {
    if (this.isRegulatedRuntime && process.env.ENABLE_CUSTOMER_WALLET_OPERATIONS !== 'true') {
      throw new ForbiddenException('طلبات سحب العملاء معطلة حتى اعتماد قنوات الدفع والتحويل التجاري صراحةً.');
    }
  }

  private async assertManualPayoutAgentEvidence(
    tx: Prisma.TransactionClient,
    payout: any,
    reviewerUserId: string,
  ) {
    const config = await tx.paymentChannelConfig.findFirst({
      where: {
        tenantId: getCurrentTenantId() || null,
        code: payout.channelCode,
        isActive: true,
        mode: PaymentChannelMode.MANUAL,
        verificationStatus: 'VERIFIED',
      },
    });
    if (!this.isRegulatedRuntime || config?.mode !== PaymentChannelMode.MANUAL) return null;
    if (
      !config.accountNumber ||
      config.accountNumber === 'NOT_CONFIGURED' ||
      !config.regulatoryApprovalReference ||
      !config.regulatoryApprovalDocumentUrl ||
      !config.providerAgreementReference ||
      !config.providerAgreementDocumentUrl
    ) {
      throw new ServiceUnavailableException('قناة السحب اليدوي تفتقر إلى إثبات الاعتماد أو اتفاقية التاجر.');
    }
    const operation = await tx.walletAgentOperation.findUnique({
      where: { payoutRequestId: payout.id },
    });
    if (
      !operation ||
      operation.status !== 'AGENT_SUBMITTED' ||
      !operation.agentUserId ||
      operation.agentUserId === reviewerUserId ||
      !operation.observedAmount ||
      !operation.observedAmount.equals(payout.amount) ||
      operation.observedCurrency !== payout.currency ||
      operation.observedAccountLastFour !== String(payout.destinationAccount).slice(-4) ||
      !operation.observedReferenceNumber ||
      !operation.evidenceReference
    ) {
      throw new BadRequestException('يلزم تحقق وكيل مستقل من عملية التحويل الفعلية ومطابقة المبلغ والعملة والمستفيد والمرجع قبل تأكيد السحب.');
    }
    return operation;
  }

  private mapPayout(row: any): InMemoryPayout {
    return {
      id: row.id,
      payoutNumber: row.payoutNumber,
      userId: row.userId,
      walletId: row.walletId,
      currency: row.currency as CurrencyCode,
      amount: Number(row.amount),
      feeAmount: Number(row.feeAmount),
      channelCode: row.channelCode as PaymentChannelCode,
      destinationAccount: row.destinationAccount,
      beneficiaryName: row.beneficiaryName,
      idempotencyKey: row.idempotencyKey,
      status: row.status as PayoutStatus,
      approvedByUserId: row.approvedByUserId,
      approvalNotes: row.approvalNotes,
      externalReference: row.externalReference,
      failureReason: row.failureReason,
      ledgerTxId: row.ledgerTxId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async createPayoutRequest(userId: string, dto: CreatePayoutDto): Promise<{ success: boolean; payout: InMemoryPayout }> {
    this.assertCustomerPayoutsEnabled();
    if (!dto.idempotencyKey?.trim()) throw new BadRequestException('مفتاح عدم التكرار إلزامي لمنع الازدواج المالي.');
    if (!Number.isFinite(dto.amount) || dto.amount <= 0) throw new BadRequestException('مبلغ السحب يجب أن يكون موجباً وصالحاً.');
    if (!dto.destinationAccount?.trim() || !dto.beneficiaryName?.trim()) {
      throw new BadRequestException('حساب المستفيد واسمه مطلوبان.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, phoneVerifiedAt: true, createdAt: true } });
    if (!user) throw new NotFoundException('حساب العميل غير موجود.');
    if (user.phoneVerifiedAt && Date.now() - user.phoneVerifiedAt.getTime() < 24 * 3600 * 1000 &&
        Date.now() - user.createdAt.getTime() > 24 * 3600 * 1000) {
      throw new BadRequestException('تم تطبيق فترة تبريد أمني لمدة 24 ساعة بعد تغيير/تأكيد الهاتف.');
    }

    const existing = await this.prisma.payoutRequest.findUnique({ where: { idempotencyKey: dto.idempotencyKey } });
    if (existing) {
      if (existing.userId !== userId) {
        throw new ConflictException('مفتاح عدم التكرار مستخدم في طلب يعود إلى عميل آخر.');
      }
      return { success: true, payout: this.mapPayout(existing) };
    }

    const adapter = this.adapterRegistry.getAdapter(dto.channelCode);
    if (!adapter) throw new BadRequestException(`قناة السحب ${dto.channelCode} غير مدعومة.`);
    const channel = adapter.getInfo();

    const recentCount = await this.prisma.payoutRequest.count({
      where: { userId, createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } },
    });
    if (recentCount >= 5) throw new BadRequestException('تم تجاوز الحد الأقصى لطلبات السحب اليومية (5 طلبات خلال 24 ساعة).');

    const wallet = await this.walletService.getWallet(userId, dto.currency);
    const payoutNumber = `PO-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${cryptoRandomSuffix()}`;
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const duplicate = await tx.payoutRequest.findUnique({ where: { idempotencyKey: dto.idempotencyKey } });
        if (duplicate) {
          if (duplicate.userId !== userId) throw new ConflictException('مفتاح عدم التكرار يعود إلى عميل آخر.');
          return duplicate;
        }

        const strict = this.isRegulatedRuntime;
        const config = strict ? await tx.paymentChannelConfig.findFirst({
          where: {
            tenantId: getCurrentTenantId() || null,
            code: dto.channelCode,
            isActive: true,
            verificationStatus: 'VERIFIED',
          },
        }) : null;
        if (strict) {
          if (!config || !config.accountNumber || config.accountNumber === 'NOT_CONFIGURED' ||
              !config.regulatoryApprovalReference || !config.regulatoryApprovalDocumentUrl ||
              !config.providerAgreementReference || !config.providerAgreementDocumentUrl) {
            throw new ServiceUnavailableException('قناة السحب غير مفعلة بوثائق اعتماد تنظيمي واتفاقية تاجر موثقتين.');
          }
          if (config.mode !== PaymentChannelMode.MANUAL && config.mode !== PaymentChannelMode.API) {
            throw new ServiceUnavailableException('وضع قناة السحب غير معتمد للتشغيل الفعلي.');
          }
          if (config.mode === PaymentChannelMode.API && !channel.capabilities?.payout) {
            throw new ServiceUnavailableException('لا يوجد محول API موثق ومختبر لهذه القناة؛ لم يتم حجز الرصيد.');
          }
        } else if (!channel.isActive || [PaymentChannelMode.DISABLED, PaymentChannelMode.BLOCKED_EXTERNAL].includes(channel.mode)) {
          throw new ServiceUnavailableException(`قناة السحب ${dto.channelCode} غير مفعلة.`);
        }

        const minAmount = config ? Number(config.minAmount) : channel.minAmount;
        const maxAmount = config ? Number(config.maxAmount) : channel.maxAmount;
        if (minAmount && dto.amount < minAmount) throw new BadRequestException(`الحد الأدنى للسحب ${minAmount} ${dto.currency}.`);
        if (maxAmount && dto.amount > maxAmount) throw new BadRequestException(`الحد الأقصى للسحب ${maxAmount} ${dto.currency}.`);

        await this.ledgerService.holdWalletBalance(wallet.id, dto.amount, tx);
        const created = await tx.payoutRequest.create({
          data: {
            payoutNumber,
            userId,
            walletId: wallet.id,
            currency: dto.currency,
            amount: new Prisma.Decimal(dto.amount),
            feeAmount: new Prisma.Decimal(0),
            channelCode: dto.channelCode,
            destinationAccount: dto.destinationAccount.trim(),
            beneficiaryName: dto.beneficiaryName.trim(),
            idempotencyKey: dto.idempotencyKey,
            status: PayoutStatus.REQUESTED,
          },
        });

        if (strict && config?.mode === PaymentChannelMode.MANUAL) {
          await tx.walletAgentOperation.create({
            data: {
              tenantId: getCurrentTenantId() || null,
              channelCode: dto.channelCode,
              direction: 'OUTBOUND_PAYOUT',
              status: 'PENDING',
              payoutRequestId: created.id,
              customerUserId: userId,
              expectedAmount: new Prisma.Decimal(dto.amount),
              expectedCurrency: dto.currency,
              expectedAccountLastFour: dto.destinationAccount.trim().slice(-4),
            },
          });
        }
        return created;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return { success: true, payout: this.mapPayout(row) };
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const duplicate = await this.prisma.payoutRequest.findUnique({ where: { idempotencyKey: dto.idempotencyKey } });
        if (duplicate) {
          if (duplicate.userId !== userId) throw new ConflictException('مفتاح عدم التكرار يعود إلى عميل آخر.');
          return { success: true, payout: this.mapPayout(duplicate) };
        }
      }
      if (error instanceof BadRequestException || error instanceof ForbiddenException ||
          error instanceof NotFoundException || error instanceof ConflictException ||
          error instanceof ServiceUnavailableException) throw error;
      this.logger.error(`Atomic payout request failed: ${error?.message || error}`);
      throw new ServiceUnavailableException('تعذر حفظ طلب السحب وحجز الرصيد معاً؛ لم يتم استخدام مخزن مؤقت.');
    }
  }

  async approvePayout(staffUserId: string, payoutId: string, dto?: ApprovePayoutDto): Promise<{ success: boolean; payout: InMemoryPayout }> {
    const payout = await this.getPayoutById(payoutId);
    if (payout.status !== PayoutStatus.REQUESTED) throw new BadRequestException(`حالة الطلب لا تسمح بالاعتماد: ${payout.status}`);
    if (payout.userId === staffUserId) throw new ForbiddenException('لا يمكن لمقدم طلب السحب اعتماده بنفسه.');

    const updated = await this.prisma.$transaction(async (tx) => {
      if (this.isRegulatedRuntime) {
        const config = await tx.paymentChannelConfig.findFirst({
          where: {
            tenantId: getCurrentTenantId() || null,
            code: payout.channelCode,
            isActive: true,
            verificationStatus: 'VERIFIED',
          },
        });
        if (
          !config ||
          !config.accountNumber ||
          config.accountNumber === 'NOT_CONFIGURED' ||
          !config.regulatoryApprovalReference ||
          !config.regulatoryApprovalDocumentUrl ||
          !config.providerAgreementReference ||
          !config.providerAgreementDocumentUrl
        ) {
          throw new ServiceUnavailableException('لا يمكن اعتماد السحب دون قناة موثقة واعتماد تنظيمي واتفاقية تاجر سارية.');
        }
        if (config.mode === PaymentChannelMode.MANUAL) {
          const operation = await tx.walletAgentOperation.findUnique({
            where: { payoutRequestId: payout.id },
          });
          if (!operation || operation.direction !== 'OUTBOUND_PAYOUT' || operation.status !== 'PENDING') {
            throw new BadRequestException('مهمة الوكيل الصادر غير موجودة أو ليست في حالة انتظار قبل اعتماد السحب.');
          }
        } else if (
          config.mode !== PaymentChannelMode.API ||
          !this.adapterRegistry.getAdapter(payout.channelCode)?.getInfo().capabilities?.payout
        ) {
          throw new ServiceUnavailableException('لم يتم اعتماد محول API للسحب بهذه القناة؛ لا يمكن اعتماد الطلب.');
        }
      }

      const changed = await tx.payoutRequest.updateMany({
        where: { id: payoutId, status: PayoutStatus.REQUESTED },
        data: { status: PayoutStatus.APPROVED, approvedByUserId: staffUserId, approvalNotes: dto?.reviewNotes || 'تمت الموافقة المالية.' },
      });
      if (changed.count !== 1) throw new ConflictException('تغيرت حالة الطلب بالتزامن.');
      await tx.auditLog.create({
        data: {
          userId: staffUserId,
          action: 'CUSTOMER_PAYOUT_APPROVED',
          entityName: 'PayoutRequest',
          entityId: payoutId,
          newValues: { amount: payout.amount, currency: payout.currency, channelCode: payout.channelCode, approvalNotes: dto?.reviewNotes || null },
        },
      });
      return tx.payoutRequest.findUnique({ where: { id: payoutId } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { success: true, payout: this.mapPayout(updated) };
  }

  async dispatchPayout(staffUserId: string, payoutId: string): Promise<{ success: boolean; status: PayoutStatus; message: string; payout: InMemoryPayout }> {
    const payout = await this.getPayoutById(payoutId);
    if (payout.status !== PayoutStatus.APPROVED) throw new BadRequestException('يجب اعتماد طلب السحب أولاً.');
    if (payout.approvedByUserId === staffUserId) throw new ForbiddenException('من اعتمد طلب السحب لا ينفذ التحويل بنفسه.');
    const adapter = this.adapterRegistry.getAdapter(payout.channelCode);
    if (!adapter) throw new ServiceUnavailableException('محوّل قناة السحب غير مسجل.');
    const channel = adapter.getInfo();
    if (!channel.isActive || [PaymentChannelMode.BLOCKED_EXTERNAL, PaymentChannelMode.MANUAL, PaymentChannelMode.DISABLED].includes(channel.mode) || !channel.capabilities?.payout) {
      return { success: false, status: PayoutStatus.APPROVED, message: 'التحويل الآلي محجوب. استخدم إجراءً يدوياً موثقاً وموافقة مالية مستقلة.', payout };
    }

    const started = await this.prisma.payoutRequest.updateMany({ where: { id: payoutId, status: PayoutStatus.APPROVED }, data: { status: PayoutStatus.PROCESSING } });
    if (started.count !== 1) throw new ConflictException('طلب السحب قيد المعالجة أو تغيرت حالته.');

    let result: any;
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
    } catch (error: any) {
      result = { success: false, status: 'UNKNOWN', message: error?.message || 'نتيجة التحويل غير معروفة لدى المزود.' };
    }

    if (result?.success && result.status === 'CONFIRMED' && result.externalReference?.trim()) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const ledger = await this.ledgerService.recordPayoutSettlement({
            payoutId: payout.id, payoutNumber: payout.payoutNumber, userId: payout.userId,
            walletId: payout.walletId || undefined, currency: payout.currency, amount: payout.amount.toString(),
            channelCode: payout.channelCode, destinationAccount: payout.destinationAccount,
            performedByUserId: staffUserId, notes: `تحويل مؤكد من ${payout.channelCode} بمرجع ${result.externalReference}`,
          }, tx);
          const ledgerId = ledger?.transaction?.id || ledger?.transaction?.txNumber;
          if (!ledgerId) throw new ServiceUnavailableException('لم يرجع دفتر الأستاذ معرف قيد صالحاً.');
          await tx.payoutRequest.update({
            where: { id: payout.id },
            data: { status: PayoutStatus.CONFIRMED, externalReference: result.externalReference, ledgerTxId: String(ledgerId), failureReason: null },
          });
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        return { success: true, status: PayoutStatus.CONFIRMED, message: 'تم تأكيد التحويل وترحيل القيد المالي ذرياً.', payout: await this.getPayoutById(payoutId) };
      } catch (error: any) {
        this.logger.error(`Payout settlement failed: ${error?.message || error}`);
        await this.prisma.payoutRequest.update({
          where: { id: payoutId },
          data: { status: PayoutStatus.UNKNOWN, failureReason: 'أكد المزود العملية لكن تعذر إكمال القيد المالي؛ يلزم تحقيق ومطابقة.' },
        });
        return { success: false, status: PayoutStatus.UNKNOWN, message: 'لم يُعتمد السحب محاسبياً؛ بقيت حالته UNKNOWN ولن نعلن النجاح.', payout: await this.getPayoutById(payoutId) };
      }
    }

    if (result?.status === 'FAILED') {
      await this.prisma.$transaction(async (tx) => {
        if (payout.walletId) await this.ledgerService.releaseWalletHold(payout.walletId, payout.amount.toString(), tx);
        await tx.payoutRequest.update({ where: { id: payout.id }, data: { status: PayoutStatus.FAILED, failureReason: result.message || 'رفض المزود عملية السحب.' } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return { success: false, status: PayoutStatus.FAILED, message: result.message || 'رفض المزود عملية السحب.', payout: await this.getPayoutById(payoutId) };
    }

    await this.prisma.payoutRequest.update({
      where: { id: payout.id },
      data: { status: PayoutStatus.UNKNOWN, failureReason: result?.message || 'حالة غير مؤكدة؛ يمنع إعادة الإرسال الآلي.' },
    });
    return { success: false, status: PayoutStatus.UNKNOWN, message: 'حالة التحويل غير مؤكدة؛ بقي الحجز قائماً وأوقفت إعادة المحاولة حتى المطابقة.', payout: await this.getPayoutById(payoutId) };
  }

  async confirmManualPayout(staffUserId: string, payoutId: string, externalRef: string, notes?: string): Promise<{ success: boolean; payout: InMemoryPayout }> {
    const payout = await this.getPayoutById(payoutId);
    if (payout.status !== PayoutStatus.APPROVED) throw new BadRequestException(`لا يمكن تأكيد الطلب بحالته الحالية: ${payout.status}`);
    if (payout.approvedByUserId === staffUserId) throw new ForbiddenException('يجب أن يؤكد التحويل موظف مختلف عن صاحب الموافقة.');
    if (!externalRef?.trim() || externalRef.trim().length < 5) throw new BadRequestException('مرجع التحويل الرسمي مطلوب ويجب ألا يقل عن 5 خانات.');

    await this.prisma.$transaction(async (tx) => {
      const current = await tx.payoutRequest.findUnique({ where: { id: payout.id } });
      if (!current || current.status !== PayoutStatus.APPROVED) throw new ConflictException('تغيرت حالة طلب السحب.');
      let agentOperation: any = null;
      const channelConfig = this.isRegulatedRuntime
        ? await tx.paymentChannelConfig.findFirst({
            where: {
              tenantId: getCurrentTenantId() || null,
              code: payout.channelCode,
              isActive: true,
              verificationStatus: 'VERIFIED',
            },
          })
        : null;
      if (this.isRegulatedRuntime) {
        if (
          !channelConfig ||
          !channelConfig.isActive ||
          channelConfig.verificationStatus !== 'VERIFIED' ||
          channelConfig.mode !== PaymentChannelMode.MANUAL
        ) {
          throw new ServiceUnavailableException('التأكيد اليدوي متاح فقط لقناة سحب يدوية موثقة ومعتمدة.');
        }
        agentOperation = await this.assertManualPayoutAgentEvidence(tx, payout, staffUserId);
        if (!agentOperation || agentOperation.observedReferenceNumber !== externalRef.trim()) {
          throw new BadRequestException('يجب أن يطابق مرجع التحويل المدخل المرجع الذي سجله الوكيل من سجل المحفظة.');
        }
      }

      const ledger = await this.ledgerService.recordPayoutSettlement({
        payoutId: payout.id, payoutNumber: payout.payoutNumber, userId: payout.userId,
        walletId: payout.walletId || undefined, currency: payout.currency, amount: payout.amount,
        channelCode: payout.channelCode, destinationAccount: payout.destinationAccount,
        performedByUserId: staffUserId, notes: notes || `تحويل يدوي موثق بمرجع ${externalRef.trim()}`,
      }, tx);
      const ledgerId = ledger?.transaction?.id || ledger?.transaction?.txNumber;
      if (!ledgerId) throw new ServiceUnavailableException('تعذر الحصول على معرف قيد دفتر الأستاذ.');
      await tx.payoutRequest.update({
        where: { id: payout.id },
        data: { status: PayoutStatus.CONFIRMED, externalReference: externalRef.trim(), ledgerTxId: String(ledgerId), failureReason: null },
      });
      if (agentOperation) {
        await tx.walletAgentOperation.update({
          where: { id: agentOperation.id },
          data: {
            status: 'POSTED',
            financeReviewedByUserId: staffUserId,
            financeNotes: notes?.trim() || 'اعتماد تسوية التحويل اليدوي بعد تحقق الوكيل.',
            ledgerTxId: String(ledgerId),
            postedAt: new Date(),
          },
        });
      }
      await tx.auditLog.create({
        data: {
          userId: staffUserId,
          action: 'MANUAL_PAYOUT_SETTLED',
          entityName: 'PayoutRequest',
          entityId: payout.id,
          newValues: { externalReference: externalRef.trim(), ledgerTxId: String(ledgerId), agentUserId: agentOperation?.agentUserId || null },
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { success: true, payout: await this.getPayoutById(payoutId) };
  }

  async rejectPayout(staffUserId: string, payoutId: string, reason: string): Promise<{ success: boolean; payout: InMemoryPayout }> {
    const payout = await this.getPayoutById(payoutId);
    if (![PayoutStatus.REQUESTED, PayoutStatus.APPROVED].includes(payout.status)) {
      throw new BadRequestException('لا يمكن إلغاء طلب دخل مرحلة التحويل الخارجي أو أصبحت نتيجته غير معروفة؛ يجب إجراء مطابقة مستقلة أولاً.');
    }
    if (payout.approvedByUserId === staffUserId) throw new ForbiddenException('مقدم الموافقة لا يجوز أن ينفذ الإجراء النهائي وحده.');
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.payoutRequest.findUnique({ where: { id: payout.id } });
      if (!current || ![PayoutStatus.REQUESTED, PayoutStatus.APPROVED].includes(current.status as PayoutStatus)) {
        throw new ConflictException('تغيرت حالة طلب السحب إلى مرحلة تنفيذ أو حالة غير محسومة؛ لم يتم تحرير الحجز.');
      }
      if (current.approvedByUserId && current.approvedByUserId === staffUserId) {
        throw new ForbiddenException('مقدم الموافقة لا يجوز أن يرفض الطلب أو يحرر حجزه منفرداً.');
      }
      if (current.walletId) await this.ledgerService.releaseWalletHold(current.walletId, Number(current.amount), tx);
      const changed = await tx.payoutRequest.updateMany({
        where: { id: payout.id, status: current.status },
        data: { status: PayoutStatus.CANCELLED, failureReason: reason || 'رفض إداري', approvedByUserId: staffUserId },
      });
      if (changed.count !== 1) throw new ConflictException('تغيرت حالة طلب السحب بالتزامن؛ أُلغي تحرير الحجز.');
      await tx.walletAgentOperation.updateMany({
        where: { payoutRequestId: payout.id, status: { in: ['PENDING', 'CLAIMED', 'AGENT_SUBMITTED', 'NEEDS_REVIEW'] } },
        data: { status: 'REJECTED', financeReviewedByUserId: staffUserId, financeNotes: reason || 'رفض إداري' },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { success: true, payout: await this.getPayoutById(payoutId) };
  }

  async getPayoutById(payoutId: string, requestingUserId?: string): Promise<InMemoryPayout> {
    const row = await this.prisma.payoutRequest.findUnique({ where: { id: payoutId } });
    if (!row) throw new NotFoundException(`طلب السحب ${payoutId} غير موجود.`);
    if (requestingUserId && row.userId !== requestingUserId) throw new ForbiddenException('ليس لديك صلاحية الاطلاع على طلب سحب مستخدم آخر.');
    return this.mapPayout(row);
  }

  async findByExternalReference(reference: string): Promise<InMemoryPayout | null> {
    const row = await this.prisma.payoutRequest.findFirst({
      where: { externalReference: reference.trim() },
      orderBy: { createdAt: 'desc' },
    });
    return row ? this.mapPayout(row) : null;
  }

  async findByIdempotencyKey(key: string): Promise<InMemoryPayout | null> {
    const row = await this.prisma.payoutRequest.findUnique({ where: { idempotencyKey: key } });
    return row ? this.mapPayout(row) : null;
  }

  async listPayouts(filters?: { status?: PayoutStatus; userId?: string }): Promise<InMemoryPayout[]> {
    const where: Prisma.PayoutRequestWhereInput = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.userId) where.userId = filters.userId;
    const rows = await this.prisma.payoutRequest.findMany({ where, orderBy: { createdAt: 'desc' } });
    return rows.map((row) => this.mapPayout(row));
  }
}

function cryptoRandomSuffix(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}
