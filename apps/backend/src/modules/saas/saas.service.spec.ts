import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { SaasService } from './saas.service';
import { PrismaService } from '../../database/prisma.service';
import {
  SaaSBillingCycle,
  SaaSSubscriptionStatus,
  SaaSTenantStatus,
  CurrencyCode,
} from '@digital-topup/shared';

describe('SaasService & Equal Permissions Invariant', () => {
  let service: SaasService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SaasService,
        {
          provide: PrismaService,
          useValue: {
            saaSPlan: {
              findMany: jest.fn().mockResolvedValue([]),
              update: jest.fn().mockResolvedValue({}),
            },
          },
        },
      ],
    }).compile();

    service = module.get<SaasService>(SaasService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return three distinct subscription plans: Weekly, Monthly, and Annual with specific prices', async () => {
    const plans = await service.getPlans();
    expect(plans).toHaveLength(3);

    const weekly = plans.find((p) => p.billingCycle === SaaSBillingCycle.WEEKLY);
    const monthly = plans.find((p) => p.billingCycle === SaaSBillingCycle.MONTHLY);
    const annual = plans.find((p) => p.billingCycle === SaaSBillingCycle.ANNUAL);

    expect(weekly).toBeDefined();
    expect(monthly).toBeDefined();
    expect(annual).toBeDefined();

    // Verify distinct durations and prices
    expect(weekly?.durationDays).toBe(7);
    expect(weekly?.priceUsd).toBe(15.0);
    expect(weekly?.priceYer).toBe(10000.0);

    expect(monthly?.durationDays).toBe(30);
    expect(monthly?.priceUsd).toBe(49.0);
    expect(monthly?.priceYer).toBe(35000.0);

    expect(annual?.durationDays).toBe(365);
    expect(annual?.priceUsd).toBe(450.0);
    expect(annual?.priceYer).toBe(320000.0);
  });

  it('CRITICAL ARCHITECTURAL INVARIANT: all subscription plans must grant 100% identical full permissions', async () => {
    const audit = await service.verifyAllPlansEqualPermissions();
    expect(audit.invariantPassed).toBe(true);

    const plans = await service.getPlans();
    const firstPlanFeatures = plans[0].features;

    for (const plan of plans) {
      expect(plan.hasFullPermissions).toBe(true);
      expect(plan.features.length).toBe(firstPlanFeatures.length);
      // Ensure all features are included (no paywalled or disabled features)
      expect(plan.features.every((f) => f.included)).toBe(true);
    }
  });

  it('should allow super admin to update pricing for a plan while preserving full permissions', async () => {
    const updated = await service.updatePlanPrice('plan-weekly', {
      priceUsd: 18.0,
      priceYer: 12000.0,
      priceSar: 65.0,
    });

    expect(updated.priceUsd).toBe(18.0);
    expect(updated.priceYer).toBe(12000.0);
    expect(updated.priceSar).toBe(65.0);
    expect(updated.hasFullPermissions).toBe(true);
  });

  it('should onboard a new tenant, generate license key, and issue initial paid invoice', async () => {
    const newTenant = await service.createTenant({
      name: 'متجر مأرب الرقمي',
      slug: 'marib-digital',
      ownerName: 'الشيخ صالح المرادي',
      ownerEmail: 'marib@topup.ye',
      ownerPhone: '+967778899001',
      billingCycle: SaaSBillingCycle.MONTHLY,
    });

    expect(newTenant).toBeDefined();
    expect(newTenant.id).toBeDefined();
    expect(newTenant.licenseKey).toContain('LIC-SAAS-MARIB');
    expect(newTenant.status).toBe(SaaSTenantStatus.ACTIVE);
    expect(newTenant.currentSubscription).toBeDefined();
    expect(newTenant.currentSubscription?.billingCycle).toBe(SaaSBillingCycle.MONTHLY);
    expect(newTenant.currentSubscription?.status).toBe(SaaSSubscriptionStatus.ACTIVE);

    // Verify invoice was created
    const invoices = await service.getInvoices();
    const tenantInvoice = invoices.find((i) => i.tenantId === newTenant.id);
    expect(tenantInvoice).toBeDefined();
    expect(tenantInvoice?.amount).toBe(49.0);
  });

  it('should renew an existing tenant subscription with specified cycle and record payment', async () => {
    const tenant = await service.renewSubscription('tenant-102', {
      billingCycle: SaaSBillingCycle.ANNUAL,
      currency: CurrencyCode.USD,
      paymentMethod: 'KURIMI_BANK',
      referenceNumber: 'TX-RENEW-889911',
    });

    expect(tenant.currentSubscription?.billingCycle).toBe(SaaSBillingCycle.ANNUAL);
    expect(tenant.currentSubscription?.status).toBe(SaaSSubscriptionStatus.ACTIVE);
    expect(tenant.currentSubscription?.pricePaid).toBe(450.0);
  });

  it('should compute valid SaaS KPI dashboard metrics (MRR, ARR, active counts)', async () => {
    const kpis = await service.getSaaSKpiDashboard();
    expect(kpis.totalTenantsCount).toBeGreaterThan(0);
    expect(kpis.activeSubscribersCount).toBeGreaterThan(0);
    expect(kpis.monthlyRecurringRevenueUsd).toBeGreaterThan(0);
    expect(kpis.annualRunRateUsd).toBeGreaterThan(0);
    expect(kpis.equalPermissionsPolicyEnforced).toBe(true);
  });

  describe('production safety boundary', () => {
    it('refuses in-memory tenant and invoice operations in production', async () => {
      const previousNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        await expect(service.getTenants()).rejects.toBeInstanceOf(ServiceUnavailableException);
        await expect(service.getInvoices()).rejects.toBeInstanceOf(ServiceUnavailableException);
        await expect(service.getSubscriptions()).rejects.toBeInstanceOf(ServiceUnavailableException);
        await expect(service.getSaaSKpiDashboard()).rejects.toBeInstanceOf(ServiceUnavailableException);
      } finally {
        if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = previousNodeEnv;
      }
    });

    it('does not return fabricated fallback plans when the production database is empty', async () => {
      const previousNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        await expect(service.getPlans()).rejects.toBeInstanceOf(ServiceUnavailableException);
      } finally {
        if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = previousNodeEnv;
      }
    });
  });
});
