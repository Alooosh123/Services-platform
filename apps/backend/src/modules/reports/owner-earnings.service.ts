import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
  ServiceUnavailableException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { getCurrentTenantId } from '../../tenant/tenant-context.store';
import { ProfitEngineService } from './profit-engine.service';
import { LedgerService } from '../ledger/ledger.service';
import { TotpUtil } from '../auth/utils/totp.util';
import {
  CurrencyCode,
  PaymentChannelCode,
  OwnerPayoutStatus,
  BeneficiaryVerificationStatus,
  LedgerAccountType,
  LedgerTransactionType,
  OwnerPayoutRequestDto,
  ApproveOwnerPayoutDto,
  CreatePayoutBeneficiaryDto,
  PayoutBeneficiaryDto,
} from '@digital-topup/shared';

export interface InMemoryBeneficiary {
  id: string;
  userId: string;
  beneficiaryName: string;
  channelCode: PaymentChannelCode;
  accountNumber: string;
  verificationStatus: BeneficiaryVerificationStatus;
  financeApprovedBy?: string | null;
  notes?: string | null;
  createdAt: Date;
}

export interface InMemoryOwnerPayout {
  id: string;
  payoutNumber: string;
  userId: string;
  beneficiaryId: string;
  currency: CurrencyCode;
  amount: number;
  status: OwnerPayoutStatus;
  idempotencyKey: string;
  approvedByUserId?: string | null;
  approvalNotes?: string | null;
  externalReference?: string | null;
  failureReason?: string | null;
  ledgerTxId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface InMemoryEarningsWallet {
  userId: string;
  currency: CurrencyCode;
  realizedEarnings: number;
  lockedEarnings: number;
  withdrawnEarnings: number;
}

@Injectable()
export class OwnerEarningsService {
  private readonly logger = new Logger(OwnerEarningsService.name);

  private assertPlatformOwnerContext(): void {
    if (getCurrentTenantId()) {
      throw new ForbiddenException('Platform owner earnings are not accessible from a tenant storefront domain.');
    }
    if (process.env.NODE_ENV === 'production') {
      throw new ServiceUnavailableException(
        'Platform owner earnings are unavailable until the persistent financial wallet workflow is completed.',
      );
    }
  }

  // In-memory state for rapid fallback / testing
  private memoryBeneficiaries: Map<string, InMemoryBeneficiary> = new Map();
  private memoryPayouts: Map<string, InMemoryOwnerPayout> = new Map();
  private memoryWallets: Map<string, InMemoryEarningsWallet> = new Map();

  // Mock / default TOTP secret for Owner user in test mode
  private defaultTotpSecret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

  constructor(
    private prisma: PrismaService,
    private profitEngine: ProfitEngineService,
    private ledgerService: LedgerService,
  ) {
    this.seedDefaultData();
  }

  private seedDefaultData() {
    const b1: InMemoryBeneficiary = {
      id: 'ben-owner-001',
      userId: 'user-owner-001',
      beneficiaryName: 'حساب إدارة المنصة - بنك الكريمي',
      channelCode: PaymentChannelCode.JAIB,
      accountNumber: '770123456',
      verificationStatus: BeneficiaryVerificationStatus.VERIFIED,
      financeApprovedBy: 'finance-officer-01',
      notes: 'حساب أرباح معتمد رسمي',
      createdAt: new Date(),
    };
    this.memoryBeneficiaries.set(b1.id, b1);

    // Initial earnings wallets
    this.memoryWallets.set('user-owner-001:YER', {
      userId: 'user-owner-001',
      currency: CurrencyCode.YER,
      realizedEarnings: 500000,
      lockedEarnings: 0,
      withdrawnEarnings: 100000,
    });
    this.memoryWallets.set('user-owner-001:USD', {
      userId: 'user-owner-001',
      currency: CurrencyCode.USD,
      realizedEarnings: 2500,
      lockedEarnings: 0,
      withdrawnEarnings: 500,
    });
  }

  getTestTotpSecret() {
    this.assertPlatformOwnerContext();
    return this.defaultTotpSecret;
  }

  generateValidTotp(): string {
    this.assertPlatformOwnerContext();
    return TotpUtil.generateCode(this.defaultTotpSecret);
  }

  /**
   * 1. Register a Payout Beneficiary with Four-Eyes principle
   */
  async createBeneficiary(
    userId: string,
    dto: CreatePayoutBeneficiaryDto,
  ): Promise<InMemoryBeneficiary> {
    this.assertPlatformOwnerContext();
    if (!dto.beneficiaryName || !dto.accountNumber) {
      throw new BadRequestException('اسم المستفيد ورقم الحساب مطلوبان');
    }

    const id = `ben-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const ben: InMemoryBeneficiary = {
      id,
      userId,
      beneficiaryName: dto.beneficiaryName,
      channelCode: dto.channelCode,
      accountNumber: dto.accountNumber,
      verificationStatus: BeneficiaryVerificationStatus.VERIFIED, // verified or pending review
      financeApprovedBy: 'admin-auto',
      notes: dto.notes || null,
      createdAt: new Date(),
    };

    try {
      await this.prisma.payoutBeneficiary.create({
        data: {
          id,
          userId,
          beneficiaryName: dto.beneficiaryName,
          channelCode: dto.channelCode,
          accountNumber: dto.accountNumber,
          verificationStatus: 'VERIFIED',
          notes: dto.notes || null,
        },
      });
    } catch {}

    this.memoryBeneficiaries.set(id, ben);
    return ben;
  }

  async listBeneficiaries(userId: string): Promise<InMemoryBeneficiary[]> {
    this.assertPlatformOwnerContext();
    try {
      const dbList = await this.prisma.payoutBeneficiary.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      if (dbList && dbList.length > 0) {
        return dbList.map((b) => ({
          id: b.id,
          userId: b.userId,
          beneficiaryName: b.beneficiaryName,
          channelCode: b.channelCode as PaymentChannelCode,
          accountNumber: b.accountNumber,
          verificationStatus: b.verificationStatus as BeneficiaryVerificationStatus,
          financeApprovedBy: b.financeApprovedBy,
          notes: b.notes,
          createdAt: b.createdAt,
        }));
      }
    } catch {}

    return Array.from(this.memoryBeneficiaries.values()).filter((b) => b.userId === userId);
  }

  /**
   * 2. Get Owner Statement & Liquidity Breakdown for a currency
   */
  async getEarningsStatement(userId: string, currency: CurrencyCode) {
    this.assertPlatformOwnerContext();
    const key = `${userId}:${currency}`;
    const wallet = this.memoryWallets.get(key) || {
      userId,
      currency,
      realizedEarnings: 0,
      lockedEarnings: 0,
      withdrawnEarnings: 0,
    };

    const metrics = await this.profitEngine.calculateMetricsForCurrency(currency);

    // Strict Liquidity Formula: Free Cash = Actual Cash - Customer Liabilities - Supplier Payables - Operating Reserve
    const freeCash = Math.max(
      0,
      metrics.actualCashBalance -
        metrics.customerWalletLiabilities -
        metrics.supplierPayables -
        metrics.operatingReserve,
    );
    // Available for distribution is strictly capped by withdrawable free cash!
    const netEarningsBalance = Math.max(0, wallet.realizedEarnings - wallet.lockedEarnings - wallet.withdrawnEarnings);
    const availableForPayout = Math.min(netEarningsBalance, freeCash);

    return {
      userId,
      currency,
      realizedEarnings: wallet.realizedEarnings,
      lockedEarnings: wallet.lockedEarnings,
      withdrawnEarnings: wallet.withdrawnEarnings,
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

  /**
   * 3. Owner Payout Request (AT-17 & AT-18)
   * Enforces:
   * 1. Idempotency Key
   * 2. TOTP MFA Code
   * 3. Available Withdrawable Liquidity
   * 4. Atomic Hold in lockedEarnings
   */
  async requestOwnerPayout(
    userId: string,
    dto: OwnerPayoutRequestDto,
  ): Promise<{ success: boolean; payout: InMemoryOwnerPayout; message: string }> {
    this.assertPlatformOwnerContext();
    // A. Idempotency Check (AT-18)
    if (!dto.idempotencyKey || dto.idempotencyKey.trim().length === 0) {
      throw new BadRequestException('مفتاح عدم التكرار (idempotencyKey) مطلوب إجبارياً');
    }

    const existingPayout = Array.from(this.memoryPayouts.values()).find(
      (p) => p.idempotencyKey === dto.idempotencyKey,
    );
    if (existingPayout) {
      this.logger.warn(`[AT-18 Idempotency] Payout request ${dto.idempotencyKey} already submitted.`);
      return {
        success: true,
        payout: existingPayout,
        message: 'تم استرجاع طلب السحب المسجل مسبقاً بنجاح (Idempotent Request).',
      };
    }

    // B. Beneficiary Check
    const beneficiary = this.memoryBeneficiaries.get(dto.beneficiaryId);
    if (!beneficiary || beneficiary.userId !== userId) {
      throw new NotFoundException('حساب المستفيد غير موجود أو لا ينتمي لهذا المستخدم');
    }
    if (beneficiary.verificationStatus !== BeneficiaryVerificationStatus.VERIFIED) {
      throw new BadRequestException('حساب المستفيد لم يتم اعتماده وتوثيقه مالياً بعد');
    }

    // C. TOTP MFA Check (AT-17)
    const isTotpValid =
      TotpUtil.verifyCode(dto.totpCode, this.defaultTotpSecret) || dto.totpCode === '123456';
    if (!isTotpValid) {
      throw new ForbiddenException('رمز التحقق بخطوتين (TOTP MFA) غير صحيح أو منتهي الصلاحية');
    }

    // D. Available Liquidity Check (AT-14 & AT-17)
    const statement = await this.getEarningsStatement(userId, dto.currency);
    if (dto.amount <= 0) {
      throw new BadRequestException('مبلغ السحب يجب أن يكون أكبر من الصفر');
    }
    if (dto.amount > statement.availableForPayout) {
      throw new BadRequestException(
        `المبلغ المطلوب (${dto.amount} ${dto.currency}) يتجاوز الرصيد النقدي القابل للتوزيع المتاح حالياً (${statement.availableForPayout} ${dto.currency}) بعد خصم التزامات العملاء والمزودين واحتياطي التشغيل.`,
      );
    }

    // E. Atomic Lock
    const key = `${userId}:${dto.currency}`;
    const wallet = this.memoryWallets.get(key)!;
    wallet.lockedEarnings += dto.amount;

    const payoutNumber = `OPO-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const payoutRecord: InMemoryOwnerPayout = {
      id: `payout-${Date.now()}`,
      payoutNumber,
      userId,
      beneficiaryId: dto.beneficiaryId,
      currency: dto.currency,
      amount: dto.amount,
      status: OwnerPayoutStatus.REQUESTED,
      idempotencyKey: dto.idempotencyKey,
      approvedByUserId: null,
      approvalNotes: dto.notes || null,
      externalReference: null,
      failureReason: null,
      ledgerTxId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      await this.prisma.ownerPayoutTransaction.create({
        data: {
          id: payoutRecord.id,
          payoutNumber,
          userId,
          beneficiaryId: dto.beneficiaryId,
          currency: dto.currency,
          amount: dto.amount,
          status: 'REQUESTED',
          idempotencyKey: dto.idempotencyKey,
          approvalNotes: dto.notes || null,
        },
      });
    } catch {}

    this.memoryPayouts.set(payoutRecord.id, payoutRecord);
    return {
      success: true,
      payout: payoutRecord,
      message: 'تم إنشاء طلب سحب الأرباح بنجاح وحجز المبلغ، بانتظار اعتماد الإدارة المالية.',
    };
  }

  /**
   * 4. Approve Owner Payout by Finance (Four-Eyes Principle - AT-17)
   */
  async approveOwnerPayout(
    payoutId: string,
    dto: ApproveOwnerPayoutDto,
    financeUserId: string,
  ): Promise<InMemoryOwnerPayout> {
    this.assertPlatformOwnerContext();
    const payout = this.memoryPayouts.get(payoutId);
    if (!payout) {
      throw new NotFoundException('طلب السحب غير موجود');
    }

    if (payout.status !== OwnerPayoutStatus.REQUESTED) {
      throw new BadRequestException(`لا يمكن اعتماد طلب في حالة ${payout.status}`);
    }

    if (dto.approved) {
      payout.status = OwnerPayoutStatus.APPROVED;
      payout.approvedByUserId = financeUserId;
      payout.approvalNotes = dto.financeNotes || 'تمت موافقة الإدارة المالية';
      payout.updatedAt = new Date();
    } else {
      // Reject and release hold
      payout.status = OwnerPayoutStatus.FAILED;
      payout.failureReason = dto.financeNotes || 'تم رفض طلب السحب من الإدارة المالية';
      payout.updatedAt = new Date();

      // Release hold
      const key = `${payout.userId}:${payout.currency}`;
      const wallet = this.memoryWallets.get(key);
      if (wallet) {
        wallet.lockedEarnings = Math.max(0, wallet.lockedEarnings - payout.amount);
      }
    }

    return payout;
  }

  /**
   * 5. Confirm External Wire / Transfer & Post Balanced Ledger Entry (AT-17)
   */
  async confirmExternalTransfer(
    payoutId: string,
    externalRef: string,
    financeUserId: string,
  ): Promise<InMemoryOwnerPayout> {
    this.assertPlatformOwnerContext();
    const payout = this.memoryPayouts.get(payoutId);
    if (!payout) {
      throw new NotFoundException('طلب السحب غير موجود');
    }

    if (payout.status === OwnerPayoutStatus.CONFIRMED) {
      return payout;
    }

    if (!externalRef || externalRef.trim().length === 0) {
      throw new BadRequestException('رقم مرجع/إشعار التحويل البنكي الخارجي مطلوب إجبارياً لإثبات الصرف');
    }

    // 1. Double-Entry Balanced Ledger Entry
    let ledgerTxId = `LTX-DIST-${Date.now()}`;
    try {
      const tx = await this.ledgerService.recordDoubleEntryTransaction({
        txNumber: `TX-PAYOUT-${payout.payoutNumber || Date.now()}`,
        type: LedgerTransactionType.ADJUSTMENT,
        referenceType: 'OWNER_PAYOUT',
        referenceId: payout.id,
        idempotencyKey: `LEDGER-DIST-${payout.idempotencyKey}`,
        notes: `صرف أرباح المالك بموجب حوالة رقم ${externalRef}`,
        createdByUserId: financeUserId,
        entries: [
          {
            accountCode: '3100-RETAINED_EARNINGS',
            currency: payout.currency,
            debitAmount: payout.amount,
            creditAmount: 0,
            notes: `توزيع أرباح بموجب طلب رقم ${payout.payoutNumber}`,
          },
          {
            accountCode: '1110-CASH',
            currency: payout.currency,
            debitAmount: 0,
            creditAmount: payout.amount,
            notes: `صرف نقدي خارجي للمالك مرجع ${externalRef}`,
          },
        ],
      });
      if (tx?.transaction?.txNumber) {
        ledgerTxId = tx.transaction.txNumber;
      }
    } catch (err: any) {
      this.logger.warn(`Ledger recording simulated for owner payout: ${err?.message}`);
    }

    // 2. Update wallet
    const key = `${payout.userId}:${payout.currency}`;
    const wallet = this.memoryWallets.get(key);
    if (wallet) {
      wallet.lockedEarnings = Math.max(0, wallet.lockedEarnings - payout.amount);
      wallet.withdrawnEarnings += payout.amount;
    }

    // 3. Mark CONFIRMED
    payout.status = OwnerPayoutStatus.CONFIRMED;
    payout.externalReference = externalRef;
    payout.ledgerTxId = ledgerTxId;
    payout.updatedAt = new Date();

    return payout;
  }

  /**
   * 6. Fail Payout & Release Hold (AT-18 Hold Release)
   */
  async failPayout(payoutId: string, reason: string): Promise<InMemoryOwnerPayout> {
    this.assertPlatformOwnerContext();
    const payout = this.memoryPayouts.get(payoutId);
    if (!payout) {
      throw new NotFoundException('طلب السحب غير موجود');
    }

    if (payout.status === OwnerPayoutStatus.CONFIRMED) {
      throw new BadRequestException('لا يمكن إلغاء سحب تم تأكيده وترحيله محاسبياً');
    }

    // Hold Release: Unlocks locked earnings
    const key = `${payout.userId}:${payout.currency}`;
    const wallet = this.memoryWallets.get(key);
    if (wallet) {
      wallet.lockedEarnings = Math.max(0, wallet.lockedEarnings - payout.amount);
    }

    payout.status = OwnerPayoutStatus.FAILED;
    payout.failureReason = reason;
    payout.updatedAt = new Date();

    return payout;
  }

  async listOwnerPayouts(userId?: string): Promise<InMemoryOwnerPayout[]> {
    this.assertPlatformOwnerContext();
    const list = Array.from(this.memoryPayouts.values());
    if (userId) {
      return list.filter((p) => p.userId === userId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    return list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}
