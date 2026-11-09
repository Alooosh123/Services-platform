import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { getCurrentTenantId } from '../../tenant/tenant-context.store';
import { ProfitEngineService } from './profit-engine.service';
import { LedgerService } from '../ledger/ledger.service';
import { TotpUtil } from '../auth/utils/totp.util';
import { EncryptionService } from '../../security/encryption.service';
import {
  CurrencyCode,
  PaymentChannelCode,
  OwnerPayoutStatus,
  BeneficiaryVerificationStatus,
  LedgerTransactionType,
  OwnerPayoutRequestDto,
  ApproveOwnerPayoutDto,
  CreatePayoutBeneficiaryDto,
} from '@digital-topup/shared';
import { randomUUID } from 'crypto';

@Injectable()
export class OwnerEarningsService {
  constructor(
    private prisma: PrismaService,
    private profitEngine: ProfitEngineService,
    private ledgerService: LedgerService,
    private encryptionService: EncryptionService,
  ) {}

  private assertPlatformOwnerContext(): void {
    if (getCurrentTenantId()) {
      throw new ForbiddenException('أرباح مالك المنصة لا تتاح من نطاق متجر مستأجر.');
    }
  }

  private get tenantId(): string | null {
    return getCurrentTenantId() || null;
  }

  private async resolvePlatformOwnerId(requesterId?: string): Promise<string> {
    this.assertPlatformOwnerContext();
    if (requesterId) {
      const requester = await this.prisma.user.findUnique({
        where: { id: requesterId },
        select: { id: true, role: true },
      });
      if (requester && requester.role === 'OWNER') return requester.id;
    }
    const owner = await this.prisma.user.findFirst({
      where: { role: 'OWNER', tenantId: this.tenantId },
      select: { id: true },
    });
    if (!owner) throw new NotFoundException('لم يتم إعداد حساب مالك المنصة في قاعدة البيانات.');
    return owner.id;
  }

  private mapBeneficiary(row: any) {
    const stored = String(row.accountNumber || '');
    let lastFour = '';
    try {
      const plain = stored.startsWith('v1:') ? this.encryptionService.decrypt(stored) : stored;
      lastFour = plain.slice(-4);
    } catch {
      lastFour = '';
    }
    const { accountNumber: _sensitive, ...safe } = row;
    return {
      ...safe,
      accountNumberMasked: lastFour ? '•••• ' + lastFour : 'محجوب',
      accountNumberProtected: stored.startsWith('v1:'),
    };
  }

  private async ensureBeneficiaryEncrypted(row: any) {
    const stored = String(row.accountNumber || '');
    if (!stored || stored.startsWith('v1:') || ['NOT_CONFIGURED', 'TEST', 'MOCK'].includes(stored.toUpperCase())) {
      return row;
    }
    const encrypted = this.encryptionService.encrypt(stored);
    const result = await this.prisma.payoutBeneficiary.updateMany({
      where: { id: row.id, accountNumber: stored },
      data: { accountNumber: encrypted },
    });
    if (result.count === 1) row.accountNumber = encrypted;
    else {
      const fresh = await this.prisma.payoutBeneficiary.findUnique({ where: { id: row.id } });
      if (fresh) return fresh;
    }
    return row;
  }

  private mapPayout(row: any) {
    if (!row) return row;
    const { beneficiary, ...rest } = row;
    return {
      ...rest,
      amount: Number(row.amount),
      beneficiary: beneficiary ? this.mapBeneficiary(beneficiary) : undefined,
    };
  }

  async createBeneficiary(userId: string, dto: CreatePayoutBeneficiaryDto) {
    this.assertPlatformOwnerContext();
    if (!dto.beneficiaryName?.trim() || !dto.accountNumber?.trim()) {
      throw new BadRequestException('اسم المستفيد ورقم الحساب مطلوبان.');
    }
    const ownerId = await this.resolvePlatformOwnerId(userId);
    if (ownerId !== userId) throw new ForbiddenException('تسجيل مستفيد الأرباح متاح لمالك المنصة فقط.');
    const encryptedAccountNumber = this.encryptionService.encrypt(dto.accountNumber.trim());

    const created = await this.prisma.payoutBeneficiary.create({
      data: {
        userId: ownerId,
        beneficiaryName: dto.beneficiaryName.trim(),
        channelCode: dto.channelCode,
        accountNumber: encryptedAccountNumber,
        verificationStatus: BeneficiaryVerificationStatus.PENDING_REVIEW,
        financeApprovedBy: null,
        notes: dto.notes || null,
      },
    });
    return this.mapBeneficiary(created);
  }

  async approveBeneficiary(beneficiaryId: string, financeUserId: string, approved: boolean, notes?: string) {
    this.assertPlatformOwnerContext();
    const beneficiary = await this.prisma.payoutBeneficiary.findUnique({ where: { id: beneficiaryId } });
    if (!beneficiary) throw new NotFoundException('حساب المستفيد غير موجود.');
    if (beneficiary.userId === financeUserId) throw new ForbiddenException('لا يجوز لمالك المستفيد اعتماد حسابه بنفسه.');
    if (beneficiary.verificationStatus !== BeneficiaryVerificationStatus.PENDING_REVIEW) {
      throw new ConflictException('حساب المستفيد سبق اتخاذ قرار بشأنه.');
    }
    const encryptedBeneficiary = await this.ensureBeneficiaryEncrypted(beneficiary);
    if (!String(encryptedBeneficiary.accountNumber || '').startsWith('v1:')) {
      throw new BadRequestException('بيانات حساب المستفيد غير محمية أو غير صالحة؛ أعد إدخالها من حساب المالك.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.payoutBeneficiary.updateMany({
        where: { id: beneficiaryId, verificationStatus: BeneficiaryVerificationStatus.PENDING_REVIEW },
        data: {
          verificationStatus: approved ? BeneficiaryVerificationStatus.VERIFIED : BeneficiaryVerificationStatus.REJECTED,
          financeApprovedBy: financeUserId,
          notes: [beneficiary.notes, notes].filter(Boolean).join(' | ') || null,
        },
      });
      if (changed.count !== 1) throw new ConflictException('تغيرت حالة المستفيد أثناء الاعتماد.');
      await tx.auditLog.create({
        data: {
          userId: financeUserId,
          action: approved ? 'OWNER_PAYOUT_BENEFICIARY_APPROVED' : 'OWNER_PAYOUT_BENEFICIARY_REJECTED',
          entityName: 'PayoutBeneficiary',
          entityId: beneficiaryId,
          newValues: { approved, notes: notes || null, financeApprovedBy: financeUserId },
        },
      });
      return tx.payoutBeneficiary.findUnique({ where: { id: beneficiaryId } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return this.mapBeneficiary(updated);
  }

  async getBeneficiaryForFinance(beneficiaryId: string, financeUserId: string) {
    this.assertPlatformOwnerContext();
    const row = await this.prisma.payoutBeneficiary.findUnique({ where: { id: beneficiaryId } });
    if (!row) throw new NotFoundException('حساب المستفيد غير موجود.');
    const ownerId = await this.resolvePlatformOwnerId();
    if (row.userId !== ownerId) throw new ForbiddenException('حساب المستفيد لا ينتمي إلى مالك المنصة.');
    const secured = await this.ensureBeneficiaryEncrypted(row);
    if (!String(secured.accountNumber || '').startsWith('v1:')) {
      throw new ServiceUnavailableException('تعذر فك تشفير حساب المستفيد بأمان.');
    }
    const accountNumber = this.encryptionService.decrypt(secured.accountNumber);
    await this.prisma.auditLog.create({
      data: {
        userId: financeUserId,
        action: 'OWNER_PAYOUT_BENEFICIARY_ACCOUNT_VIEWED',
        entityName: 'PayoutBeneficiary',
        entityId: beneficiaryId,
        newValues: { access: 'FINANCE_ONLY', accountNumberLastFour: accountNumber.slice(-4) },
      },
    });
    return {
      id: row.id,
      beneficiaryName: row.beneficiaryName,
      channelCode: row.channelCode,
      accountNumber,
      verificationStatus: row.verificationStatus,
    };
  }

  async listBeneficiaries(requesterId?: string) {
    this.assertPlatformOwnerContext();
    const ownerId = await this.resolvePlatformOwnerId(requesterId);
    const rows = await this.prisma.payoutBeneficiary.findMany({
      where: { userId: ownerId },
      orderBy: { createdAt: 'desc' },
    });
    const result = [];
    for (const row of rows) result.push(this.mapBeneficiary(await this.ensureBeneficiaryEncrypted(row)));
    return result;
  }

  async getEarningsStatement(requesterId: string, currency: CurrencyCode) {
    this.assertPlatformOwnerContext();
    const userId = await this.resolvePlatformOwnerId(requesterId);
    const metrics = await this.profitEngine.calculateMetricsForCurrency(currency);

    // This wallet is a durable projection of posted order-profit snapshots;
    // it never starts with seeded demo balances.
    const wallet = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.ownerEarningsWallet.findFirst({
        where: { userId, currency, tenantId: this.tenantId },
      });
      if (existing) {
        return tx.ownerEarningsWallet.update({
          where: { id: existing.id },
          data: { realizedEarnings: new Prisma.Decimal(Math.max(0, metrics.realizedProfit)) },
        });
      }
      return tx.ownerEarningsWallet.create({
        data: {
          userId,
          currency,
          tenantId: this.tenantId,
          realizedEarnings: new Prisma.Decimal(Math.max(0, metrics.realizedProfit)),
          lockedEarnings: new Prisma.Decimal(0),
          withdrawnEarnings: new Prisma.Decimal(0),
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    const realizedEarnings = Number(wallet.realizedEarnings);
    const lockedEarnings = Number(wallet.lockedEarnings);
    const withdrawnEarnings = Number(wallet.withdrawnEarnings);
    const netEarningsBalance = Math.max(0, realizedEarnings - lockedEarnings - withdrawnEarnings);
    const freeCash = Math.max(
      0,
      metrics.actualCashBalance - metrics.customerWalletLiabilities -
        metrics.supplierPayables - metrics.operatingReserve,
    );
    const availableForPayout = Math.min(netEarningsBalance, freeCash);
    return {
      userId,
      currency,
      realizedEarnings,
      lockedEarnings,
      withdrawnEarnings,
      netEarningsBalance,
      estimatedUnrealizedProfit: metrics.estimatedProfit,
      actualCashBalance: metrics.actualCashBalance,
      customerWalletLiabilities: metrics.customerWalletLiabilities,
      supplierPayables: metrics.supplierPayables,
      operatingReserve: metrics.operatingReserve,
      withdrawableLiquidity: freeCash,
      availableForPayout,
      hasSufficientLiquidity: availableForPayout > 0,
    };
  }

  private async verifyOwnerTotp(userId: string, code: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isTwoFactorEnabled: true, twoFactorSecret: true },
    });
    if (!user?.isTwoFactorEnabled || !user.twoFactorSecret) {
      throw new ForbiddenException('يجب إعداد MFA حقيقي لحساب المالك قبل طلب سحب الأرباح.');
    }
    let secret = user.twoFactorSecret;
    try {
      if (secret.startsWith('v1:')) secret = this.encryptionService.decrypt(secret);
    } catch {
      throw new ServiceUnavailableException('تعذر فك تشفير سر MFA؛ تم إيقاف عملية السحب.');
    }
    if (!TotpUtil.verifyCode(code, secret)) {
      throw new ForbiddenException('رمز MFA غير صحيح أو منتهي الصلاحية.');
    }
  }

  async requestOwnerPayout(
    userId: string,
    dto: OwnerPayoutRequestDto,
  ): Promise<{ success: boolean; payout: any; message: string }> {
    this.assertPlatformOwnerContext();
    if (!dto.idempotencyKey?.trim()) throw new BadRequestException('مفتاح عدم التكرار مطلوب.');
    if (!Number.isFinite(dto.amount) || dto.amount <= 0) throw new BadRequestException('مبلغ السحب يجب أن يكون موجباً وصالحاً.');

    const duplicate = await this.prisma.ownerPayoutTransaction.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
    });
    if (duplicate) return { success: true, payout: this.mapPayout(duplicate), message: 'هذا الطلب مسجل مسبقاً.' };

    const ownerId = await this.resolvePlatformOwnerId(userId);
    if (ownerId !== userId) throw new ForbiddenException('طلب سحب الأرباح متاح لحساب المالك فقط.');
    await this.verifyOwnerTotp(ownerId, dto.totpCode);
    const beneficiary = await this.prisma.payoutBeneficiary.findFirst({
      where: { id: dto.beneficiaryId, userId: ownerId, verificationStatus: BeneficiaryVerificationStatus.VERIFIED },
    });
    if (!beneficiary || !String(beneficiary.accountNumber || '').startsWith('v1:')) {
      throw new BadRequestException('يجب أن يكون حساب المستفيد محمياً وموثقاً باعتماد مالي مستقل.');
    }

    const statement = await this.getEarningsStatement(ownerId, dto.currency);
    if (dto.amount > statement.availableForPayout) {
      throw new BadRequestException(
        'المبلغ يتجاوز الأرباح المحققة والسيولة القابلة للتوزيع (' +
        statement.availableForPayout + ' ' + dto.currency + ').',
      );
    }

    const payoutNumber = 'OPO-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' +
      Math.floor(1000 + Math.random() * 9000);
    const id = randomUUID();
    const row = await this.prisma.$transaction(async (tx) => {
      const duplicateInside = await tx.ownerPayoutTransaction.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (duplicateInside) return duplicateInside;
      const wallet = await tx.ownerEarningsWallet.findFirst({
        where: { userId: ownerId, currency: dto.currency, tenantId: this.tenantId },
      });
      if (!wallet) throw new BadRequestException('لا يوجد رصيد أرباح مالك مرحّل إلى المحفظة الدائمة لهذه العملة.');
      const availableLedgerEarnings = new Prisma.Decimal(wallet.realizedEarnings)
        .sub(wallet.lockedEarnings).sub(wallet.withdrawnEarnings);
      if (availableLedgerEarnings.lessThan(dto.amount)) throw new BadRequestException('رصيد الأرباح المرحّل غير كافٍ.');
      const locked = await tx.ownerEarningsWallet.updateMany({
        where: { id: wallet.id, lockedEarnings: wallet.lockedEarnings },
        data: { lockedEarnings: { increment: new Prisma.Decimal(dto.amount) } },
      });
      if (locked.count !== 1) throw new ConflictException('تغير رصيد أرباح المالك بالتزامن؛ أعد المحاولة.');
      return tx.ownerPayoutTransaction.create({
        data: {
          id,
          payoutNumber,
          userId: ownerId,
          beneficiaryId: beneficiary.id,
          currency: dto.currency,
          amount: new Prisma.Decimal(dto.amount),
          status: OwnerPayoutStatus.REQUESTED,
          idempotencyKey: dto.idempotencyKey,
          approvalNotes: dto.notes || null,
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return {
      success: true,
      payout: this.mapPayout(row),
      message: 'تم حفظ طلب السحب وحجز الأرباح في قاعدة البيانات؛ بانتظار اعتماد مستقل من المالية.',
    };
  }

  async approveOwnerPayout(payoutId: string, dto: ApproveOwnerPayoutDto, financeUserId: string) {
    this.assertPlatformOwnerContext();
    const payout = await this.prisma.ownerPayoutTransaction.findUnique({ where: { id: payoutId } });
    if (!payout) throw new NotFoundException('طلب سحب الأرباح غير موجود.');
    if (payout.status !== OwnerPayoutStatus.REQUESTED) throw new ConflictException('لا يمكن اعتماد طلب بحالة ' + payout.status + '.');
    if (payout.userId === financeUserId) throw new ForbiddenException('مبدأ الرقابة الثنائية يمنع اعتماد المالك لطلبه.');

    const updated = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.ownerPayoutTransaction.updateMany({
        where: { id: payoutId, status: OwnerPayoutStatus.REQUESTED },
        data: dto.approved
          ? { status: OwnerPayoutStatus.APPROVED, approvedByUserId: financeUserId, approvalNotes: dto.financeNotes || 'اعتماد مالي مستقل.' }
          : { status: OwnerPayoutStatus.FAILED, approvedByUserId: financeUserId, failureReason: dto.financeNotes || 'رفض مالي.' },
      });
      if (changed.count !== 1) throw new ConflictException('تغيرت حالة طلب السحب بالتزامن.');
      if (!dto.approved) {
        const released = await tx.ownerEarningsWallet.updateMany({
          where: { userId: payout.userId, currency: payout.currency, tenantId: this.tenantId, lockedEarnings: { gte: payout.amount } },
          data: { lockedEarnings: { decrement: payout.amount } },
        });
        if (released.count !== 1) throw new ServiceUnavailableException('تعذر تحرير حجز الأرباح؛ يلزم تدخل مالي.');
      }
      await tx.auditLog.create({
        data: {
          userId: financeUserId,
          action: dto.approved ? 'OWNER_PAYOUT_APPROVED' : 'OWNER_PAYOUT_REJECTED',
          entityName: 'OwnerPayoutTransaction',
          entityId: payoutId,
          newValues: { approved: dto.approved, financeNotes: dto.financeNotes || null },
        },
      });
      return tx.ownerPayoutTransaction.findUnique({ where: { id: payoutId }, include: { beneficiary: true } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return this.mapPayout(updated);
  }

  async confirmExternalTransfer(payoutId: string, externalRef: string, financeUserId: string) {
    this.assertPlatformOwnerContext();
    if (!externalRef?.trim() || externalRef.trim().length < 5) throw new BadRequestException('مرجع التحويل الخارجي الرسمي مطلوب.');
    const payout = await this.prisma.ownerPayoutTransaction.findUnique({
      where: { id: payoutId },
      include: { beneficiary: true },
    });
    if (!payout) throw new NotFoundException('طلب السحب غير موجود.');
    if (payout.status !== OwnerPayoutStatus.APPROVED) throw new ConflictException('لا يمكن تأكيد تحويل لم يحصل على موافقة مالية مستقلة.');
    if (payout.approvedByUserId === financeUserId) throw new ForbiddenException('يجب أن يكون منفذ/مؤكد التحويل مختلفاً عن صاحب الموافقة.');
    const beneficiaryChannel = payout.beneficiary.channelCode as PaymentChannelCode;
    const cashAccountCode = payout.currency === CurrencyCode.YER
      ? this.ledgerService.getChannelAccountCode(beneficiaryChannel, payout.currency)
      : this.ledgerService.getBankCashAccountCode(payout.currency);

    const scopedCashAccountCode = this.ledgerService.scopeAccountCode(cashAccountCode);
    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await tx.ownerPayoutTransaction.findUnique({ where: { id: payoutId } });
      if (!current || current.status !== OwnerPayoutStatus.APPROVED) throw new ConflictException('تغيرت حالة طلب السحب.');
      const cashAccount = await tx.ledgerAccount.findFirst({
        where: { code: scopedCashAccountCode, currency: current.currency, type: 'ASSET' },
      });
      if (!cashAccount) {
        throw new BadRequestException(
          'حساب النقد/المحفظة المختار غير موجود في دليل الحسابات لهذه العملة؛ لم يتم ترحيل السحب.',
        );
      }
      const ledger = await this.ledgerService.recordDoubleEntryTransaction({
        txNumber: 'TX-OWNER-PAYOUT-' + current.payoutNumber,
        type: LedgerTransactionType.ADJUSTMENT,
        referenceType: 'OWNER_PAYOUT',
        referenceId: current.id,
        idempotencyKey: 'OWNER-PAYOUT-SETTLE-' + current.idempotencyKey,
        notes: 'صرف أرباح المالك بمرجع تحويل ' + externalRef.trim(),
        createdByUserId: financeUserId,
        entries: [
          {
            accountCode: '3100-RETAINED_EARNINGS',
            currency: current.currency as CurrencyCode,
            debitAmount: Number(current.amount),
            creditAmount: 0,
            notes: 'توزيع أرباح بموجب ' + current.payoutNumber,
          },
          {
            accountCode: cashAccountCode,
            currency: current.currency as CurrencyCode,
            debitAmount: 0,
            creditAmount: Number(current.amount),
            notes: 'صرف نقدي خارجي مرجع ' + externalRef.trim(),
          },
        ],
      }, tx);
      const ledgerId = ledger?.transaction?.id || ledger?.transaction?.txNumber;
      if (!ledgerId) throw new ServiceUnavailableException('تعذر الحصول على معرف قيد دفتر الأستاذ.');
      const released = await tx.ownerEarningsWallet.updateMany({
        where: { userId: current.userId, currency: current.currency, tenantId: this.tenantId, lockedEarnings: { gte: current.amount } },
        data: {
          lockedEarnings: { decrement: current.amount },
          withdrawnEarnings: { increment: current.amount },
        },
      });
      if (released.count !== 1) throw new ServiceUnavailableException('تعذر تحديث محفظة أرباح المالك؛ أُلغيت المعاملة كلها.');
      const saved = await tx.ownerPayoutTransaction.update({
        where: { id: payoutId },
        data: {
          status: OwnerPayoutStatus.CONFIRMED,
          externalReference: externalRef.trim(),
          ledgerTxId: String(ledgerId),
        },
      });
      await tx.auditLog.create({
        data: {
          userId: financeUserId,
          action: 'OWNER_PAYOUT_TRANSFER_CONFIRMED',
          entityName: 'OwnerPayoutTransaction',
          entityId: payoutId,
          newValues: { externalReference: externalRef.trim(), ledgerTxId: String(ledgerId) },
        },
      });
      return saved;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return this.mapPayout(updated);
  }

  async failPayout(payoutId: string, reason: string) {
    this.assertPlatformOwnerContext();
    const payout = await this.prisma.ownerPayoutTransaction.findUnique({ where: { id: payoutId } });
    if (!payout) throw new NotFoundException('طلب السحب غير موجود.');
    if (payout.status !== OwnerPayoutStatus.REQUESTED) {
      throw new ConflictException('لا يمكن تحرير الأرباح بعد اعتماد التحويل؛ يجب أن تمر الإلغاء بعد الاعتماد بمسار مراجعة مالية مستقل.');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.ownerEarningsWallet.updateMany({
        where: { userId: payout.userId, currency: payout.currency, tenantId: this.tenantId, lockedEarnings: { gte: payout.amount } },
        data: { lockedEarnings: { decrement: payout.amount } },
      });
      if (wallet.count !== 1) throw new ServiceUnavailableException('تعذر تحرير حجز أرباح المالك.');
      return tx.ownerPayoutTransaction.update({
        where: { id: payoutId },
        data: { status: OwnerPayoutStatus.FAILED, failureReason: reason || 'تعذر تنفيذ التحويل.' },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return this.mapPayout(updated);
  }

  async listOwnerPayouts(userId?: string) {
    this.assertPlatformOwnerContext();
    const ownerId = await this.resolvePlatformOwnerId(userId);
    const rows = await this.prisma.ownerPayoutTransaction.findMany({
      where: { userId: ownerId },
      include: { beneficiary: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.mapPayout(row));
  }
}
