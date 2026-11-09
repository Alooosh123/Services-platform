import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../database/prisma.service';
import { getCurrentTenantId } from '../../tenant/tenant-context.store';
import {
  ServiceAccountStatus,
  AccountReviewStatus,
  RiskLevel,
  AiRecommendation,
} from '@digital-topup/shared';
import { ServiceCapabilitiesConfig } from './capabilities/service-capabilities.config';
import { AiRiskEvaluatorService, AiEvaluationReport } from './engine/ai-risk-evaluator.service';
import { CreateServiceAccountDto } from './dto/create-service-account.dto';
import { ResolveReviewDto } from './dto/resolve-review.dto';

const TENANT_SCOPE = () => getCurrentTenantId() || null;

@Injectable()
export class ServiceAccountsService {
  constructor(
    private prisma: PrismaService,
    private aiEvaluator: AiRiskEvaluatorService,
  ) {}

  getCapabilities() {
    return ServiceCapabilitiesConfig.getAllCapabilities();
  }

  async linkAccount(
    userId: string,
    dto: CreateServiceAccountDto,
    ipAddress?: string,
    userAgent?: string,
  ) {
    if (dto.consentGranted !== true) throw new BadRequestException('الموافقة الصريحة مطلوبة لحفظ معرف الحساب.');
    const capability = ServiceCapabilitiesConfig.getCapability(dto.serviceSlug);
    if (capability.integrationStatus === 'BLOCKED_EXTERNAL' ||
        capability.defaultStatus === ServiceAccountStatus.UNSUPPORTED) {
      throw new BadRequestException(capability.blockedReasonAr || 'هذه الخدمة لا تدعم ربط الحساب حالياً.');
    }

    const tenantId = TENANT_SCOPE();
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { id: true, phoneVerifiedAt: true, createdAt: true },
    });
    if (!user) throw new NotFoundException('حساب العميل غير موجود في هذا المتجر.');

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [completedOrdersCount, recentLinkAttempts, revocations] = await Promise.all([
      this.prisma.order.count({ where: { userId, status: 'Completed' } }),
      this.prisma.linkedServiceAccount.count({ where: { userId, tenantId, createdAt: { gte: since } } }),
      this.prisma.linkedServiceAccount.count({ where: { userId, tenantId, status: ServiceAccountStatus.REVOKED } }),
    ]);
    const accountAgeDays = Math.max(0, Math.floor((Date.now() - user.createdAt.getTime()) / 86400000));

    const evaluation = this.aiEvaluator.evaluate({
      userId,
      serviceSlug: capability.serviceSlug,
      accountIdentifier: dto.accountIdentifier,
      isPhoneVerified: Boolean(user.phoneVerifiedAt),
      userAccountAgeDays: accountAgeDays,
      completedOrdersCount,
      recentLinkAttempts24h: recentLinkAttempts,
      hasPriorRevocations: revocations > 0,
      hasExplicitConsent: true,
    });

    if (evaluation.recommendation === AiRecommendation.REJECT) {
      throw new BadRequestException(evaluation.reasonsAr[0] || 'تم رفض ربط الحساب وفق ضوابط الأمان.');
    }

    const accountId = uuidv4();
    const consentId = uuidv4();
    const reviewId = evaluation.needsHumanReview ? uuidv4() : undefined;
    const scopes = (dto.consentScopes || []).filter((scope) =>
      ['READ_ACCOUNT_INFO', 'AUTOPROMPT_CHECKOUT', 'REFERENCE_ONLY'].includes(scope),
    );
    const consentText = `أوافق صراحة على حفظ معرف الحساب (${evaluation.sanitizedIdentifier}) للخدمة (${capability.serviceNameAr}) كمرجع للشراء فقط. لا يعني هذا منح المنصة كلمة المرور أو صلاحية الدخول، ويمكنني إلغاء الربط وسحب الموافقة في أي وقت.`;

    const result = await this.prisma.$transaction(async (tx) => {
      const account = await tx.linkedServiceAccount.create({
        data: {
          id: accountId,
          tenantId,
          userId,
          serviceSlug: capability.serviceSlug,
          serviceName: capability.serviceName,
          serviceNameAr: capability.serviceNameAr,
          accountIdentifier: evaluation.sanitizedIdentifier,
          accountName: dto.accountName || null,
          serverZoneId: dto.serverZoneId || null,
          status: ServiceAccountStatus.REFERENCE_ONLY,
          verificationSource: 'CUSTOMER_EXPLICIT_INPUT_ONLY',
          // Do not set lastVerifiedAt: no publisher/provider verification occurred.
        },
      });
      const consent = await tx.linkedServiceConsent.create({
        data: {
          id: consentId,
          tenantId,
          userId,
          serviceAccountId: accountId,
          serviceSlug: capability.serviceSlug,
          scopes,
          consentText,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
        },
      });
      let review: any = null;
      if (reviewId) {
        review = await tx.linkedServiceAccountReview.create({
          data: {
            id: reviewId,
            tenantId,
            userId,
            serviceAccountId: accountId,
            serviceSlug: capability.serviceSlug,
            accountIdentifier: evaluation.sanitizedIdentifier,
            accountName: dto.accountName || null,
            status: AccountReviewStatus.PENDING,
            riskLevel: evaluation.riskLevel,
            riskScore: evaluation.riskScore,
            aiRecommendation: evaluation.recommendation,
            aiReasons: evaluation.reasons,
            aiReasonsAr: evaluation.reasonsAr,
          },
        });
      }
      return { account, consent, review };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return {
      success: true,
      account: result.account,
      consent: {
        consentId: result.consent.id,
        scopes: result.consent.scopes,
        consentText: result.consent.consentText,
        grantedAt: result.consent.grantedAt,
      },
      reviewCase: result.review,
      aiEvaluation: evaluation,
      message: result.review
        ? 'تم حفظ الحساب والموافقة في قاعدة البيانات، وهو بانتظار مراجعة بشرية.'
        : 'تم حفظ معرف الحساب والموافقة في قاعدة البيانات كمرجع شراء فقط؛ لم يتم التحقق منه لدى الناشر.',
    };
  }

  async getMyAccounts(userId: string) {
    const data = await this.prisma.linkedServiceAccount.findMany({
      where: { userId, tenantId: TENANT_SCOPE(), status: { not: ServiceAccountStatus.REVOKED } },
      include: {
        consents: { where: { revokedAt: null }, orderBy: { grantedAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });
    return { data, total: data.length };
  }

  async unlinkAccount(userId: string, accountId: string) {
    const tenantId = TENANT_SCOPE();
    const account = await this.prisma.linkedServiceAccount.findFirst({
      where: { id: accountId, tenantId },
    });
    if (!account) throw new NotFoundException('حساب الخدمة المطلوب غير موجود.');
    if (account.userId !== userId) throw new ForbiddenException('ليس لديك صلاحية لإلغاء ربط هذا الحساب.');

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.linkedServiceAccount.updateMany({
        where: { id: accountId, userId, tenantId, status: { not: ServiceAccountStatus.REVOKED } },
        data: { status: ServiceAccountStatus.REVOKED },
      });
      if (updated.count !== 1) throw new ConflictException('تم إلغاء ربط الحساب مسبقاً أو تغيرت حالته.');
      await tx.linkedServiceConsent.updateMany({
        where: { serviceAccountId: accountId, userId, tenantId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          userId,
          action: 'SERVICE_ACCOUNT_CONSENT_REVOKED',
          entityName: 'LinkedServiceAccount',
          entityId: accountId,
          newValues: { status: ServiceAccountStatus.REVOKED, consentRevoked: true },
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return { success: true, message: 'تم إلغاء ربط الحساب وسحب الموافقة وحفظ الإجراء في سجل التدقيق.' };
  }

  async evaluateAccountRisk(userId: string, accountId: string): Promise<AiEvaluationReport> {
    const tenantId = TENANT_SCOPE();
    const account = await this.prisma.linkedServiceAccount.findFirst({ where: { id: accountId, tenantId } });
    if (!account) throw new NotFoundException('حساب الخدمة غير موجود.');
    if (account.userId !== userId) throw new ForbiddenException('ليس لديك صلاحية لعرض تقرير هذا الحساب.');

    const since = new Date(Date.now() - 86400000);
    const [user, completedOrdersCount, recentLinkAttempts, revocations, activeConsent] = await Promise.all([
      this.prisma.user.findFirst({ where: { id: userId, tenantId }, select: { createdAt: true, phoneVerifiedAt: true } }),
      this.prisma.order.count({ where: { userId, tenantId, status: 'Completed' } }),
      this.prisma.linkedServiceAccount.count({ where: { userId, tenantId, createdAt: { gte: since } } }),
      this.prisma.linkedServiceAccount.count({ where: { userId, tenantId, status: ServiceAccountStatus.REVOKED } }),
      this.prisma.linkedServiceConsent.count({ where: { serviceAccountId: accountId, userId, tenantId, revokedAt: null } }),
    ]);
    if (!user) throw new NotFoundException('حساب العميل غير موجود.');
    return this.aiEvaluator.evaluate({
      userId,
      serviceSlug: account.serviceSlug,
      accountIdentifier: account.accountIdentifier,
      isPhoneVerified: Boolean(user.phoneVerifiedAt),
      userAccountAgeDays: Math.max(0, Math.floor((Date.now() - user.createdAt.getTime()) / 86400000)),
      completedOrdersCount,
      recentLinkAttempts24h: recentLinkAttempts,
      hasPriorRevocations: revocations > 0,
      hasExplicitConsent: activeConsent > 0,
    });
  }

  async getAdminReviewCases(status?: AccountReviewStatus, search?: string) {
    const where: Prisma.LinkedServiceAccountReviewWhereInput = { tenantId: TENANT_SCOPE() };
    if (status) where.status = status;
    if (search?.trim()) {
      const q = search.trim();
      where.OR = [
        { accountIdentifier: { contains: q, mode: 'insensitive' } },
        { serviceSlug: { contains: q, mode: 'insensitive' } },
        { accountName: { contains: q, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.linkedServiceAccountReview.findMany({
        where,
        include: { serviceAccount: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.linkedServiceAccountReview.count({ where }),
    ]);
    return { data, total };
  }

  async resolveAdminReview(staffId: string, reviewId: string, dto: ResolveReviewDto) {
    const tenantId = TENANT_SCOPE();
    return this.prisma.$transaction(async (tx) => {
      const review = await tx.linkedServiceAccountReview.findFirst({
        where: { id: reviewId, tenantId },
        include: { serviceAccount: true },
      });
      if (!review) throw new NotFoundException('حالة المراجعة الإدارية غير موجودة.');
      if (review.status !== AccountReviewStatus.PENDING && review.status !== AccountReviewStatus.NEEDS_INFO) {
        throw new ConflictException('تمت معالجة حالة المراجعة مسبقاً.');
      }
      if (review.userId === staffId) throw new ForbiddenException('لا يجوز لصاحب الحساب مراجعة حسابه.');
      const nextStatus =
        dto.decision === 'APPROVE' ? AccountReviewStatus.APPROVED :
        dto.decision === 'REJECT' ? AccountReviewStatus.REJECTED :
        AccountReviewStatus.NEEDS_INFO;
      const updatedReview = await tx.linkedServiceAccountReview.update({
        where: { id: reviewId },
        data: {
          status: nextStatus,
          operatorId: staffId,
          operatorNotes: dto.operatorNotes,
          resolvedAt: dto.decision === 'NEEDS_INFO' ? null : new Date(),
        },
      });
      let updatedAccount = review.serviceAccount;
      if (dto.decision === 'REJECT') {
        updatedAccount = await tx.linkedServiceAccount.update({
          where: { id: review.serviceAccountId },
          data: { status: ServiceAccountStatus.REVOKED },
        });
        await tx.linkedServiceConsent.updateMany({
          where: { serviceAccountId: review.serviceAccountId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      } else if (dto.decision === 'APPROVE') {
        // Human review approves the reference record only; it does not imply
        // an official publisher validation or OAuth ownership verification.
        updatedAccount = await tx.linkedServiceAccount.update({
          where: { id: review.serviceAccountId },
          data: { status: ServiceAccountStatus.REFERENCE_ONLY, verificationSource: 'HUMAN_REVIEW_REFERENCE_ONLY' },
        });
      }
      await tx.auditLog.create({
        data: {
          userId: staffId,
          action: 'SERVICE_ACCOUNT_REVIEW_RESOLVED',
          entityName: 'LinkedServiceAccountReview',
          entityId: reviewId,
          newValues: {
            decision: dto.decision,
            notes: dto.operatorNotes,
            status: nextStatus,
            financialImpact: 'NONE',
          },
        },
      });
      return {
        success: true,
        message: `تم حفظ قرار المراجعة (${dto.decision}) وسجل التدقيق في قاعدة البيانات.`,
        reviewCase: updatedReview,
        account: updatedAccount,
        financialImpact: 'NONE',
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
