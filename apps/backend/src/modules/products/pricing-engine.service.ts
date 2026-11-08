import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '@prisma/client';
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

  constructor(private readonly prisma: PrismaService) {
    if (process.env.NODE_ENV === 'test') {
      this.seedDefaultRules();
    }
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
  async getFxRate(fromCurrency: CurrencyCode, toCurrency: CurrencyCode): Promise<number> {
    if (fromCurrency === toCurrency) return 1;

    try {
      const now = new Date();
      const fxRate = await this.prisma.fxRate.findFirst({
        where: {
          fromCurrency,
          toCurrency,
          effectiveFrom: { lte: now },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
        },
        orderBy: { effectiveFrom: 'desc' },
      });

      if (!fxRate) {
        throw new NotFoundException(
          `No active approved FX rate is configured from ${fromCurrency} to ${toCurrency}.`,
        );
      }

      const rate = Number(fxRate.rate);
      if (!Number.isFinite(rate) || rate <= 0) {
        throw new BadRequestException('The configured FX rate must be a positive finite number.');
      }
      return rate;
    } catch (error: any) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      this.logger.error(`FX rate lookup failed: ${error?.message || error}`);
      throw new ServiceUnavailableException('Pricing cannot convert currencies until an active FX rate is available.');
    }
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

    throw new ServiceUnavailableException(
      'No active matching pricing rule or approved default rule is configured.',
    );
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
    const fxRate = await this.getFxRate(dto.costCurrency, dto.targetCurrency);
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
    if (!Number.isFinite(dto.marginValue) || dto.marginValue < 0) {
      throw new BadRequestException('قيمة هامش الربح لا يمكن أن تكون سالبة أو غير صالحة');
    }
    for (const value of [dto.feeFixed ?? 0, dto.feePercentage ?? 0]) {
      if (!Number.isFinite(value) || value < 0) {
        throw new BadRequestException('رسوم التسعير يجب أن تكون قيماً موجبة وصالحة.');
      }
    }
    if (
      dto.minMargin !== undefined && dto.minMargin !== null &&
      (!Number.isFinite(dto.minMargin) || dto.minMargin < 0)
    ) {
      throw new BadRequestException('الحد الأدنى للهامش غير صالح.');
    }
    if (
      dto.maxMargin !== undefined && dto.maxMargin !== null &&
      (!Number.isFinite(dto.maxMargin) || dto.maxMargin < 0)
    ) {
      throw new BadRequestException('الحد الأعلى للهامش غير صالح.');
    }

    const targetWhere = {
      scope: dto.scope,
      targetId: dto.targetId || null,
    };
    const now = new Date();
    const toMemoryRule = (created: any): InMemoryPriceRule => ({
      id: created.id,
      version: created.version,
      scope: created.scope as PriceRuleScope,
      targetId: created.targetId,
      marginType: created.marginType as MarginType,
      marginValue: Number(created.marginValue),
      minMargin: created.minMargin === null || created.minMargin === undefined ? null : Number(created.minMargin),
      maxMargin: created.maxMargin === null || created.maxMargin === undefined ? null : Number(created.maxMargin),
      feeFixed: Number(created.feeFixed),
      feePercentage: Number(created.feePercentage),
      validFrom: created.validFrom,
      validTo: created.validTo,
      isActive: created.isActive,
      changeReason: created.changeReason,
      createdByUserId: created.createdByUserId,
      createdAt: created.createdAt,
    });

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const versions = await tx.priceRuleVersion.findMany({
          where: targetWhere,
          orderBy: { version: 'desc' },
        });
        const nextVersion = versions.reduce(
          (max: number, rule: any) => Math.max(max, Number(rule.version) || 0),
          0,
        ) + 1;

        await tx.priceRuleVersion.updateMany({
          where: { ...targetWhere, isActive: true },
          data: { isActive: false, validTo: now },
        });

        return tx.priceRuleVersion.create({
          data: {
            version: nextVersion,
            scope: dto.scope,
            targetId: dto.targetId || null,
            marginType: dto.marginType,
            marginValue: dto.marginValue,
            minMargin: dto.minMargin ?? null,
            maxMargin: dto.maxMargin ?? null,
            feeFixed: dto.feeFixed ?? 0,
            feePercentage: dto.feePercentage ?? 0,
            validFrom: dto.validFrom ? new Date(dto.validFrom) : now,
            validTo: dto.validTo ? new Date(dto.validTo) : null,
            isActive: true,
            changeReason: dto.changeReason.trim(),
            createdByUserId: userId,
          },
        });
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });

      const rule = toMemoryRule(created);
      if (process.env.NODE_ENV === 'test') {
        for (const existing of this.memoryRules.values()) {
          if (existing.scope === dto.scope && (existing.targetId || null) === (dto.targetId || null) && existing.isActive) {
            this.memoryRules.set(existing.id, { ...existing, isActive: false, validTo: now });
          }
        }
        this.memoryRules.set(rule.id, rule);
      }
      return rule;
    } catch (err: any) {
      if (process.env.NODE_ENV !== 'test') {
        this.logger.error(`Price rule transaction failed: ${err?.message || err}`);
        throw new ServiceUnavailableException('Pricing rules could not be saved atomically.');
      }

      const existingRules = Array.from(this.memoryRules.values()).filter(
        (rule) => rule.scope === dto.scope && (rule.targetId || null) === (dto.targetId || null),
      );
      const nextVersion = existingRules.reduce((max, rule) => Math.max(max, rule.version), 0) + 1;
      for (const rule of existingRules) {
        if (rule.isActive) {
          this.memoryRules.set(rule.id, { ...rule, isActive: false, validTo: now });
        }
      }

      const memoryRule: InMemoryPriceRule = {
        id: `test-prule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        version: nextVersion,
        scope: dto.scope,
        targetId: dto.targetId || null,
        marginType: dto.marginType,
        marginValue: dto.marginValue,
        minMargin: dto.minMargin ?? null,
        maxMargin: dto.maxMargin ?? null,
        feeFixed: dto.feeFixed ?? 0,
        feePercentage: dto.feePercentage ?? 0,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : now,
        validTo: dto.validTo ? new Date(dto.validTo) : null,
        isActive: true,
        changeReason: dto.changeReason.trim(),
        createdByUserId: userId,
        createdAt: now,
      };
      this.memoryRules.set(memoryRule.id, memoryRule);
      return memoryRule;
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

      const mapped = dbRules.map((r) => ({
        id: r.id,
        version: r.version,
        scope: r.scope as PriceRuleScope,
        targetId: r.targetId,
        marginType: r.marginType as MarginType,
        marginValue: Number(r.marginValue),
        minMargin: r.minMargin === null || r.minMargin === undefined ? null : Number(r.minMargin),
        maxMargin: r.maxMargin === null || r.maxMargin === undefined ? null : Number(r.maxMargin),
        feeFixed: Number(r.feeFixed),
        feePercentage: Number(r.feePercentage),
        validFrom: r.validFrom,
        validTo: r.validTo,
        isActive: r.isActive,
        changeReason: r.changeReason,
        createdByUserId: r.createdByUserId,
        createdAt: r.createdAt,
      }));
      if (mapped.length > 0 || process.env.NODE_ENV !== 'test') return mapped;
    } catch (error: any) {
      if (process.env.NODE_ENV !== 'test' || getCurrentTenantId()) {
        this.logger.error(`Tenant pricing rule query failed: ${error?.message || error}`);
        throw new ServiceUnavailableException('Tenant pricing rules are unavailable from the database.');
      }
      this.logger.warn(`Test-only in-memory pricing rule fallback: ${error?.message || error}`);
    }

    if (process.env.NODE_ENV !== 'test') {
      throw new ServiceUnavailableException('Pricing rules are unavailable from the database.');
    }
    return Array.from(this.memoryRules.values())
      .filter((rule) => rule.isActive)
      .sort((a, b) => b.version - a.version);
  }
}
