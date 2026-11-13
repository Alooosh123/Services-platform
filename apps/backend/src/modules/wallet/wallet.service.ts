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
import { getCurrentTenantId } from '../../tenant/tenant-context.store';
import { LedgerService } from '../ledger/ledger.service';
import { CurrencyCode, PaymentChannelCode, PaymentStatus } from '@digital-topup/shared';
import { DepositFundsDto } from '../ledger/dto/ledger-adjustment.dto';

interface InMemoryWallet {
  id: string;
  userId: string;
  currency: CurrencyCode;
  balance: number;
  lockedBalance: number;
  isFrozen: boolean;
  frozenReason?: string | null;
  frozenAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);
  private memoryWallets: Map<string, InMemoryWallet> = new Map();

  constructor(
    private prisma: PrismaService,
    private ledgerService: LedgerService,
  ) {}

  private assertMemoryFallbackAllowed(operation: string, error?: unknown): void {
    if (process.env.NODE_ENV === 'production' || getCurrentTenantId()) {
      this.logger.error(`Refusing in-memory wallet fallback for ${operation}: ${String(error || 'database unavailable')}`);
      throw new ServiceUnavailableException(
        `${operation} غير متاح لأن قاعدة البيانات الدائمة غير متصلة؛ لم يتم عرض أو تعديل أرصدة مؤقتة.`,
      );
    }
  }

  private assertLegacyTopupDisabled(operation: string): void {
    if (process.env.NODE_ENV === 'test') return;
    if (
      process.env.NODE_ENV === 'production' ||
      getCurrentTenantId() ||
      process.env.ENABLE_LEGACY_WALLET_TOPUP !== 'true'
    ) {
      throw new ForbiddenException(
        `${operation} القديم معطل. استخدم مسار الإيداع المعتمد /deposits الذي يتطلب تحققاً مالياً وقيداً مزدوجاً.`,
      );
    }
  }


  private enrichWallet(wallet: any) {
    const balance = Number(wallet.balance || 0);
    const lockedBalance = Number(wallet.lockedBalance || 0);
    const availableBalance = Math.max(0, balance - lockedBalance);

    return {
      ...wallet,
      balance,
      lockedBalance,
      availableBalance,
      isFrozen: Boolean(wallet.isFrozen),
      frozenReason: wallet.frozenReason || null,
      frozenAt: wallet.frozenAt || null,
    };
  }

  /**
   * Retrieves all wallets for a user (YER, USD, SAR), auto-creating any missing ones.
   */
  async getWalletsByUserId(userId: string) {
    const requiredCurrencies = [CurrencyCode.YER, CurrencyCode.USD, CurrencyCode.SAR];

    try {
      let wallets = await this.prisma.wallet.findMany({
        where: { userId },
      });

      const existingCodes = new Set(wallets.map((w) => w.currency));
      for (const cur of requiredCurrencies) {
        if (!existingCodes.has(cur)) {
          const created = await this.prisma.wallet.upsert({
            where: { userId_currency: { userId, currency: cur } },
            create: {
              userId,
              currency: cur,
              balance: 0,
              lockedBalance: 0,
              isFrozen: false,
            },
            update: {},
          });
          wallets.push(created);
        }
      }

      return wallets.map((w) => this.enrichWallet(w));
    } catch (err: any) {
      this.assertMemoryFallbackAllowed('قراءة محافظ العميل', err);
      this.logger.warn(`Development-only wallet read fallback: ${err?.message}`);

      const userWallets: InMemoryWallet[] = [];
      for (const w of this.memoryWallets.values()) {
        if (w.userId === userId) {
          userWallets.push(w);
        }
      }

      const existingCodes = new Set(userWallets.map((w) => w.currency));
      for (const cur of requiredCurrencies) {
        if (!existingCodes.has(cur)) {
          const newWallet: InMemoryWallet = {
            id: `w-${userId}-${cur.toLowerCase()}`,
            userId,
            currency: cur,
            balance: 0,
            lockedBalance: 0,
            isFrozen: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          this.memoryWallets.set(newWallet.id, newWallet);
          userWallets.push(newWallet);
        }
      }

      return userWallets.map((w) => this.enrichWallet(w));
    }
  }

  /**
   * Retrieves a specific single-currency wallet for a user.
   */
  async getWalletTransactions(
    userId: string,
    currency?: CurrencyCode,
    page = 1,
    limit = 20,
  ) {
    const safePage = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
    const safeLimit = Number.isFinite(limit) ? Math.min(100, Math.max(1, Math.floor(limit))) : 20;
    if (currency && ![CurrencyCode.YER, CurrencyCode.USD, CurrencyCode.SAR].includes(currency)) {
      throw new BadRequestException('عملة المحفظة غير مدعومة.');
    }

    // Resolve wallet IDs first so the query can never return another customer's ledger entries.
    const wallets = await this.prisma.wallet.findMany({
      where: { userId, ...(currency ? { currency } : {}) },
      select: { id: true, currency: true },
    });
    const walletIds = wallets.map((wallet) => wallet.id);
    if (!walletIds.length) {
      return { items: [], page: safePage, limit: safeLimit, total: 0, pages: 0 };
    }

    const where = {
      walletId: { in: walletIds },
      transaction: { status: { in: ['POSTED', 'REVERSED'] } },
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.ledgerEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
        include: {
          transaction: {
            select: {
              id: true,
              txNumber: true,
              status: true,
              referenceType: true,
              referenceId: true,
              notes: true,
              postedAt: true,
              isReversal: true,
            },
          },
        },
      }),
      this.prisma.ledgerEntry.count({ where }),
    ]);

    return {
      items: rows.map((row) => {
        const debit = Number(row.debitAmount);
        const credit = Number(row.creditAmount);
        const wallet = wallets.find((candidate) => candidate.id === row.walletId);
        return {
          id: row.id,
          transactionId: row.transaction.id,
          transactionNumber: row.transaction.txNumber,
          direction: credit > 0 ? 'CREDIT' : 'DEBIT',
          amount: credit > 0 ? credit : debit,
          currency: row.currency,
          referenceType: row.transaction.referenceType,
          referenceId: row.transaction.referenceId,
          description: row.notes || row.transaction.notes || null,
          status: row.transaction.status,
          isReversal: row.transaction.isReversal,
          postedAt: row.transaction.postedAt,
          createdAt: row.createdAt,
          walletCurrency: wallet?.currency || row.currency,
        };
      }),
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit),
    };
  }


  async getWallet(userId: string, currency: CurrencyCode) {
    try {
      let wallet = await this.prisma.wallet.findUnique({
        where: {
          userId_currency: {
            userId,
            currency,
          },
        },
      });

      if (!wallet) {
        wallet = await this.prisma.wallet.upsert({
          where: { userId_currency: { userId, currency } },
          create: {
            userId,
            currency,
            balance: 0,
            lockedBalance: 0,
            isFrozen: false,
          },
          update: {},
        });
      }

      return this.enrichWallet(wallet);
    } catch (err: any) {
      this.assertMemoryFallbackAllowed('قراءة محفظة العميل', err);
      this.logger.warn(`Development-only single-wallet fallback: ${err?.message}`);

      for (const w of this.memoryWallets.values()) {
        if (w.userId === userId && w.currency === currency) {
          return this.enrichWallet(w);
        }
      }

      const newWallet: InMemoryWallet = {
        id: `w-${userId}-${currency.toLowerCase()}`,
        userId,
        currency,
        balance: 0,
        lockedBalance: 0,
        isFrozen: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.memoryWallets.set(newWallet.id, newWallet);
      return this.enrichWallet(newWallet);
    }
  }

  /**
   * Admin: Freeze a customer wallet
   */
  async freezeWallet(staffUserId: string, walletId: string, reason: string) {
    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException('سبب التجميد مطلوب إجبارياً');
    }

    try {
      const updated = await this.prisma.wallet.update({
        where: { id: walletId },
        data: {
          isFrozen: true,
          frozenReason: reason,
          frozenAt: new Date(),
          version: { increment: 1 },
        },
      });

      // Audit log
      try {
        await this.prisma.auditLog.create({
          data: {
            userId: staffUserId,
            action: 'WALLET_FROZEN',
            entityName: 'Wallet',
            entityId: walletId,
            newValues: { isFrozen: true, reason },
          },
        });
      } catch {}

      return {
        success: true,
        message: 'تم تجميد المحفظة بنجاح وتوقيف العمليات الصادرة',
        wallet: this.enrichWallet(updated),
      };
    } catch (err: any) {
      this.assertMemoryFallbackAllowed('تجميد المحفظة', err);
      this.logger.warn(`Development-only wallet freeze fallback: ${err?.message}`);

      const memWallet = this.memoryWallets.get(walletId);
      if (!memWallet) {
        throw new NotFoundException(`المحفظة برقم ${walletId} غير موجودة`);
      }

      memWallet.isFrozen = true;
      memWallet.frozenReason = reason;
      memWallet.frozenAt = new Date();
      memWallet.updatedAt = new Date();

      return {
        success: true,
        message: 'تم تجميد المحفظة بنجاح وتوقيف العمليات الصادرة',
        wallet: this.enrichWallet(memWallet),
      };
    }
  }

  /**
   * Admin: Unfreeze a customer wallet
   */
  async unfreezeWallet(staffUserId: string, walletId: string) {
    try {
      const updated = await this.prisma.wallet.update({
        where: { id: walletId },
        data: {
          isFrozen: false,
          frozenReason: null,
          frozenAt: null,
          version: { increment: 1 },
        },
      });

      // Audit log
      try {
        await this.prisma.auditLog.create({
          data: {
            userId: staffUserId,
            action: 'WALLET_UNFROZEN',
            entityName: 'Wallet',
            entityId: walletId,
            newValues: { isFrozen: false },
          },
        });
      } catch {}

      return {
        success: true,
        message: 'تم إلغاء تجميد المحفظة واستئناف العمليات بنجاح',
        wallet: this.enrichWallet(updated),
      };
    } catch (err: any) {
      this.assertMemoryFallbackAllowed('إلغاء تجميد المحفظة', err);
      this.logger.warn(`Development-only wallet unfreeze fallback: ${err?.message}`);

      const memWallet = this.memoryWallets.get(walletId);
      if (!memWallet) {
        throw new NotFoundException(`المحفظة برقم ${walletId} غير موجودة`);
      }

      memWallet.isFrozen = false;
      memWallet.frozenReason = null;
      memWallet.frozenAt = null;
      memWallet.updatedAt = new Date();

      return {
        success: true,
        message: 'تم إلغاء تجميد المحفظة واستئناف العمليات بنجاح',
        wallet: this.enrichWallet(memWallet),
      };
    }
  }

  /**
   * Admin: Get all wallets for a specific customer
   */
  async getWalletsForAdmin(customerId: string) {
    return this.getWalletsByUserId(customerId);
  }

  /**
   * Customer initiates a legacy wallet topup
   */
  async requestTopup(
    userId: string,
    dto: {
      currency: CurrencyCode;
      amount: number;
      paymentMethodCode: PaymentChannelCode;
      referenceNumber: string;
      proofImage?: string;
    },
  ) {
    this.assertLegacyTopupDisabled('إنشاء طلب الإيداع القديم');
    const wallet = await this.getWallet(userId, dto.currency);

    try {
      const paymentMethod = await this.prisma.paymentMethod.findUnique({
        where: { code: dto.paymentMethodCode },
      });

      if (!paymentMethod || !paymentMethod.isActive) {
        throw new BadRequestException(`طريقة الدفع ${dto.paymentMethodCode} غير متوفرة`);
      }

      const existing = await this.prisma.walletTopup.findUnique({
        where: {
          paymentMethodId_referenceNumber: {
            paymentMethodId: paymentMethod.id,
            referenceNumber: dto.referenceNumber,
          },
        },
      });
      if (existing) {
        throw new ConflictException(`رقم الحوالة المرجعي "${dto.referenceNumber}" مسجل مسبقاً.`);
      }

      const topup = await this.prisma.walletTopup.create({
        data: {
          userId,
          walletId: wallet.id,
          currency: dto.currency,
          amount: dto.amount,
          paymentMethodId: paymentMethod.id,
          referenceNumber: dto.referenceNumber,
          proofImage: dto.proofImage || null,
          status: PaymentStatus.AwaitingVerification,
        },
        include: { paymentMethod: true },
      });

      return {
        message: 'تم تقديم طلب الإيداع بنجاح وهو قيد المراجعة المالية.',
        topup,
      };
    } catch (err: any) {
      if (err instanceof ConflictException || err instanceof BadRequestException) {
        throw err;
      }
      const uniqueTarget = err?.meta?.target;
      if (
        err?.code === 'P2002' &&
        Array.isArray(uniqueTarget) &&
        uniqueTarget.includes('paymentMethodId') &&
        uniqueTarget.includes('referenceNumber')
      ) {
        throw new ConflictException(`رقم الحوالة المرجعي "${dto.referenceNumber}" مسجل مسبقاً لهذه الطريقة.`);
      }
      this.assertMemoryFallbackAllowed('إنشاء طلب الإيداع القديم', err);
      this.logger.warn(`Development-only legacy topup fallback: ${err?.message}`);

      return {
        message: 'تم تقديم طلب الإيداع بنجاح وهو قيد المراجعة المالية.',
        topup: {
          id: `topup-${Date.now()}`,
          userId,
          walletId: wallet.id,
          currency: dto.currency,
          amount: dto.amount,
          referenceNumber: dto.referenceNumber,
          status: PaymentStatus.AwaitingVerification,
          createdAt: new Date(),
        },
      };
    }
  }

  /**
   * Finance / Admin confirms topup and credits customer wallet via Double-Entry Ledger.
   */
  async confirmTopup(staffUserId: string, topupId: string) {
    this.assertLegacyTopupDisabled('تأكيد الإيداع القديم');
    try {
      const topup = await this.prisma.walletTopup.findUnique({
        where: { id: topupId },
        include: { paymentMethod: true, wallet: true },
      });

      if (!topup) {
        throw new NotFoundException(`طلب الإيداع ${topupId} غير موجود`);
      }

      if (topup.status === PaymentStatus.Confirmed) {
        throw new ConflictException(`طلب الإيداع ${topupId} مؤكد مسبقاً.`);
      }

      // Post Double-Entry Ledger Transaction
      const ledgerResult = await this.ledgerService.recordTopup({
        userId: topup.userId,
        walletId: topup.walletId,
        currency: topup.currency as CurrencyCode,
        amount: topup.amount.toString(),
        paymentChannel: topup.paymentMethod.code as PaymentChannelCode,
        referenceId: topup.id,
        performedByUserId: staffUserId,
        notes: `Admin confirmed manual topup ref: ${topup.referenceNumber}`,
      });

      const updatedTopup = await this.prisma.walletTopup.update({
        where: { id: topupId },
        data: {
          status: PaymentStatus.Confirmed,
          confirmedAt: new Date(),
        },
      });

      return {
        message: 'تم تأكيد الإيداع وقيد المبلغ في المحفظة عبر دفتر الأستاذ العام.',
        topup: updatedTopup,
        ledgerTransaction: ledgerResult.transaction,
      };
    } catch (err: any) {
      if (err instanceof NotFoundException || err instanceof ConflictException) {
        throw err;
      }
      this.assertMemoryFallbackAllowed('تأكيد الإيداع القديم', err);
      this.logger.error(`Legacy topup confirmation failed: ${err?.message || err}`);
      throw new ServiceUnavailableException('تعذر التحقق من الإيداع وقيده؛ لم يتم تأكيده.');

      return {
        message: 'تم تأكيد الإيداع وقيد المبلغ في المحفظة عبر دفتر الأستاذ العام.',
        topup: {
          id: topupId,
          status: PaymentStatus.Confirmed,
          confirmedAt: new Date(),
        },
      };
    }
  }

  /**
   * Instant dev / test balance deposit.
   */
  async depositFunds(userId: string, dto: DepositFundsDto) {
    if (
      process.env.NODE_ENV === 'production' ||
      !!getCurrentTenantId() ||
      process.env.ENABLE_DEV_WALLET_DEPOSIT !== 'true'
    ) {
      throw new ForbiddenException(
        'الإيداع التجريبي المباشر معطل افتراضياً. لا يمكن استخدامه إلا في بيئة تطوير محلية غير مستأجرة وبعد تفعيل ENABLE_DEV_WALLET_DEPOSIT صراحةً.',
      );
    }

    const currency = dto.currency || CurrencyCode.USD;
    const wallet = await this.getWallet(userId, currency);
    const depositRefId = `DEP-${Date.now()}`;

    try {
      const ledgerResult = await this.ledgerService.recordTopup({
        userId,
        walletId: wallet.id,
        currency,
        amount: dto.amount,
        paymentChannel: PaymentChannelCode.WALLET,
        referenceId: depositRefId,
        notes: 'Customer direct test wallet deposit',
      });

      return {
        message: 'تم إيداع الرصيد بنجاح',
        referenceId: depositRefId,
        currency,
        ledgerTransaction: ledgerResult.transaction,
      };
    } catch (err: any) {
      this.logger.error(`Test deposit ledger write failed: ${err?.message || err}`);
      throw new ServiceUnavailableException('تعذر إنشاء قيد دفتر الأستاذ؛ لم يتم تعديل الرصيد.');
    }
  }
}
