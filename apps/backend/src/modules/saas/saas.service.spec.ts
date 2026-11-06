import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { SaasService } from './saas.service';
import {
  SaaSBillingCycle,
  SaaSSubscriptionStatus,
  SaaSTenantStatus,
  SaaSInvoiceStatus,
  CurrencyCode,
} from '@digital-topup/shared';

const features = [
  { key: 'INSTANT_TOPUP_UNLIMITED', included: true },
  { key: 'PROVIDER_API_INTEGRATIONS', included: true },
  { key: 'IMMUTABLE_DOUBLE_ENTRY_LEDGER', included: true },
  { key: 'ALL_PAYMENT_GATEWAYS', included: true },
  { key: 'CUSTOMER_WALLETS_SYSTEM', included: true },
  { key: 'DYNAMIC_FORMS_ENGINE', included: true },
  { key: 'AI_RISK_AND_ANTIFRAUD', included: true },
  { key: 'FULL_SUPPORT_TICKETING', included: true },
  { key: 'FINANCIAL_REPORTS_RECONCILIATION', included: true },
  { key: 'CUSTOM_DOMAIN_AND_BRANDING', included: true },
  { key: 'AUTOMATED_BACKUPS_AND_SLA', included: true },
  { key: 'REST_APIS_AND_WEBHOOKS', included: true },
];

const plan = {
  id: 'plan-monthly',
  name: 'Monthly Full-Access Plan',
  nameAr: 'الباقة الشهرية الشاملة',
  billingCycle: SaaSBillingCycle.MONTHLY,
  durationDays: 30,
  priceUsd: 49,
  priceYer: 35000,
  priceSar: 185,
  hasFullPermissions: true,
  descriptionAr: 'باقة شهرية.',
  featuresJson: features,
  isActive: true,
  sortOrder: 2,
};

const tenant = {
  id: 'tenant-db-001',
  name: 'متجر مأرب الرقمي',
  slug: 'marib-digital',
  domain: 'marib.example.test',
  customDomain: null,
  ownerName: 'مالك المتجر',
  ownerEmail: 'owner@example.test',
  ownerPhone: '+967770000001',
  status: SaaSTenantStatus.PENDING_SETUP,
  licenseKey: 'LIC-SAAS-MARIB-0123456789AB',
  notes: null,
  createdAt: new Date('2026-11-06T00:00:00.000Z'),
  updatedAt: new Date('2026-11-06T00:00:00.000Z'),
};

describe('SaasService - persistent subscription management', () => {
  let service: SaasService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      saaSPlan: {
        findMany: jest.fn().mockResolvedValue([plan]),
        findUnique: jest.fn().mockResolvedValue(plan),
        update: jest.fn().mockImplementation(async ({ data }) => ({ ...plan, ...data })),
      },
      saaSTenant: {
        findMany: jest.fn().mockResolvedValue([{ ...tenant, subscriptions: [] }]),
        findUnique: jest.fn().mockResolvedValue(tenant),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ ...tenant, subscriptions: [] }),
        create: jest.fn().mockResolvedValue(tenant),
        update: jest.fn().mockResolvedValue(tenant),
        count: jest.fn().mockResolvedValue(1),
      },
      saaSSubscription: {
        groupBy: jest.fn().mockResolvedValue([{ planId: plan.id, _count: { _all: 2 } }]),
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }) => ({
          id: 'sub-db-001',
          ...data,
          createdAt: new Date(),
          tenant,
          plan,
        })),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      saaSInvoice: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }) => ({
          id: 'invoice-db-001',
          ...data,
          createdAt: new Date(),
          tenant,
        })),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      provider: { count: jest.fn().mockResolvedValue(3) },
      paymentMethod: { count: jest.fn().mockResolvedValue(2) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
      user: {
        findUnique: jest.fn(),
        update: jest.fn().mockImplementation(async ({ data }) => ({ id: 'owner-1', ...data })),
      },
      $transaction: jest.fn(async (callback: any) => callback(prisma)),
    };
    service = new SaasService(prisma);
  });

  it('reads all subscription plans from PostgreSQL and maps Decimal values', async () => {
    const result = await service.getPlans();
    expect(prisma.saaSPlan.findMany).toHaveBeenCalled();
    expect(result[0].priceUsd).toBe(49);
    expect(result[0].activeSubscribersCount).toBe(2);
  });

  it('assigns tenant owner only after exact contact match and audited manual verification', async () => {
    prisma.saaSTenant.findUnique.mockResolvedValue({
      ...tenant,
      status: SaaSTenantStatus.ACTIVE,
      ownerEmail: 'owner@example.test',
      ownerPhone: '+967770000001',
    });
    prisma.user.findUnique.mockResolvedValue({
      id: 'owner-1',
      email: 'owner@example.test',
      phone: '+967770000001',
      tenantId: tenant.id,
      role: 'CUSTOMER',
    });

    const result = await service.assignTenantOwner(
      tenant.id,
      { userId: 'owner-1', verificationReference: 'KYC-REVIEW-2026-001' },
      'platform-admin',
    );

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'owner-1' },
        data: expect.objectContaining({
          tenantId: tenant.id,
          role: 'OWNER',
          isVerified: true,
        }),
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'SAAS_TENANT_OWNER_ASSIGNED',
          entityId: tenant.id,
          newValues: expect.objectContaining({
            verificationReference: 'KYC-REVIEW-2026-001',
            manualVerification: true,
          }),
        }),
      }),
    );
    expect(result.role).toBe('OWNER');
  });

  it('rejects assigning a user whose email and phone do not match the tenant owner', async () => {
    prisma.saaSTenant.findUnique.mockResolvedValue({
      ...tenant,
      status: SaaSTenantStatus.ACTIVE,
      ownerEmail: 'owner@example.test',
      ownerPhone: '+967770000001',
    });
    prisma.user.findUnique.mockResolvedValue({
      id: 'customer-1',
      email: 'different@example.test',
      phone: '+967770000009',
      tenantId: tenant.id,
      role: 'CUSTOMER',
    });

    await expect(service.assignTenantOwner(
      tenant.id,
      { userId: 'customer-1', verificationReference: 'KYC-REVIEW-2026-002' },
      'platform-admin',
    )).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('updates persisted plan prices rather than mutating an in-memory copy', async () => {
    const result = await service.updatePlanPrice(plan.id, {
      priceUsd: 52,
      priceYer: 37000,
      priceSar: 195,
    });
    expect(prisma.saaSPlan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: plan.id },
        data: expect.objectContaining({ priceUsd: expect.anything() }),
      }),
    );
    expect(result.priceUsd).toBe(52);
    expect(result.priceYer).toBe(37000);
  });

  it('creates a tenant, pending subscription and unpaid invoice atomically', async () => {
    prisma.saaSTenant.findUniqueOrThrow.mockResolvedValue({
      ...tenant,
      subscriptions: [{
        id: 'sub-db-001',
        tenantId: tenant.id,
        planId: plan.id,
        plan,
        billingCycle: SaaSBillingCycle.MONTHLY,
        pricePaid: 49,
        currency: CurrencyCode.USD,
        startDate: new Date('2026-11-13T00:00:00.000Z'),
        endDate: new Date('2026-12-13T00:00:00.000Z'),
        autoRenew: false,
        status: SaaSSubscriptionStatus.PENDING_PAYMENT,
        createdAt: new Date(),
      }],
    });

    const result = await service.createTenant({
      name: tenant.name,
      slug: tenant.slug,
      domain: tenant.domain,
      ownerName: tenant.ownerName,
      ownerEmail: tenant.ownerEmail,
      ownerPhone: tenant.ownerPhone,
      billingCycle: SaaSBillingCycle.MONTHLY,
    });

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.saaSTenant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: SaaSTenantStatus.PENDING_SETUP }),
      }),
    );
    expect(prisma.saaSSubscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: SaaSSubscriptionStatus.PENDING_PAYMENT }),
      }),
    );
    expect(prisma.saaSInvoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: SaaSInvoiceStatus.PENDING }),
      }),
    );
    expect(result.status).toBe(SaaSTenantStatus.PENDING_SETUP);
    expect(result.currentSubscription?.status).toBe(SaaSSubscriptionStatus.PENDING_PAYMENT);
  });

  it('rejects duplicate tenant identifiers using the database uniqueness constraint', async () => {
    const duplicate = new Error('Unique constraint failed');
    (duplicate as any).code = 'P2002';
    prisma.$transaction.mockRejectedValueOnce(duplicate);

    await expect(service.createTenant({
      name: 'Duplicate',
      slug: tenant.slug,
      ownerName: 'Owner',
      ownerEmail: 'duplicate@example.test',
      ownerPhone: '+967770000002',
      billingCycle: SaaSBillingCycle.MONTHLY,
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not activate a tenant before an invoice is paid', async () => {
    const result = await service.renewSubscription(tenant.id, {
      billingCycle: SaaSBillingCycle.ANNUAL,
      currency: CurrencyCode.USD,
    });

    expect(prisma.saaSSubscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: SaaSSubscriptionStatus.PENDING_PAYMENT }),
      }),
    );
    expect(prisma.saaSInvoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: SaaSInvoiceStatus.PENDING }),
      }),
    );
    expect(prisma.saaSTenant.update).not.toHaveBeenCalled();
    expect(result.status).toBe(SaaSTenantStatus.PENDING_SETUP);
  });

  it('confirms an invoice exactly once, activates its subscription and writes an audit record', async () => {
    const subscription = {
      id: 'sub-pending-001',
      tenantId: tenant.id,
      planId: plan.id,
      billingCycle: SaaSBillingCycle.MONTHLY,
      pricePaid: 49,
      currency: CurrencyCode.USD,
      startDate: new Date('2026-11-13T00:00:00.000Z'),
      endDate: new Date('2026-12-13T00:00:00.000Z'),
      status: SaaSSubscriptionStatus.PENDING_PAYMENT,
      plan,
      tenant,
    };
    prisma.saaSInvoice.findUnique.mockResolvedValue({
      id: 'invoice-pending-001',
      tenantId: tenant.id,
      subscriptionId: subscription.id,
      amount: 49,
      currency: CurrencyCode.USD,
      status: SaaSInvoiceStatus.PENDING,
      billingCycle: SaaSBillingCycle.MONTHLY,
      subscription,
    });
    prisma.saaSInvoice.findUniqueOrThrow.mockResolvedValue({
      id: 'invoice-pending-001',
      invoiceNumber: 'INV-SAAS-202611-001',
      tenantId: tenant.id,
      tenant,
      amount: 49,
      currency: CurrencyCode.USD,
      status: SaaSInvoiceStatus.PAID,
      billingCycle: SaaSBillingCycle.MONTHLY,
      paymentMethod: 'JAIB_MANUAL',
      referenceNumber: 'TX-12345',
      paidAt: new Date(),
      dueDate: new Date(),
      createdAt: new Date(),
    });

    const result = await service.markInvoicePaid('invoice-pending-001', {
      paymentMethod: 'JAIB_MANUAL',
      referenceNumber: 'TX-12345',
    }, 'super-admin-id');

    expect(prisma.saaSInvoice.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'invoice-pending-001' }),
        data: expect.objectContaining({ status: SaaSInvoiceStatus.PAID }),
      }),
    );
    expect(prisma.saaSSubscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: subscription.id },
        data: expect.objectContaining({ status: SaaSSubscriptionStatus.ACTIVE }),
      }),
    );
    expect(prisma.saaSTenant.update).toHaveBeenCalledWith({
      where: { id: tenant.id },
      data: { status: SaaSTenantStatus.ACTIVE },
    });
    expect(prisma.auditLog.create).toHaveBeenCalled();
    expect(result.status).toBe(SaaSInvoiceStatus.PAID);
  });

  it('rejects marking an already-paid invoice as paid again', async () => {
    prisma.saaSInvoice.findUnique.mockResolvedValue({
      id: 'invoice-paid',
      status: SaaSInvoiceStatus.PAID,
      tenantId: tenant.id,
    });
    await expect(service.markInvoicePaid('invoice-paid', {
      paymentMethod: 'JAIB_MANUAL',
      referenceNumber: 'TX-ALREADY-PAID',
    }, 'super-admin-id')).rejects.toBeInstanceOf(ConflictException);
  });

  it('filters tenant records in PostgreSQL rather than returning in-memory fixtures', async () => {
    prisma.saaSTenant.findMany.mockResolvedValue([{ ...tenant, subscriptions: [] }]);
    const tenants = await service.getTenants('مأرب', SaaSTenantStatus.PENDING_SETUP);
    expect(prisma.saaSTenant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: SaaSTenantStatus.PENDING_SETUP }),
      }),
    );
    expect(tenants).toHaveLength(1);
    expect(tenants[0].id).toBe(tenant.id);
  });

  it('throws NotFound when a tenant id does not exist in PostgreSQL', async () => {
    prisma.saaSTenant.findUnique.mockResolvedValue(null);
    await expect(service.getTenantById('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('computes MRR from USD subscriptions only and never mixes currencies implicitly', async () => {
    prisma.saaSTenant.count.mockResolvedValue(2);
    prisma.saaSSubscription.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);
    prisma.saaSSubscription.findMany.mockResolvedValue([
      { billingCycle: SaaSBillingCycle.MONTHLY, pricePaid: 49, currency: CurrencyCode.USD },
      { billingCycle: SaaSBillingCycle.ANNUAL, pricePaid: 35000, currency: CurrencyCode.YER },
    ]);
    prisma.saaSInvoice.findMany.mockResolvedValue([
      { amount: 49, currency: CurrencyCode.USD },
      { amount: 10000, currency: CurrencyCode.YER },
    ]);
    prisma.saaSPlan.findMany.mockResolvedValue([plan]);

    const result = await service.getSaaSKpiDashboard();
    expect(result.monthlyRecurringRevenueUsd).toBe(49);
    expect(result.pendingInvoicesAmountUsd).toBe(49);
    expect(result.activeSubscribersCount).toBe(1);
  });

  it('verifies all three full-feature plans from persistent plan records', async () => {
    prisma.saaSPlan.findMany.mockResolvedValue([
      plan,
      { ...plan, id: 'plan-weekly', billingCycle: SaaSBillingCycle.WEEKLY },
      { ...plan, id: 'plan-annual', billingCycle: SaaSBillingCycle.ANNUAL },
    ]);
    const result = await service.verifyAllPlansEqualPermissions();
    expect(result.invariantPassed).toBe(true);
    expect(prisma.saaSPlan.findMany).toHaveBeenCalled();
  });
});
