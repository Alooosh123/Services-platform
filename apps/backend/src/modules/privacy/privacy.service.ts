import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  CurrencyCode,
  OrderStatus,
  UserDataExportDto,
  AccountDeletionResultDto,
  PurgeTokensResultDto,
  PrivacyActionType,
} from '@digital-topup/shared';
import { AccountDeletionRequestDto } from './dto/privacy.dto';

@Injectable()
export class PrivacyService {
  private readonly logger = new Logger(PrivacyService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * AR-08: Export complete personal data archive for the authenticated user (Right to Data Portability)
   */
  async exportUserData(userId: string): Promise<UserDataExportDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('المستخدم غير موجود');
    }

    const [wallets, orders, deposits, payouts] = await Promise.all([
      this.prisma.wallet.findMany({ where: { userId } }),
      this.prisma.order.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 100 }),
      this.prisma.depositRequest.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 100 }),
      this.prisma.payoutRequest.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 100 }),
    ]);

    let supportTickets: any[] = [];
    try {
      supportTickets = await (this.prisma as any).supportTicket.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    } catch {}

    let consents: any[] = [];
    try {
      consents = await (this.prisma as any).consentGrant.findMany({
        where: { userId },
      });
    } catch {}

    // Audit log the export
    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          userRole: user.role,
          action: PrivacyActionType.DATA_EXPORT,
          entityName: 'User',
          entityId: userId,
          details: { exportedAt: new Date().toISOString() },
        } as any,
      });
    } catch {}

    return {
      exportDate: new Date().toISOString(),
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isVerified: user.isVerified,
        createdAt: user.createdAt.toISOString(),
      },
      wallets: wallets.map((w) => ({
        id: w.id,
        currency: w.currency as CurrencyCode,
        balance: Number(w.balance),
        lockedBalance: Number(w.lockedBalance),
        isFrozen: w.isFrozen,
        frozenReason: w.frozenReason,
      })),
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        serviceName: o.snapshotServiceName,
        productName: o.snapshotProductName,
        retailPrice: Number(o.snapshotRetailPrice),
        currency: o.snapshotCurrency,
        createdAt: o.createdAt.toISOString(),
      })),
      deposits: deposits.map((d) => ({
        id: d.id,
        depositNumber: d.depositNumber,
        amount: Number(d.amount),
        currency: d.currency,
        status: d.status,
        createdAt: d.createdAt.toISOString(),
      })),
      payouts: payouts.map((p) => ({
        id: p.id,
        payoutNumber: p.payoutNumber,
        amount: Number(p.amount),
        currency: p.currency,
        status: p.status,
        destinationAccount: p.destinationAccount,
        createdAt: p.createdAt.toISOString(),
      })),
      supportTickets: supportTickets.map((t) => ({
        id: t.id,
        ticketNumber: t.ticketNumber,
        subject: t.subject,
        status: t.status,
        category: t.category,
        createdAt: t.createdAt.toISOString(),
      })),
      consents: consents.map((c) => ({
        id: c.id,
        serviceSlug: c.serviceSlug,
        scopes: c.scopes,
        status: c.status,
        grantedAt: c.grantedAt?.toISOString(),
      })),
    };
  }

  /**
   * AR-08: Right to be Forgotten / Account Deletion & Anonymization
   * Strictly preserves double-entry financial ledger and order records for legal compliance,
   * while completely anonymizing all Personally Identifiable Information (PII).
   */
  async requestAccountDeletion(
    userId: string,
    dto: AccountDeletionRequestDto,
  ): Promise<AccountDeletionResultDto> {
    if (dto.confirmPhrase !== 'CONFIRM_DELETE') {
      throw new BadRequestException('يجب إدخال عبارة التأكيد "CONFIRM_DELETE" بدقة لإتمام طلب الحذف');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('المستخدم غير موجود');
    }

    const [wallets, orders] = await Promise.all([
      this.prisma.wallet.findMany({ where: { userId } }),
      this.prisma.order.findMany({ where: { userId } }),
    ]);

    // 1. Guard against outstanding wallet balance
    const totalBalance = wallets.reduce(
      (sum, w) => sum + Number(w.balance) + Number(w.lockedBalance),
      0,
    );
    if (totalBalance > 0) {
      throw new BadRequestException(
        'لا يمكن حذف الحساب نظراً لوجود رصيد متبقي في المحفظة. يرجى سحب كامل رصيدك قبل تقديم طلب الحذف.',
      );
    }

    // 2. Guard against active in-flight orders
    const activeStatuses: OrderStatus[] = [
      OrderStatus.AwaitingPayment,
      OrderStatus.PaymentReview,
      OrderStatus.Queued,
      OrderStatus.Processing,
      OrderStatus.ManualReview,
      OrderStatus.RefundPending,
    ];
    const hasActiveOrders = orders.some((o) => activeStatuses.includes(o.status as OrderStatus));
    if (hasActiveOrders) {
      throw new BadRequestException(
        'لا يمكن حذف الحساب نظراً لوجود طلبات شحن جارية قيد التنفيذ أو المراجعة.',
      );
    }

    // 3. Count ledger records preserved
    let preservedCount = 0;
    try {
      preservedCount = await this.prisma.ledgerEntry.count({
        where: { wallet: { userId } },
      });
    } catch {}

    // 4. Anonymize user PII (Right to Erasure)
    const anonymizedName = 'مستخدم محذوف (Deleted User)';
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        fullName: anonymizedName,
        email: null,
        phone: null,
        passwordHash: 'DELETED_ANONYMIZED_SECRET',
        avatarUrl: null,
        isVerified: false,
        isActive: false,
        isTwoFactorEnabled: false,
        twoFactorSecret: null,
        resetPasswordToken: null,
        resetPasswordExpires: null,
        verificationCode: null,
      },
    });

    // 5. Invalidate all active sessions
    try {
      await this.prisma.session.deleteMany({
        where: { userId },
      });
    } catch {}

    // 6. Audit log the anonymization
    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          userRole: user.role,
          action: PrivacyActionType.ANONYMIZATION_COMPLETED,
          entityName: 'User',
          entityId: userId,
          newValues: {
            reason: dto.reason || 'Requested by customer',
            anonymizedAt: new Date().toISOString(),
            ledgerPreserved: preservedCount,
          },
        } as any,
      });
    } catch {}

    return {
      success: true,
      message: 'تم تعمية وحذف بياناتك الشخصية بنجاح مع الحفاظ على سلامة القيود المحاسبية القانونية.',
      anonymizedUserId: userId,
      preservedLedgerRecordsCount: preservedCount,
    };
  }

  /**
   * Data Retention: Purge expired sessions and temporary tokens
   */
  async purgeExpiredTokens(): Promise<PurgeTokensResultDto> {
    const now = new Date();

    let purgedSessionsCount = 0;
    let purgedTokensCount = 0;

    try {
      const sessionResult = await this.prisma.session.deleteMany({
        where: { expiresAt: { lt: now } },
      });
      purgedSessionsCount = sessionResult.count;
    } catch (err: any) {
      this.logger.warn(`Could not purge sessions: ${err?.message}`);
    }

    try {
      // Clear expired password reset tokens on users
      const userTokensResult = await this.prisma.user.updateMany({
        where: {
          resetPasswordExpires: { lt: now },
          resetPasswordToken: { not: null },
        },
        data: {
          resetPasswordToken: null,
          resetPasswordExpires: null,
        },
      });
      purgedTokensCount = userTokensResult.count;
    } catch (err: any) {
      this.logger.warn(`Could not purge reset tokens: ${err?.message}`);
    }

    this.logger.log(
      `[PurgeExpiredTokens] Successfully purged ${purgedSessionsCount} expired sessions and ${purgedTokensCount} reset tokens.`,
    );

    return {
      purgedSessionsCount,
      purgedTokensCount,
      timestamp: now.toISOString(),
    };
  }
}
