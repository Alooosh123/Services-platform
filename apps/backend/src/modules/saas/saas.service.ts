import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  SaaSBillingCycle,
  SaaSSubscriptionStatus,
  SaaSTenantStatus,
  SaaSInvoiceStatus,
  CurrencyCode,
  SaaSPlanDto,
  SaaSTenantDto,
  SaaSSubscriptionDto,
  SaaSInvoiceDto,
  SaaSKpiDashboardDto,
  SaaSPermissionsAuditDto,
  SaaSFeatureItem,
} from '@digital-topup/shared';
import {
  CreateTenantDto,
  UpdateTenantStatusDto,
  RenewSubscriptionDto,
  UpdatePlanPriceDto,
  CreateInvoiceDto,
  MarkSaasInvoicePaidDto,
} from './dto/saas.dto';
import * as crypto from 'crypto';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class SaasService {
  private readonly logger = new Logger(SaasService.name);

  private readonly fullEqualFeatures: SaaSFeatureItem[] = [
    {
      key: 'INSTANT_TOPUP_UNLIMITED',
      name: 'Unlimited Instant Top-Up Engine',
      nameAr: 'محرك الشحن الفوري للألعاب والبطاقات',
      included: true,
      descriptionAr: 'إتاحة محرك طلبات الشحن وفق حدود الأمان والتشغيل المعتمدة.',
    },
    {
      key: 'PROVIDER_API_INTEGRATIONS',
      name: 'Provider Adapters & APIs',
      nameAr: 'محولات مزودي الشحن وواجهات API',
      included: true,
      descriptionAr: 'إتاحة طبقة تكامل المزودين، مع بقاء كل مزود غير معتمد في وضع الإيقاف.',
    },
    {
      key: 'IMMUTABLE_DOUBLE_ENTRY_LEDGER',
      name: 'Immutable Double-Entry Ledger',
      nameAr: 'دفتر الأستاذ المالي بالقيد المزدوج',
      included: true,
      descriptionAr: 'إتاحة أدوات الدفتر المالي وسجل التدقيق لكل متجر ضمن عزله.',
    },
    {
      key: 'ALL_PAYMENT_GATEWAYS',
      name: 'Payment Channels',
      nameAr: 'قنوات الدفع',
      included: true,
      descriptionAr: 'إتاحة إدارة قنوات الدفع، دون تفعيل قناة قبل التحقق والاعتماد المالي.',
    },
    {
      key: 'CUSTOMER_WALLETS_SYSTEM',
      name: 'Multi-Currency Wallets',
      nameAr: 'محافظ متعددة العملات',
      included: true,
      descriptionAr: 'إتاحة محافظ YER وUSD وSAR مع فصل العملات وعدم التحويل الضمني.',
    },
    {
      key: 'DYNAMIC_FORMS_ENGINE',
      name: 'Dynamic Forms Engine',
      nameAr: 'محرك النماذج الديناميكية',
      included: true,
      descriptionAr: 'إتاحة نماذج خدمات ديناميكية قابلة للتهيئة.',
    },
    {
      key: 'AI_RISK_AND_ANTIFRAUD',
      name: 'Risk & Anti-Fraud Controls',
      nameAr: 'ضوابط المخاطر ومكافحة الاحتيال',
      included: true,
      descriptionAr: 'إتاحة ضوابط المخاطر والمراجعة البشرية.',
    },
    {
      key: 'FULL_SUPPORT_TICKETING',
      name: 'Support Ticketing',
      nameAr: 'تذاكر الدعم الفني',
      included: true,
      descriptionAr: 'إتاحة إدارة طلبات الدعم ومتابعتها.',
    },
    {
      key: 'FINANCIAL_REPORTS_RECONCILIATION',
      name: 'Financial Reports & Reconciliation',
      nameAr: 'التقارير المالية والمطابقة',
      included: true,
      descriptionAr: 'إتاحة تقارير المتجر وعمليات المطابقة.',
    },
    {
      key: 'CUSTOM_DOMAIN_AND_BRANDING',
      name: 'Custom Domain & Branding',
      nameAr: 'النطاق والهوية المخصصة',
      included: true,
      descriptionAr: 'إتاحة تهيئة هوية المتجر والنطاق بعد التحقق الفني.',
    },
    {
      key: 'AUTOMATED_BACKUPS_AND_SLA',
      name: 'Backups & Operational Monitoring',
      nameAr: 'النسخ الاحتياطي ومراقبة التشغيل',
      included: true,
      descriptionAr: 'إتاحة سياسات النسخ الاحتياطي والمراقبة بحسب إعدادات الاستضافة الفعلية.',
    },
    {
      key: 'REST_APIS_AND_WEBHOOKS',
      name: 'REST APIs & Webhooks',
      nameAr: 'واجهات REST وWebhooks',
      included: true,
      descriptionAr: 'إتاحة واجهات الربط والتكامل ضمن ضوابط صلاحيات المتجر.',
    },
  ];

  constructor(private readonly prisma: PrismaService) {}

  private mapPlan(plan: any, activeSubscribersCount?: number): SaaSPlanDto {
    return {
      id: plan.id,
      name: plan.name,
      nameAr: plan.nameAr,
      billingCycle: plan.billingCycle as SaaSBillingCycle,
      durationDays: plan.durationDays,
      priceUsd: Number(plan.priceUsd),
      priceYer: Number(plan.priceYer),
      priceSar: Number(plan.priceSar),
      hasFullPermissions: plan.hasFullPermissions,
      descriptionAr: plan.descriptionAr,
      features: Array.isArray(plan.featuresJson)
        ? (plan.featuresJson as SaaSFeatureItem[])
        : [],
      isActive: plan.isActive,
      sortOrder: plan.sortOrder,
      ...(activeSubscribersCount === undefined ? {} : { activeSubscribersCount }),
    };
  }

  private mapSubscription(subscription: any): SaaSSubscriptionDto {
    const now = Date.now();
    const endDate = new Date(subscription.endDate).getTime();
    return {
      id: subscription.id,
      tenantId: subscription.tenantId,
      tenantName: subscription.tenant?.name,
      planId: subscription.planId,
      planName: subscription.plan?.nameAr,
      billingCycle: subscription.billingCycle as SaaSBillingCycle,
      pricePaid: Number(subscription.pricePaid),
      currency: subscription.currency as CurrencyCode,
      startDate: new Date(subscription.startDate).toISOString(),
      endDate: new Date(subscription.endDate).toISOString(),
      autoRenew: subscription.autoRenew,
      status: subscription.status as SaaSSubscriptionStatus,
      daysRemaining: Math.max(0, Math.ceil((endDate - now) / DAY_MS)),
      lastRenewalDate: subscription.lastRenewalDate
        ? new Date(subscription.lastRenewalDate).toISOString()
        : undefined,
      createdAt: new Date(subscription.createdAt).toISOString(),
    };
  }

  private mapInvoice(invoice: any): SaaSInvoiceDto {
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      tenantId: invoice.tenantId,
      tenantName: invoice.tenant?.name,
      subscriptionId: invoice.subscriptionId || undefined,
      amount: Number(invoice.amount),
      currency: invoice.currency as CurrencyCode,
      status: invoice.status as SaaSInvoiceStatus,
      billingCycle: invoice.billingCycle as SaaSBillingCycle,
      paymentMethod: invoice.paymentMethod || undefined,
      referenceNumber: invoice.referenceNumber || undefined,
      paidAt: invoice.paidAt ? new Date(invoice.paidAt).toISOString() : undefined,
      dueDate: new Date(invoice.dueDate).toISOString(),
      createdAt: new Date(invoice.createdAt).toISOString(),
    };
  }

  private mapTenant(tenant: any): SaaSTenantDto {
    const latestSubscription = tenant.subscriptions?.[0];
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      domain: tenant.domain || undefined,
      customDomain: tenant.customDomain || undefined,
      ownerName: tenant.ownerName,
      ownerEmail: tenant.ownerEmail,
      ownerPhone: tenant.ownerPhone,
      status: tenant.status as SaaSTenantStatus,
      licenseKey: tenant.licenseKey,
      notes: tenant.notes || undefined,
      currentSubscription: latestSubscription
        ? this.mapSubscription({ ...latestSubscription, tenant })
        : undefined,
      createdAt: new Date(tenant.createdAt).toISOString(),
      updatedAt: new Date(tenant.updatedAt).toISOString(),
    };
  }

  private planPrice(plan: any, currency: CurrencyCode): Prisma.Decimal {
    switch (currency) {
      case CurrencyCode.YER:
        return new Prisma.Decimal(plan.priceYer);
      case CurrencyCode.SAR:
        return new Prisma.Decimal(plan.priceSar);
      case CurrencyCode.USD:
      default:
        return new Prisma.Decimal(plan.priceUsd);
    }
  }

  private createInvoiceNumber(): string {
    const date = new Date();
    const month = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
    return `INV-SAAS-${month}-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
  }

  private async getActivePlan(cycle: SaaSBillingCycle) {
    const plan = await this.prisma.saaSPlan.findUnique({ where: { billingCycle: cycle } });
    if (!plan || !plan.isActive) {
      throw new NotFoundException(`No active SaaS plan is configured for billing cycle ${cycle}`);
    }
    return plan;
  }

  /**
   * Plans are always read from PostgreSQL. There is deliberately no in-memory
   * fallback in any environment because it can diverge between API instances.
   */
  async getPlans(): Promise<SaaSPlanDto[]> {
    try {
      const plans = await this.prisma.saaSPlan.findMany({
        orderBy: { sortOrder: 'asc' },
      });
      const subscriberCounts = await this.prisma.saaSSubscription.groupBy({
        by: ['planId'],
        where: { status: SaaSSubscriptionStatus.ACTIVE },
        _count: { _all: true },
      });
      const countByPlan = new Map(
        subscriberCounts.map((row) => [row.planId, row._count._all]),
      );
      return plans.map((plan) => this.mapPlan(plan, countByPlan.get(plan.id) || 0));
    } catch (error: any) {
      this.logger.error(`SaaS plan database read failed: ${error?.message || error}`);
      throw new ServiceUnavailableException('SaaS plans are temporarily unavailable from the database.');
    }
  }

  async updatePlanPrice(planId: string, dto: UpdatePlanPriceDto): Promise<SaaSPlanDto> {
    const plan = await this.prisma.saaSPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('SaaS plan not found');

    const updated = await this.prisma.saaSPlan.update({
      where: { id: planId },
      data: {
        priceUsd: new Prisma.Decimal(dto.priceUsd),
        priceYer: new Prisma.Decimal(dto.priceYer),
        priceSar: new Prisma.Decimal(dto.priceSar),
      },
    });
    return this.mapPlan(updated);
  }

  async verifyAllPlansEqualPermissions(): Promise<SaaSPermissionsAuditDto> {
    const plans = await this.prisma.saaSPlan.findMany({ orderBy: { sortOrder: 'asc' } });
    const expectedKeys = this.fullEqualFeatures.map((feature) => feature.key).sort();
    const evaluatedTiers = plans.map((plan) => {
      const features = Array.isArray(plan.featuresJson)
        ? (plan.featuresJson as SaaSFeatureItem[])
        : [];
      const enabledKeys = features.filter((feature) => feature.included).map((feature) => feature.key).sort();
      const equalKeys =
        enabledKeys.length === expectedKeys.length &&
        enabledKeys.every((key, index) => key === expectedKeys[index]);
      return {
        billingCycle: plan.billingCycle as SaaSBillingCycle,
        priceUsd: Number(plan.priceUsd),
        priceYer: Number(plan.priceYer),
        permissionsCount: enabledKeys.length,
        allModulesAccessible: plan.hasFullPermissions && equalKeys,
      };
    });
    const invariantPassed =
      plans.length > 0 &&
      evaluatedTiers.length === 3 &&
      evaluatedTiers.every((tier) => tier.allModulesAccessible);

    return {
      verifiedAt: new Date().toISOString(),
      invariantPassed,
      policyDeclaration:
        'تمنح الباقات الأسبوعية والشهرية والسنوية الصلاحيات الوظيفية نفسها؛ ويقتصر الاختلاف على السعر ومدة الاشتراك.',
      tiersEvaluated: evaluatedTiers,
    };
  }

  async getTenants(search?: string, status?: SaaSTenantStatus): Promise<SaaSTenantDto[]> {
    const where: Prisma.SaaSTenantWhereInput = {};
    if (status) where.status = status;
    if (search?.trim()) {
      const term = search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { slug: { contains: term, mode: 'insensitive' } },
        { ownerName: { contains: term, mode: 'insensitive' } },
        { ownerEmail: { contains: term, mode: 'insensitive' } },
        { ownerPhone: { contains: term } },
      ];
    }
    const tenants = await this.prisma.saaSTenant.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { plan: true },
        },
      },
    });
    return tenants.map((tenant) => this.mapTenant(tenant));
  }

  async getTenantById(id: string): Promise<SaaSTenantDto> {
    const tenant = await this.prisma.saaSTenant.findUnique({
      where: { id },
      include: {
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { plan: true },
        },
      },
    });
    if (!tenant) throw new NotFoundException(`SaaS tenant ${id} was not found`);
    return this.mapTenant(tenant);
  }

  async createTenant(dto: CreateTenantDto): Promise<SaaSTenantDto> {
    const plan = await this.getActivePlan(dto.billingCycle);
    const currency = dto.currency || CurrencyCode.USD;
    const now = new Date();
    const invoiceDueDate = new Date(now.getTime() + 7 * DAY_MS);
    const plannedStartDate = invoiceDueDate;
    const plannedEndDate = new Date(plannedStartDate.getTime() + plan.durationDays * DAY_MS);
    const licenseKey =
      `LIC-SAAS-${dto.slug.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

    try {
      const tenant = await this.prisma.$transaction(async (tx) => {
        const createdTenant = await tx.saaSTenant.create({
          data: {
            name: dto.name.trim(),
            slug: dto.slug.trim().toLowerCase(),
            domain: dto.domain?.trim().toLowerCase() || null,
            ownerName: dto.ownerName.trim(),
            ownerEmail: dto.ownerEmail.trim().toLowerCase(),
            ownerPhone: dto.ownerPhone.trim(),
            status: SaaSTenantStatus.PENDING_SETUP,
            licenseKey,
            notes: dto.notes?.trim() || null,
          },
        });

        const subscription = await tx.saaSSubscription.create({
          data: {
            tenantId: createdTenant.id,
            planId: plan.id,
            billingCycle: plan.billingCycle,
            pricePaid: this.planPrice(plan, currency),
            currency,
            startDate: plannedStartDate,
            endDate: plannedEndDate,
            autoRenew: false,
            status: SaaSSubscriptionStatus.PENDING_PAYMENT,
          },
        });

        await tx.saaSInvoice.create({
          data: {
            invoiceNumber: this.createInvoiceNumber(),
            tenantId: createdTenant.id,
            subscriptionId: subscription.id,
            amount: this.planPrice(plan, currency),
            currency,
            status: SaaSInvoiceStatus.PENDING,
            billingCycle: plan.billingCycle,
            dueDate: invoiceDueDate,
          },
        });

        return tx.saaSTenant.findUniqueOrThrow({
          where: { id: createdTenant.id },
          include: {
            subscriptions: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: { plan: true },
            },
          },
        });
      });
      return this.mapTenant(tenant);
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Tenant slug, domain or license key already exists');
      }
      throw error;
    }
  }

  async updateTenantStatus(id: string, dto: UpdateTenantStatusDto): Promise<SaaSTenantDto> {
    const now = new Date();
    const existing = await this.prisma.saaSTenant.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('SaaS tenant not found');

    if (dto.status === SaaSTenantStatus.ACTIVE) {
      const paidActiveSubscription = await this.prisma.saaSSubscription.findFirst({
        where: {
          tenantId: id,
          status: SaaSSubscriptionStatus.ACTIVE,
          endDate: { gt: now },
        },
      });
      if (!paidActiveSubscription) {
        throw new BadRequestException('Cannot activate a tenant without a currently paid active subscription');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.saaSTenant.update({
        where: { id },
        data: { status: dto.status },
      });

      if (dto.status === SaaSTenantStatus.SUSPENDED) {
        await tx.saaSSubscription.updateMany({
          where: { tenantId: id, status: SaaSSubscriptionStatus.ACTIVE },
          data: { status: SaaSSubscriptionStatus.SUSPENDED },
        });
      } else if (dto.status === SaaSTenantStatus.TERMINATED) {
        await tx.saaSSubscription.updateMany({
          where: {
            tenantId: id,
            status: {
              in: [
                SaaSSubscriptionStatus.ACTIVE,
                SaaSSubscriptionStatus.TRIAL,
                SaaSSubscriptionStatus.PENDING_PAYMENT,
              ],
            },
          },
          data: { status: SaaSSubscriptionStatus.CANCELLED, autoRenew: false },
        });
      }
    });

    return this.getTenantById(id);
  }

  async renewSubscription(tenantId: string, dto: RenewSubscriptionDto): Promise<SaaSTenantDto> {
    const [tenant, plan] = await Promise.all([
      this.prisma.saaSTenant.findUnique({ where: { id: tenantId } }),
      this.getActivePlan(dto.billingCycle),
    ]);
    if (!tenant) throw new NotFoundException('SaaS tenant not found');
    if (tenant.status === SaaSTenantStatus.TERMINATED) {
      throw new BadRequestException('A terminated tenant cannot be renewed');
    }

    const currency = dto.currency || CurrencyCode.USD;
    const now = new Date();
    const activeSubscription = await this.prisma.saaSSubscription.findFirst({
      where: {
        tenantId,
        status: SaaSSubscriptionStatus.ACTIVE,
        endDate: { gt: now },
      },
      orderBy: { endDate: 'desc' },
    });
    const startDate =
      activeSubscription && activeSubscription.endDate > now
        ? activeSubscription.endDate
        : now;
    const endDate = new Date(startDate.getTime() + plan.durationDays * DAY_MS);
    const dueDate = new Date(now.getTime() + 7 * DAY_MS);

    await this.prisma.$transaction(async (tx) => {
      const pending = await tx.saaSInvoice.count({
        where: {
          tenantId,
          status: { in: [SaaSInvoiceStatus.PENDING, SaaSInvoiceStatus.OVERDUE] },
        },
      });
      if (pending > 0) {
        throw new ConflictException('This tenant already has an unpaid SaaS invoice');
      }

      const subscription = await tx.saaSSubscription.create({
        data: {
          tenantId,
          planId: plan.id,
          billingCycle: plan.billingCycle,
          pricePaid: this.planPrice(plan, currency),
          currency,
          startDate,
          endDate,
          autoRenew: false,
          status: SaaSSubscriptionStatus.PENDING_PAYMENT,
        },
      });

      await tx.saaSInvoice.create({
        data: {
          invoiceNumber: this.createInvoiceNumber(),
          tenantId,
          subscriptionId: subscription.id,
          amount: this.planPrice(plan, currency),
          currency,
          status: SaaSInvoiceStatus.PENDING,
          billingCycle: plan.billingCycle,
          dueDate,
        },
      });
    });

    return this.getTenantById(tenantId);
  }

  async markInvoicePaid(
    invoiceId: string,
    dto: MarkSaasInvoicePaidDto,
    actorUserId: string,
  ): Promise<SaaSInvoiceDto> {
    const paymentMethod = dto.paymentMethod.trim();
    const referenceNumber = dto.referenceNumber.trim();
    const paidAt = new Date();

    try {
      const invoice = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.saaSInvoice.findUnique({
          where: { id: invoiceId },
          include: { subscription: { include: { plan: true } } },
        });
        if (!existing) throw new NotFoundException('SaaS invoice not found');
        if (![SaaSInvoiceStatus.PENDING, SaaSInvoiceStatus.OVERDUE].includes(existing.status)) {
          throw new ConflictException('Only pending or overdue invoices can be marked as paid');
        }

        const duplicateReference = await tx.saaSInvoice.findFirst({
          where: {
            paymentMethod,
            referenceNumber,
            id: { not: invoiceId },
          },
        });
        if (duplicateReference) {
          throw new ConflictException('This payment reference is already attached to another SaaS invoice');
        }

        const claimed = await tx.saaSInvoice.updateMany({
          where: {
            id: invoiceId,
            status: { in: [SaaSInvoiceStatus.PENDING, SaaSInvoiceStatus.OVERDUE] },
          },
          data: {
            status: SaaSInvoiceStatus.PAID,
            paymentMethod,
            referenceNumber,
            paidAt,
          },
        });
        if (claimed.count !== 1) {
          throw new ConflictException('Invoice payment was already processed by another request');
        }

        if (existing.subscriptionId && existing.subscription) {
          const subscription = existing.subscription;
          const tenant = await tx.saaSTenant.findUnique({ where: { id: existing.tenantId } });
          if (!tenant || tenant.status === SaaSTenantStatus.TERMINATED) {
            throw new BadRequestException('The tenant is not eligible for activation');
          }

          await tx.saaSSubscription.updateMany({
            where: {
              tenantId: existing.tenantId,
              status: SaaSSubscriptionStatus.ACTIVE,
              id: { not: subscription.id },
            },
            data: { status: SaaSSubscriptionStatus.EXPIRED },
          });

          const startsAt =
            subscription.startDate > paidAt ? subscription.startDate : paidAt;
          const endsAt = new Date(startsAt.getTime() + subscription.plan.durationDays * DAY_MS);

          await tx.saaSSubscription.update({
            where: { id: subscription.id },
            data: {
              status: SaaSSubscriptionStatus.ACTIVE,
              startDate: startsAt,
              endDate: endsAt,
              lastRenewalDate: paidAt,
            },
          });
          await tx.saaSTenant.update({
            where: { id: existing.tenantId },
            data: { status: SaaSTenantStatus.ACTIVE },
          });
        }

        await tx.auditLog.create({
          data: {
            userId: actorUserId,
            userRole: 'SUPER_ADMIN',
            action: 'SAAS_INVOICE_MARKED_PAID',
            entityName: 'SaaSInvoice',
            entityId: invoiceId,
            newValues: {
              paymentMethod,
              referenceNumber,
              paidAt: paidAt.toISOString(),
              amount: Number(existing.amount),
              currency: existing.currency,
            },
          },
        });

        return tx.saaSInvoice.findUniqueOrThrow({
          where: { id: invoiceId },
          include: { tenant: true },
        });
      });
      return this.mapInvoice(invoice);
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('This payment reference has already been used');
      }
      throw error;
    }
  }

  async getSubscriptions(status?: SaaSSubscriptionStatus): Promise<SaaSSubscriptionDto[]> {
    const subscriptions = await this.prisma.saaSSubscription.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { tenant: true, plan: true },
    });
    return subscriptions.map((subscription) => this.mapSubscription(subscription));
  }

  async getInvoices(status?: SaaSInvoiceStatus): Promise<SaaSInvoiceDto[]> {
    const invoices = await this.prisma.saaSInvoice.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { tenant: true },
    });
    return invoices.map((invoice) => this.mapInvoice(invoice));
  }

  async createInvoice(dto: CreateInvoiceDto): Promise<SaaSInvoiceDto> {
    const tenant = await this.prisma.saaSTenant.findUnique({ where: { id: dto.tenantId } });
    if (!tenant) throw new NotFoundException('SaaS tenant not found');

    if (dto.subscriptionId) {
      const subscription = await this.prisma.saaSSubscription.findFirst({
        where: { id: dto.subscriptionId, tenantId: dto.tenantId },
      });
      if (!subscription) throw new BadRequestException('Subscription does not belong to this tenant');
    }

    const invoice = await this.prisma.saaSInvoice.create({
      data: {
        invoiceNumber: this.createInvoiceNumber(),
        tenantId: dto.tenantId,
        subscriptionId: dto.subscriptionId || null,
        amount: new Prisma.Decimal(dto.amount),
        currency: dto.currency,
        status: SaaSInvoiceStatus.PENDING,
        billingCycle: dto.billingCycle,
        dueDate: new Date(Date.now() + 7 * DAY_MS),
      },
      include: { tenant: true },
    });
    return this.mapInvoice(invoice);
  }

  async getSaaSKpiDashboard(): Promise<SaaSKpiDashboardDto> {
    const now = new Date();
    const [totalTenantsCount, activeSubscribersCount, subscriptions, pendingInvoices, expiredSubscriptionsCount] =
      await Promise.all([
        this.prisma.saaSTenant.count(),
        this.prisma.saaSSubscription.count({
          where: {
            status: SaaSSubscriptionStatus.ACTIVE,
            endDate: { gt: now },
            tenant: { status: SaaSTenantStatus.ACTIVE },
          },
        }),
        this.prisma.saaSSubscription.findMany({
          where: { status: SaaSSubscriptionStatus.ACTIVE, endDate: { gt: now } },
          select: { billingCycle: true, pricePaid: true, currency: true },
        }),
        this.prisma.saaSInvoice.findMany({
          where: { status: { in: [SaaSInvoiceStatus.PENDING, SaaSInvoiceStatus.OVERDUE] } },
          select: { amount: true, currency: true },
        }),
        this.prisma.saaSSubscription.count({
          where: {
            OR: [
              { status: SaaSSubscriptionStatus.EXPIRED },
              { endDate: { lte: now }, status: SaaSSubscriptionStatus.ACTIVE },
            ],
          },
        }),
      ]);

    let weeklySubscriptionsCount = 0;
    let monthlySubscriptionsCount = 0;
    let annualSubscriptionsCount = 0;
    let monthlyRecurringRevenueUsd = 0;

    for (const subscription of subscriptions) {
      if (subscription.billingCycle === SaaSBillingCycle.WEEKLY) weeklySubscriptionsCount++;
      if (subscription.billingCycle === SaaSBillingCycle.MONTHLY) monthlySubscriptionsCount++;
      if (subscription.billingCycle === SaaSBillingCycle.ANNUAL) annualSubscriptionsCount++;

      // MRR is reported in USD only. Non-USD subscriptions are not converted implicitly.
      if (subscription.currency === CurrencyCode.USD) {
        const amount = Number(subscription.pricePaid);
        if (subscription.billingCycle === SaaSBillingCycle.WEEKLY) monthlyRecurringRevenueUsd += amount * (52 / 12);
        if (subscription.billingCycle === SaaSBillingCycle.MONTHLY) monthlyRecurringRevenueUsd += amount;
        if (subscription.billingCycle === SaaSBillingCycle.ANNUAL) monthlyRecurringRevenueUsd += amount / 12;
      }
    }

    const pendingInvoicesAmountUsd = pendingInvoices
      .filter((invoice) => invoice.currency === CurrencyCode.USD)
      .reduce((sum, invoice) => sum + Number(invoice.amount), 0);

    // This is an active-subscriber ratio, not a cohort-based retention metric.
    const retentionRatePercent =
      totalTenantsCount === 0
        ? 0
        : Math.round((activeSubscribersCount / totalTenantsCount) * 10000) / 100;
    const roundedMrr = Math.round(monthlyRecurringRevenueUsd * 100) / 100;

    return {
      timestamp: now.toISOString(),
      totalTenantsCount,
      activeSubscribersCount,
      monthlyRecurringRevenueUsd: roundedMrr,
      annualRunRateUsd: Math.round(roundedMrr * 12 * 100) / 100,
      weeklySubscriptionsCount,
      monthlySubscriptionsCount,
      annualSubscriptionsCount,
      expiredSubscriptionsCount,
      pendingInvoicesAmountUsd: Math.round(pendingInvoicesAmountUsd * 100) / 100,
      retentionRatePercent,
      equalPermissionsPolicyEnforced: await this.verifyAllPlansEqualPermissions().then((audit) => audit.invariantPassed),
    };
  }

  async getSystemStatus() {
    try {
      const [tenantCount, activeTenantCount, activeProvidersCount, activeGatewaysCount, planCount] =
        await Promise.all([
          this.prisma.saaSTenant.count(),
          this.prisma.saaSTenant.count({ where: { status: SaaSTenantStatus.ACTIVE } }),
          this.prisma.provider.count({ where: { isActive: true } }),
          this.prisma.paymentMethod.count({ where: { isActive: true, isMock: false } }),
          this.prisma.saaSPlan.count({ where: { isActive: true } }),
        ]);

      return {
        status: planCount > 0 ? 'OPERATIONAL' : 'DEGRADED',
        version: '2.6.0-saas-persistent',
        platformName: 'Yemen Digital Services SaaS Platform Engine',
        superAdminRole: 'PLATFORM_MASTER_SUPER_ADMIN',
        uptimeSeconds: process.uptime(),
        multiTenantMode: true,
        equalPermissionsPolicy: (await this.verifyAllPlansEqualPermissions()).invariantPassed
          ? 'STRICTLY_ENFORCED'
          : 'NOT_VERIFIED',
        activeGatewaysCount,
        activeProvidersCount,
        totalTenantsCount: tenantCount,
        activeTenantsCount: activeTenantCount,
        serverTime: new Date().toISOString(),
      };
    } catch (error: any) {
      this.logger.error(`SaaS system status query failed: ${error?.message || error}`);
      throw new ServiceUnavailableException('SaaS system status is unavailable because the database could not be read.');
    }
  }
}
