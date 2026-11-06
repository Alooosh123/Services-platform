import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { getCurrentTenantId } from '../../tenant/tenant-context.store';
import {
  CurrencyCode,
  PriceRuleScope,
  MarginType,
  CreatePriceRuleDto,
  PricePreviewDto,
  PricePreviewResult,
} from '@digital-topup/shared';

export interface InMemoryPriceRule {
  id: string;
  version: number;
  scope: PriceRuleScope;
  targetId?: string | null;
  marginType: MarginType;
  marginValue: number;
  minMargin?: number | null;
  maxMargin?: number | null;
  feeFixed: number;
  feePercentage: number;
  validFrom: Date;
  validTo?: Date | null;
  isActive: boolean;
  changeReason: string;
  createdByUserId?: string | null;
  createdAt: Date;
}

@Injectable()
export class PricingEngineService {
  private readonly logger = new Logger(PricingEngineService.name);

  // In-memory fallback repository for resilience and unit testing
  private memoryRules: Map<string, InMemoryPriceRule> = new Map();

  // Exchange rates relative to USD (USD = 1.0)
  private readonly defaultFxRates: Record<CurrencyCode, number> = {
    [CurrencyCode.USD]: 1.0,
    [CurrencyCode.YER]: 530.0, // Standard market conversion rate
    [CurrencyCode.SAR]: 3.75,  // Standard pegged SAR conversion rate
  };

  constructor(private readonly prisma: PrismaService) {
    this.seedDefaultRules();
  }

  private seedDefaultRules() {
    const defaultRule: InMemoryPriceRule = {
      id: 'prule-default-01',
      version: 1,
      scope: PriceRuleScope.DEFAULT,
      targetId: null,
      marginType: MarginType.PERCENTAGE,
      marginValue: 10.0, // 10% default margin
      minMargin: 5.0,
      maxMargin: 50.0,
      feeFixed: 0,
      feePercentage: 1.0, // 1% validated processing fee
      validFrom: new Date('2026-01-01'),
      validTo: null,
      isActive: true,
      changeReason: 'القاعدة الافتراضية الأولية للمنصة (Default 10% Margin Policy)',
      createdByUserId: 'system',
      createdAt: new Date(),
    };
    this.memoryRules.set(defaultRule.id, defaultRule);
  }

  /**
   * Calculate FX exchange rate between two currencies safely
   */
  getFxRate(fromCurrency: CurrencyCode, toCurrency: CurrencyCode): number {
    if (fromCurrency === toCurrency) return 1.0;
    const fromRateToUsd = this.defaultFxRates[fromCurrency] || 1.0;
    const toRateToUsd = this.defaultFxRates[toCurrency] || 1.0;
    return toRateToUsd / fromRateToUsd;
  }

  /**
   * Find matching price rule using hierarchical resolution:
   * PRODUCT -> SERVICE -> CATEGORY -> DEFAULT
   */
  async findMatchingRule(
    scope?: PriceRuleScope,
    targetId?: string,
    serviceId?: string,
    categoryId?: string,
  ): Promise<InMemoryPriceRule> {
    const allRules = await this.getAllActiveRules();

    // 1. If explicit PRODUCT targetId provided
    if (scope === PriceRuleScope.PRODUCT && targetId) {
      const productRule = allRules.find(
        (r) => r.scope === PriceRuleScope.PRODUCT && r.targetId === targetId && r.isActive,
      );
      if (productRule) return productRule;
    }

    // 2. If SERVICE rule exists
    const sId = scope === PriceRuleScope.SERVICE ? targetId : serviceId;
    if (sId) {
      const serviceRule = allRules.find(
        (r) => r.scope === PriceRuleScope.SERVICE && r.targetId === sId && r.isActive,
      );
      if (serviceRule) return serviceRule;
    }

    // 3. If CATEGORY rule exists
    const cId = scope === PriceRuleScope.CATEGORY ? targetId : categoryId;
    if (cId) {
      const categoryRule = allRules.find(
        (r) => r.scope === PriceRuleScope.CATEGORY && r.targetId === cId && r.isActive,
      );
      if (categoryRule) return categoryRule;
    }

    // 4. Default System Rule
    const defaultRule = allRules.find(
      (r) => r.scope === PriceRuleScope.DEFAULT && r.isActive,
    );
    if (defaultRule) return defaultRule;

    // Fallback emergency rule
    return {
      id: 'emergency-rule',
      version: 1,
      scope: PriceRuleScope.DEFAULT,
      targetId: null,
      marginType: MarginType.PERCENTAGE,
      marginValue: 10.0,
      feeFixed: 0,
      feePercentage: 0,
      validFrom: new Date(),
      validTo: null,
      isActive: true,
      changeReason: 'Emergency Fallback Rule',
      createdAt: new Date(),
    };
  }

  /**
   * Preview price calculation:
   * Formula: Retail = Cost + Validated Fees + Policy Margin
   */
  async calculatePrice(
    dto: PricePreviewDto & { serviceId?: string; categoryId?: string },
  ): Promise<PricePreviewResult> {
    const cost = Number(dto.costPrice);
    if (isNaN(cost) || cost <= 0) {
      throw new BadRequestException('تكلفة الشراء يجب أن تكون رقماً موجباً أكبر من الصفر');
    }

    const rule = await this.findMatchingRule(
      dto.scope,
      dto.targetId,
      dto.serviceId,
      dto.categoryId,
    );

    // 1. Currency Conversion
    const fxRate = this.getFxRate(dto.costCurrency, dto.targetCurrency);
    const convertedCost = cost * fxRate;

    // 2. Fees Calculation
    const feeFixed = Number(rule.feeFixed || 0);
    const feePercentage = Number(rule.feePercentage || 0);
    const calculatedFees = feeFixed + (convertedCost * (feePercentage / 100));

    // 3. Margin Calculation
    let appliedMargin = 0;
    if (rule.marginType === MarginType.PERCENTAGE) {
      appliedMargin = convertedCost * (Number(rule.marginValue) / 100);
    } else {
      appliedMargin = Number(rule.marginValue) * fxRate;
    }

    // Apply min/max margin constraints if defined
    if (rule.minMargin !== null && rule.minMargin !== undefined) {
      const minVal = Number(rule.minMargin) * (rule.marginType === MarginType.PERCENTAGE ? (convertedCost / 100) : fxRate);
      if (appliedMargin < minVal) appliedMargin = minVal;
    }
    if (rule.maxMargin !== null && rule.maxMargin !== undefined) {
      const maxVal = Number(rule.maxMargin) * (rule.marginType === MarginType.PERCENTAGE ? (convertedCost / 100) : fxRate);
      if (appliedMargin > maxVal) appliedMargin = maxVal;
    }

    // 4. Recommended Retail Price
    const recommendedRetailPrice = Math.round((convertedCost + calculatedFees + appliedMargin) * 100) / 100;
    const netEstimatedProfit = Math.round((recommendedRetailPrice - convertedCost - calculatedFees) * 100) / 100;
    const profitPercentage = Math.round(((netEstimatedProfit / convertedCost) * 100) * 10) / 10;

    return {
      costPrice: cost,
      costCurrency: dto.costCurrency,
      targetCurrency: dto.targetCurrency,
      fxRateUsed: fxRate,
      calculatedFees: Math.round(calculatedFees * 100) / 100,
      appliedMargin: Math.round(appliedMargin * 100) / 100,
      marginType: rule.marginType,
      recommendedRetailPrice,
      netEstimatedProfit,
      profitPercentage,
      matchedRuleId: rule.id,
      matchedScope: rule.scope,
    };
  }

  /**
   * Admin: Create a new versioned price rule (Immutable Audit History)
   */
  async createPriceRule(
    userId: string,
    dto: CreatePriceRuleDto,
  ): Promise<InMemoryPriceRule> {
    if (!dto.changeReason || dto.changeReason.trim().length === 0) {
      throw new BadRequestException('سبب تعديل/إصدار قاعدة التسعير مطلوب إجبارياً للرقابة المالية والتدقيق');
    }

    if (dto.marginValue < 0) {
      throw new BadRequestException('قيمة هامش الربح لا يمكن أن تكون سالبة (حظر البيع بخسارة)');
    }

    // Calculate version number & deactivate previous active versions for this target
    const existingRules = await this.getAllActiveRules();
    const targetRules = existingRules.filter(
      (r) => r.scope === dto.scope && (dto.targetId ? r.targetId === dto.targetId : !r.targetId),
    );
    const nextVersion = targetRules.length + 1;

    for (const r of targetRules) {
      if (r.isActive) {
        this.memoryRules.set(r.id, { ...r, isActive: false, validTo: new Date() });
      }
    }

    try {
      await this.prisma.priceRuleVersion.updateMany({
        where: {
          scope: dto.scope,
          targetId: dto.targetId || null,
          isActive: true,
        },
        data: {
          isActive: false,
          validTo: new Date(),
        },
      });

      const created = await this.prisma.priceRuleVersion.create({
        data: {
          version: nextVersion,
          scope: dto.scope,
          targetId: dto.targetId || null,
          marginType: dto.marginType,
          marginValue: dto.marginValue,
          minMargin: dto.minMargin || null,
          maxMargin: dto.maxMargin || null,
          feeFixed: dto.feeFixed || 0,
          feePercentage: dto.feePercentage || 0,
          validFrom: dto.validFrom ? new Date(dto.validFrom) : new Date(),
          validTo: dto.validTo ? new Date(dto.validTo) : null,
          isActive: true,
          changeReason: dto.changeReason,
          createdByUserId: userId,
        },
      });

      // Mirror to memory
      const memRule: InMemoryPriceRule = {
        id: created.id,
        version: created.version,
        scope: created.scope as PriceRuleScope,
        targetId: created.targetId,
        marginType: created.marginType as MarginType,
        marginValue: Number(created.marginValue),
        minMargin: created.minMargin ? Number(created.minMargin) : null,
        maxMargin: created.maxMargin ? Number(created.maxMargin) : null,
        feeFixed: Number(created.feeFixed),
        feePercentage: Number(created.feePercentage),
        validFrom: created.validFrom,
        validTo: created.validTo,
        isActive: created.isActive,
        changeReason: created.changeReason,
        createdByUserId: created.createdByUserId,
        createdAt: created.createdAt,
      };
      this.memoryRules.set(created.id, memRule);
      return memRule;
    } catch (err: any) {
      if (process.env.NODE_ENV === 'production' || getCurrentTenantId()) {
        this.logger.error(`Price rule persistence failed: ${err?.message || err}`);
        throw new ServiceUnavailableException('Tenant pricing rules are unavailable from the database.');
      }
      this.logger.warn(`Local unscoped development pricing rule fallback (${err?.message})`);

      const newId = `prule-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const memRule: InMemoryPriceRule = {
        id: newId,
        version: nextVersion,
        scope: dto.scope,
        targetId: dto.targetId || null,
        marginType: dto.marginType,
        marginValue: dto.marginValue,
        minMargin: dto.minMargin || null,
        maxMargin: dto.maxMargin || null,
        feeFixed: dto.feeFixed || 0,
        feePercentage: dto.feePercentage || 0,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : new Date(),
        validTo: dto.validTo ? new Date(dto.validTo) : null,
        isActive: true,
        changeReason: dto.changeReason,
        createdByUserId: userId,
        createdAt: new Date(),
      };
      this.memoryRules.set(newId, memRule);
      return memRule;
    }
  }

  /**
   * Get all active pricing rules
   */
  async getAllActiveRules(): Promise<InMemoryPriceRule[]> {
    try {
      const dbRules = await this.prisma.priceRuleVersion.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
      });

      if (dbRules.length > 0 || process.env.NODE_ENV === 'production' || getCurrentTenantId()) {
        return dbRules.map((r) => ({
          id: r.id,
          version: r.version,
          scope: r.scope as PriceRuleScope,
          targetId: r.targetId,
          marginType: r.marginType as MarginType,
          marginValue: Number(r.marginValue),
          minMargin: r.minMargin ? Number(r.minMargin) : null,
          maxMargin: r.maxMargin ? Number(r.maxMargin) : null,
          feeFixed: Number(r.feeFixed),
          feePercentage: Number(r.feePercentage),
          validFrom: r.validFrom,
          validTo: r.validTo,
          isActive: r.isActive,
          changeReason: r.changeReason,
          createdByUserId: r.createdByUserId,
          createdAt: r.createdAt,
        }));
      }
    } catch (error: any) {
      if (process.env.NODE_ENV === 'production' || getCurrentTenantId()) {
        this.logger.error(`Tenant pricing rule query failed: ${error?.message || error}`);
        throw new ServiceUnavailableException('Tenant pricing rules are unavailable from the database.');
      }
      this.logger.warn('Local unscoped development pricing rules fallback.');
    }

    return Array.from(this.memoryRules.values())
      .filter((r) => r.isActive)
      .sort((a, b) => b.version - a.version);
  }
}
