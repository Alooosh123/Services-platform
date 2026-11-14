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
import { Prisma } from '@prisma/client';
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
  ) {
    // Seed initial memory wallets only for isolated non-production development/test environments.
    if (process.env.NODE_ENV === 'production') return;
    const custId = 'user-customer-003';
    this.memoryWallets.set(`w-cust-yer`, {
      id: `w-cust-yer`,
      userId: custId,
      currency: CurrencyCode.YER,
      balance: 50000.0,
      lockedBalance: 0.0,
      isFrozen: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    this.memoryWallets.set(`w-cust-usd`, {
      id: `w-cust-usd`,
      userId: custId,
      currency: CurrencyCode.USD,
      balance: 100.0,
      lockedBalance: 0.0,
      isFrozen: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    this.memoryWallets.set(`w-cust-sar`, {
      id: `w-cust-sar`,
      userId: custId,
      currency: CurrencyCode.SAR,
      balance: 200.0,
      lockedBalance: 0.0,
      isFrozen: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
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
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException('تعذر قراءة محافظ العميل من قاعدة البيانات الدائمة.');
      }
      this.logger.warn(`Prisma offline during getWalletsByUserId: using test/development memory wallets (${err?.message})`);

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
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException('تعذر قراءة المحفظة من قاعدة البيانات الدائمة.');
      }
      this.logger.warn(`Prisma offline during getWallet: using test/development memory wallet (${err?.message})`);

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
    if (process.env.NODE_ENV === 'production') {
      try {
        const updated = await this.prisma.$transaction(async (tx) => {
          const wallet = await tx.wallet.update({
            where: { id: walletId },
            data: {
              isFrozen: true,
              frozenReason: reason.trim(),
              frozenAt: new Date(),
              version: { increment: 1 },
            },
          });
          await tx.auditLog.create({
            data: {
              userId: staffUserId,
              action: 'WALLET_FROZEN',
              entityName: 'Wallet',
              entityId: walletId,
              newValues: { isFrozen: true, reason: reason.trim() },
            },
          });
          return wallet;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        return {
          success: true,
          message: 'تم تجميد المحفظة وتسجيل العملية في سجل التدقيق.',
          wallet: this.enrichWallet(updated),
        };
      } catch {
        throw new ServiceUnavailableException('تعذر تجميد المحفظة وتسجيل أثر التدقيق ذرياً في قاعدة البيانات.');
      }
    }

    try {
      const updated = await this.prisma.wallet.update({
        where: { id: walletId },
        data: { isFrozen: true, frozenReason: reason, frozenAt: new Date(), version: { increment: 1 } },
      });
      try {
        await this.prisma.auditLog.create({
          data: { userId: staffUserId, action: 'WALLET_FROZEN', entityName: 'Wallet', entityId: walletId, newValues: { isFrozen: true, reason } },
        });
      } catch {}
      return { success: true, message: 'تم تجميد المحفظة بنجاح وتوقيف العمليات الصادرة', wallet: this.enrichWallet(updated) };
    } catch (err: any) {
      const memWallet = this.memoryWallets.get(walletId);
      if (!memWallet) throw new NotFoundException(`المحفظة برقم ${walletId} غير موجودة`);
      memWallet.isFrozen = true;
      memWallet.frozenReason = reason;
      memWallet.frozenAt = new Date();
      memWallet.updatedAt = new Date();
      return { success: true, message: 'تم تجميد المحفظة بنجاح وتوقيف العمليات الصادرة', wallet: this.enrichWallet(memWallet) };
    }
  }

  async unfreezeWallet(staffUserId: string, walletId: string) {
    if (process.env.NODE_ENV === 'production') {
      try {
        const updated = await this.prisma.$transaction(async (tx) => {
          const wallet = await tx.wallet.update({
            where: { id: walletId },
            data: {
              isFrozen: false,
              frozenReason: null,
              frozenAt: null,
              version: { increment: 1 },
            },
          });
          await tx.auditLog.create({
            data: {
              userId: staffUserId,
              action: 'WALLET_UNFROZEN',
              entityName: 'Wallet',
              entityId: walletId,
              newValues: { isFrozen: false },
            },
          });
          return wallet;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        return {
          success: true,
          message: 'تم إلغاء تجميد المحفظة وتسجيل العملية في سجل التدقيق.',
          wallet: this.enrichWallet(updated),
        };
      } catch {
        throw new ServiceUnavailableException('تعذر إلغاء تجميد المحفظة وتسجيل أثر التدقيق ذرياً في قاعدة البيانات.');
      }
    }

    try {
      const updated = await this.prisma.wallet.update({
        where: { id: walletId },
        data: { isFrozen: false, frozenReason: null, frozenAt: null, version: { increment: 1 } },
      });
      try {
        await this.prisma.auditLog.create({
          data: { userId: staffUserId, action: 'WALLET_UNFROZEN', entityName: 'Wallet', entityId: walletId, newValues: { isFrozen: false } },
        });
      } catch {}
      return { success: true, message: 'تم إلغاء تجميد المحفظة واستئناف العمليات بنجاح', wallet: this.enrichWallet(updated) };
    } catch {
      const memWallet = this.memoryWallets.get(walletId);
      if (!memWallet) throw new NotFoundException(`المحفظة برقم ${walletId} غير موجودة`);
      memWallet.isFrozen = false;
      memWallet.frozenReason = null;
      memWallet.frozenAt = null;
      memWallet.updatedAt = new Date();
      return { success: true, message: 'تم إلغاء تجميد المحفظة واستئناف العمليات بنجاح', wallet: this.enrichWallet(memWallet) };
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
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException('تعذر حفظ طلب الإيداع في قاعدة البيانات الدائمة؛ لم يتم تسجيل الطلب.');
      }
      this.logger.warn(`Prisma offline during requestTopup: simulated response (${err?.message})`);

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
    if (process.env.NODE_ENV === 'production') {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const topup = await tx.walletTopup.findUnique({
            where: { id: topupId },
            include: { paymentMethod: true, wallet: true },
          });
          if (!topup) throw new NotFoundException(`طلب الإيداع ${topupId} غير موجود`);
          if (topup.status === PaymentStatus.Confirmed) {
            throw new ConflictException(`طلب الإيداع ${topupId} مؤكد مسبقاً.`);
          }
          if (topup.status !== PaymentStatus.AwaitingVerification) {
            throw new ConflictException('حالة طلب الإيداع لا تسمح بالتأكيد المالي.');
          }

          const ledgerResult = await this.ledgerService.recordTopup({
            userId: topup.userId,
            walletId: topup.walletId,
            currency: topup.currency as CurrencyCode,
            amount: Number(topup.amount),
            paymentChannel: topup.paymentMethod.code as PaymentChannelCode,
            referenceId: topup.id,
            performedByUserId: staffUserId,
            notes: `Admin confirmed manual topup ref: ${topup.referenceNumber}`,
          }, tx);

          const changed = await tx.walletTopup.updateMany({
            where: { id: topupId, status: PaymentStatus.AwaitingVerification },
            data: { status: PaymentStatus.Confirmed, confirmedAt: new Date() },
          });
          if (changed.count !== 1) {
            throw new ConflictException('تمت معالجة طلب الإيداع بواسطة موظف آخر؛ تم التراجع عن القيد.');
          }
          const updatedTopup = await tx.walletTopup.findUnique({ where: { id: topupId } });
          return {
            message: 'تم تأكيد الإيداع وقيد المبلغ في المحفظة عبر دفتر الأستاذ العام.',
            topup: updatedTopup,
            ledgerTransaction: ledgerResult.transaction,
          };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (error instanceof NotFoundException || error instanceof ConflictException) throw error;
        throw new ServiceUnavailableException('تعذر تأكيد الإيداع وقيد الأستاذ ذرياً في قاعدة البيانات الدائمة.');
      }
    }

    try {
      const topup = await this.prisma.walletTopup.findUnique({
        where: { id: topupId },
        include: { paymentMethod: true, wallet: true },
      });
      if (!topup) throw new NotFoundException(`طلب الإيداع ${topupId} غير موجود`);
      if (topup.status === PaymentStatus.Confirmed) throw new ConflictException(`طلب الإيداع ${topupId} مؤكد مسبقاً.`);

      const ledgerResult = await this.ledgerService.recordTopup({
        userId: topup.userId,
        walletId: topup.walletId,
        currency: topup.currency as CurrencyCode,
        amount: Number(topup.amount),
        paymentChannel: topup.paymentMethod.code as PaymentChannelCode,
        referenceId: topup.id,
        performedByUserId: staffUserId,
        notes: `Admin confirmed manual topup ref: ${topup.referenceNumber}`,
      });

      const updatedTopup = await this.prisma.walletTopup.update({
        where: { id: topupId },
        data: { status: PaymentStatus.Confirmed, confirmedAt: new Date() },
      });

      return {
        message: 'تم تأكيد الإيداع وقيد المبلغ في المحفظة عبر دفتر الأستاذ العام.',
        topup: updatedTopup,
        ledgerTransaction: ledgerResult.transaction,
      };
    } catch (err: any) {
      if (err instanceof NotFoundException || err instanceof ConflictException) throw err;
      return {
        message: 'تعذر تأكيد الإيداع في وضع الاختبار/التطوير.',
        topup: { id: topupId, status: PaymentStatus.AwaitingVerification },
      };
    }
  }

  async depositFunds(userId: string, dto: DepositFundsDto) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException(
        'الإيداع المباشر التجريبي محظور نهائياً في بيئة الإنتاج. يجب تمرير كافة عمليات الشحن عبر القنوات البنكية المعتمدة والتأكيد المالي.',
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
      this.logger.warn(`Ledger recording offline: updating memory wallet directly (${err?.message})`);

      const memWallet = this.memoryWallets.get(wallet.id);
      if (memWallet) {
        memWallet.balance += dto.amount;
        memWallet.updatedAt = new Date();
      }

      return {
        message: 'تم إيداع الرصيد بنجاح',
        referenceId: depositRefId,
        currency,
        wallet: memWallet || wallet,
      };
    }
  }
}
