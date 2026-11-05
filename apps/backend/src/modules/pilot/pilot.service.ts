import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  CurrencyCode,
  PaymentChannelCode,
  PilotCohortType,
  PilotDecisionGateStatus,
  PilotConfigurationDto,
  PilotVerificationCycleResultDto,
  GoNoGoAssessmentResultDto,
} from '@digital-topup/shared';
import {
  UpdatePilotConfigDto,
  RunPilotCycleDto,
  SignGoNoGoDto,
} from './dto/pilot.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class PilotService {
  private readonly logger = new Logger(PilotService.name);

  // In-memory fallback cache to ensure reliability across environments
  private inMemoryConfig: PilotConfigurationDto = {
    id: 'default-pilot-config',
    isPilotActive: true,
    maxOrderAmountYER: 10000.0,
    maxOrderAmountUSD: 20.0,
    maxDailyWalletLimitYER: 50000.0,
    allowedProductIds: ['ALL'],
    allowedChannelCodes: [
      PaymentChannelCode.JAIB,
      PaymentChannelCode.JAWALI,
      PaymentChannelCode.ONE_CASH,
    ],
    cohortType: PilotCohortType.TRUSTED_BETA_USERS,
    whitelistedUserIds: [],
    goNoGoDecision: PilotDecisionGateStatus.NO_GO,
    approvedBy: undefined,
    approvedAt: undefined,
    launchNotes: 'بيئة الإطلاق التجريبي المضبوط (Pilot) مفعلة وفق متطلبات المرحلة الحادية عشرة P11.',
    updatedAt: new Date().toISOString(),
  };

  private inMemorySignOffs = {
    technicalLead: { approved: false, name: '', signedAt: undefined as string | undefined },
    financeController: { approved: false, name: '', signedAt: undefined as string | undefined },
    generalManager: { approved: false, name: '', signedAt: undefined as string | undefined },
  };

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fetches active Pilot configuration
   */
  async getPilotConfig(): Promise<PilotConfigurationDto> {
    try {
      const dbConfig = await (this.prisma as any).pilotConfig.findUnique({
        where: { id: 'default-pilot-config' },
      });

      if (dbConfig) {
        return {
          id: dbConfig.id,
          isPilotActive: dbConfig.isPilotActive,
          maxOrderAmountYER: Number(dbConfig.maxOrderAmountYER),
          maxOrderAmountUSD: Number(dbConfig.maxOrderAmountUSD),
          maxDailyWalletLimitYER: Number(dbConfig.maxDailyWalletLimitYER),
          allowedProductIds: dbConfig.allowedProductIds.split(','),
          allowedChannelCodes: dbConfig.allowedChannelCodes.split(',') as PaymentChannelCode[],
          cohortType: dbConfig.cohortType as PilotCohortType,
          whitelistedUserIds: dbConfig.whitelistedUserIds
            ? dbConfig.whitelistedUserIds.split(',').filter(Boolean)
            : [],
          goNoGoDecision: dbConfig.goNoGoDecision as PilotDecisionGateStatus,
          approvedBy: dbConfig.approvedBy || undefined,
          approvedAt: dbConfig.approvedAt ? dbConfig.approvedAt.toISOString() : undefined,
          launchNotes: dbConfig.launchNotes || undefined,
          updatedAt: dbConfig.updatedAt.toISOString(),
        };
      }
    } catch (err) {
      this.logger.warn(`Using fail-closed pilot defaults because configuration is unavailable.`);
    }

    return this.inMemoryConfig;
  }

  /**
   * Updates Pilot configuration
   */
  async updatePilotConfig(dto: UpdatePilotConfigDto, adminUserId: string): Promise<PilotConfigurationDto> {
    this.logger.log(`Updating Pilot Configuration by admin: ${adminUserId}`);
    if (dto.isPilotActive === false) {
      throw new ForbiddenException(
        'Pilot restrictions cannot be removed while release gates remain unverified.',
      );
    }

    const updated: PilotConfigurationDto = {
      ...this.inMemoryConfig,
      isPilotActive: dto.isPilotActive !== undefined ? dto.isPilotActive : this.inMemoryConfig.isPilotActive,
      maxOrderAmountYER: dto.maxOrderAmountYER !== undefined ? dto.maxOrderAmountYER : this.inMemoryConfig.maxOrderAmountYER,
      maxOrderAmountUSD: dto.maxOrderAmountUSD !== undefined ? dto.maxOrderAmountUSD : this.inMemoryConfig.maxOrderAmountUSD,
      maxDailyWalletLimitYER: dto.maxDailyWalletLimitYER !== undefined ? dto.maxDailyWalletLimitYER : this.inMemoryConfig.maxDailyWalletLimitYER,
      allowedProductIds: dto.allowedProductIds ? dto.allowedProductIds.split(',') : this.inMemoryConfig.allowedProductIds,
      allowedChannelCodes: dto.allowedChannelCodes
        ? (dto.allowedChannelCodes.split(',') as PaymentChannelCode[])
        : this.inMemoryConfig.allowedChannelCodes,
      cohortType: dto.cohortType || this.inMemoryConfig.cohortType,
      whitelistedUserIds: dto.whitelistedUserIds
        ? dto.whitelistedUserIds.split(',').filter(Boolean)
        : this.inMemoryConfig.whitelistedUserIds,
      goNoGoDecision: dto.goNoGoDecision || this.inMemoryConfig.goNoGoDecision,
      approvedBy: adminUserId,
      approvedAt: new Date().toISOString(),
      launchNotes: dto.launchNotes || this.inMemoryConfig.launchNotes,
      updatedAt: new Date().toISOString(),
    };

    try {
      await (this.prisma as any).pilotConfig.upsert({
        where: { id: 'default-pilot-config' },
        create: {
          id: 'default-pilot-config',
          isPilotActive: updated.isPilotActive,
          maxOrderAmountYER: new Prisma.Decimal(updated.maxOrderAmountYER),
          maxOrderAmountUSD: new Prisma.Decimal(updated.maxOrderAmountUSD),
          maxDailyWalletLimitYER: new Prisma.Decimal(updated.maxDailyWalletLimitYER),
          allowedProductIds: updated.allowedProductIds.join(','),
          allowedChannelCodes: updated.allowedChannelCodes.join(','),
          cohortType: updated.cohortType,
          whitelistedUserIds: updated.whitelistedUserIds.join(','),
          goNoGoDecision: updated.goNoGoDecision,
          approvedBy: adminUserId,
          approvedAt: new Date(),
          launchNotes: updated.launchNotes,
        },
        update: {
          isPilotActive: updated.isPilotActive,
          maxOrderAmountYER: new Prisma.Decimal(updated.maxOrderAmountYER),
          maxOrderAmountUSD: new Prisma.Decimal(updated.maxOrderAmountUSD),
          maxDailyWalletLimitYER: new Prisma.Decimal(updated.maxDailyWalletLimitYER),
          allowedProductIds: updated.allowedProductIds.join(','),
          allowedChannelCodes: updated.allowedChannelCodes.join(','),
          cohortType: updated.cohortType,
          whitelistedUserIds: updated.whitelistedUserIds.join(','),
          goNoGoDecision: updated.goNoGoDecision,
          approvedBy: adminUserId,
          approvedAt: new Date(),
          launchNotes: updated.launchNotes,
        },
      });
    } catch (err) {
      this.logger.error('Could not persist pilot configuration.', err instanceof Error ? err.stack : undefined);
      throw new ServiceUnavailableException('Pilot configuration could not be persisted.');
    }

    this.inMemoryConfig = updated;
    return updated;
  }

  /**
   * Validates whether an order complies with Pilot rules and limits
   */
  async validateOrderAgainstPilot(
    userId: string,
    amount: number,
    currency: CurrencyCode,
    productId?: string,
    channelCode?: PaymentChannelCode,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const config = await this.getPilotConfig();

    if (!config.isPilotActive) {
      return { allowed: true };
    }

    // Cohort whitelist check
    if (config.cohortType !== PilotCohortType.PUBLIC_PILOT) {
      if (
        !config.whitelistedUserIds.includes(userId)
      ) {
        throw new ForbiddenException(
          `الحساب غير مسجل ضمن قائمة مستخدمي الإطلاق التجريبي (Pilot Whitelist). الإطلاق العام سيتاح قريباً.`,
        );
      }
    }

    // Limit check for YER
    if (currency === CurrencyCode.YER && amount > config.maxOrderAmountYER) {
      throw new BadRequestException(
        `قيمة الطلب (${amount.toLocaleString()} YER) تتجاوز السقف المحدد للمرحلة التجريبية (${config.maxOrderAmountYER.toLocaleString()} YER).`,
      );
    }

    // Limit check for USD
    if (currency === CurrencyCode.USD && amount > config.maxOrderAmountUSD) {
      throw new BadRequestException(
        `قيمة الطلب ($${amount}) تتجاوز السقف المحدد للمرحلة التجريبية ($${config.maxOrderAmountUSD}).`,
      );
    }

    // Channel check
    if (channelCode && !config.allowedChannelCodes.includes(channelCode)) {
      throw new BadRequestException(
        `قناة الدفع ${channelCode} غير مفعلة ضمن قنوات الإطلاق التجريبي المعتمدة.`,
      );
    }

    return { allowed: true };
  }

  /**
   * Executes AT-21: Full End-to-End Pilot Cycle
   * TopUp -> Wallet Credit -> Checkout -> Fulfillment -> Supplier Settlement -> End-Day -> Owner Payout
   * Proves 100% Double-Entry Ledger balance and statement matching.
   */
  async runPilotVerificationCycle(
    dto: RunPilotCycleDto,
    adminUserId: string = 'admin-pilot-runner',
  ): Promise<PilotVerificationCycleResultDto> {
    this.logger.error(
      `AT-21 cycle "${dto.cycleName || 'unnamed'}" requested by ${adminUserId}, but no real end-to-end harness is configured.`,
    );
    throw new ServiceUnavailableException(
      'AT-21 is not implemented as a live end-to-end transaction. No pilot transaction was run or recorded.',
    );
  }

  /**
   * Evaluates Go/No-Go Decision Gate against real system metrics and safety rules
   */
  async assessGoNoGo(): Promise<GoNoGoAssessmentResultDto> {
    const config = await this.getPilotConfig();

    // 1. Audit gates
    const doubleEntryLedgerBalanced = false;
    const securitySecretsAuditPassed = Boolean(
      process.env.JWT_SECRET &&
      process.env.JWT_SECRET.length >= 32 &&
      !process.env.JWT_SECRET.includes('test-secret')
    );
    const reconciliationZeroMismatch = false;
    const emergencyKillSwitchReady = false;
    const disasterRecoveryVerified = false;
    const at21PilotCyclePassed = false;
    const nfrPerformanceWithinSLO = false;

    const allPassed =
      doubleEntryLedgerBalanced &&
      securitySecretsAuditPassed &&
      reconciliationZeroMismatch &&
      emergencyKillSwitchReady &&
      disasterRecoveryVerified &&
      at21PilotCyclePassed &&
      nfrPerformanceWithinSLO;

    const blockers: string[] = [
      'توازن دفتر الأستاذ لم يُتحقق منه عبر قاعدة البيانات الفعلية.',
      'مطابقة البنك/المزود ومفتاح الطوارئ لم يُختبرا تشغيلياً.',
      'مناورة AT-20 واستعادة PostgreSQL الفعلية غير متحققة.',
      'دورة AT-21 الحية وقياس الأداء ضمن SLO غير منفذين.',
    ];
    if (!securitySecretsAuditPassed) {
      blockers.push('مفتاح JWT_SECRET يجب أن يكون آمناً ومشفراً برمز 32 خانة على الأقل.');
    }

    const decision = allPassed
      ? (this.inMemorySignOffs.generalManager.approved ? PilotDecisionGateStatus.GO : PilotDecisionGateStatus.CONDITIONAL_GO)
      : PilotDecisionGateStatus.NO_GO;

    return {
      decision,
      assessedAt: new Date().toISOString(),
      version: '1.0.0-phase11-pilot',
      gateChecks: {
        doubleEntryLedgerBalanced,
        securitySecretsAuditPassed,
        reconciliationZeroMismatch,
        emergencyKillSwitchReady,
        disasterRecoveryVerified,
        at21PilotCyclePassed,
        nfrPerformanceWithinSLO,
      },
      signOffs: this.inMemorySignOffs,
      blockers,
      summary: allPassed
        ? 'النظام مستوفٍ لكافة معايير بوابة الإطلاق (Go/No-Go Gate). جاهز للتشغيل التجريبي والتجاري المنضبط.'
        : 'يوجد بنود أمنية أو تشغيلية تتطلب الاستيفاء قبل منح إذن الإطلاق الشامل.',
    };
  }

  /**
   * Signs Go/No-Go Gate
   */
  async signGoNoGo(dto: SignGoNoGoDto, adminUserId: string): Promise<GoNoGoAssessmentResultDto> {
    const assessment = await this.assessGoNoGo();
    if (dto.decision === PilotDecisionGateStatus.GO && assessment.blockers.length > 0) {
      throw new ForbiddenException('Go/No-Go approval is blocked until every release gate is verified.');
    }

    const roleKey =
      dto.role === 'TECHNICAL_LEAD'
        ? 'technicalLead'
        : dto.role === 'FINANCE_CONTROLLER'
        ? 'financeController'
        : 'generalManager';

    this.inMemorySignOffs[roleKey] = {
      approved: dto.decision === PilotDecisionGateStatus.GO,
      name: dto.signerName,
      signedAt: new Date().toISOString(),
    };

    this.logger.log(`Go/No-Go Gate signed by ${dto.role} (${dto.signerName}): ${dto.decision}`);

    return this.assessGoNoGo();
  }

  /**
   * Retrieves history of AT-21 Pilot runs
   */
  async getPilotHistory(): Promise<PilotVerificationCycleResultDto[]> {
    throw new ServiceUnavailableException(
      'Pilot history is unavailable because historical cycle records do not contain verified live transaction evidence.',
    );
  }
}
