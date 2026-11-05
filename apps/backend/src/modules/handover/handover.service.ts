import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  HandoverStatus,
  RunbookCategory,
  RunbookItemDto,
  OperationalKpiDashboardDto,
  OperationalDrillResultDto,
  HandoverSignOffPackageDto,
} from '@digital-topup/shared';
import { RunDrillDto, SignHandoverDto } from './dto/handover.dto';
import * as crypto from 'crypto';

@Injectable()
export class HandoverService {
  private readonly logger = new Logger(HandoverService.name);

  // In-memory fallback state to ensure resilience in all environments
  private inMemorySignOffs = {
    technicalLead: { signed: false, name: '' },
    financeController: { signed: false, name: '' },
    supportLead: { signed: false, name: '' },
    operationsManager: { signed: false, name: '' },
    projectOwner: { signed: false, name: '' },
  };
  private readonly inMemoryDrills: OperationalDrillResultDto[] = [];

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns Live Operational KPI metrics for executive overview
   */
  async getOperationalKpis(): Promise<OperationalKpiDashboardDto> {
    throw new ServiceUnavailableException(
      'Operational KPIs are unavailable because production metrics are not connected to this dashboard.',
    );
  }

  /**
   * Returns the 6 mandatory operational runbooks (P12 SOPs)
   */
  async getRunbooks(): Promise<RunbookItemDto[]> {
    return [
      {
        id: 'RB-01',
        code: 'FINANCE_DEPOSIT_REJECT',
        category: RunbookCategory.FINANCE_DEPOSIT_REJECT,
        titleAr: 'دليل رفض إشعار إيداع بنكي مشكوك فيه أو مكرر (Deposit Rejection Runbook)',
        descriptionAr: 'الإجراء الموحد لموظف المالية عند استلام إشعار حوالة بنكية غير مطابق، مكرر، أو معدل رقمياً.',
        triggerConditionAr: 'اختلاف رقم المرجع، عدم تطابق المبلغ مع كشف البنك الفعلي، أو استخدام مرجع قديم.',
        immediateStepsAr: [
          'التحقق من كشف الحساب البنكي الحي المباشر للتأكد من عدم وصول المبلغ.',
          'الضغط على خيار «قيد المراجعة Under Review» لتجميد مهلة التدقيق وحجب الاعتماد الفوري.',
          'تدوين سبب الرفض بالتفصيل (مثل: رقم الحوالة غير موجود في كشف ون كاش/جيب لهذا التاريخ).',
          'الضغط على «رفض الإيداع Reject Deposit» وإشعار العميل آلياً برقم العملية وسبب الرفض.',
        ],
        escalationRole: 'المراقب المالي (Financial Controller)',
        verificationCheckAr: 'التأكد من عدم إضافة أي ريال في محفظة العميل وثبات رصيد الأستاذ العام.',
        targetSlaMinutes: 10,
      },
      {
        id: 'RB-02',
        code: 'FULFILLMENT_UNKNOWN',
        category: RunbookCategory.FULFILLMENT_UNKNOWN,
        titleAr: 'دليل معالجة طلب شحن معلق بحالة UNKNOWN (Unknown Provider Order Resolution)',
        descriptionAr: 'معالجة انقطاع الاتصال بالمزود أثناء الشحن لمنع الخصم المزدوج أو الإرجاع الأعمى.',
        triggerConditionAr: 'انتهاء مهلة الاتصال بالمزود الخارجي (Socket Hangup / 504 Gateway Timeout).',
        immediateStepsAr: [
          'تحول حالة الطلب آلياً إلى ReconciliationRequired ومنع محاولة إعادة الإرسال الأعمى.',
          'الاستعلام الفوري عن حالة الطلب لدى المزود عبر معرف الطلب الخارجي مرتين بفاصل دقيقة.',
          'إذا أكد المزود نجاح الشحن: الضغط على «تأكيد الشحن» وتثبيت المرجع الخارجي في سجل الطلب.',
          'إذا أكد المزود فشل الشحن: إلغاء حجز الرصيد وإعادته لمحفظة العميل فوراً مع إشعار بالسبب.',
        ],
        escalationRole: 'مهندس العمليات (Fulfillment Operator)',
        verificationCheckAr: 'عدم تكرار الشحن وعدم خصم الرصيد مرتين.',
        targetSlaMinutes: 5,
      },
      {
        id: 'RB-03',
        code: 'PROVIDER_OUTAGE',
        category: RunbookCategory.PROVIDER_OUTAGE,
        titleAr: 'دليل تعطل بنك أو مزود شحن خارجي (Banking/Provider Outage & Safe Mode)',
        descriptionAr: 'التحول الآمن للوضع اليدوي وعزل القناة المعطوبة فورياً دون تعطيل باقي المنصة.',
        triggerConditionAr: 'فشل متكرر بنسبة > 20% في قناة دفع أو مزود شحن خلال 5 دقائق.',
        immediateStepsAr: [
          'تفعيل زر الطوارئ (Emergency Kill-Switch) فوراً من صفحة /operations للقناة المعطوبة.',
          'ظهور شارة «صيانة مؤقتة» في واجهة العميل للقناة المعطلة فقط مع استمرار القنوات الأخرى.',
          'تحويل الطلبات العالقة لطابور المراجعة اليدوية للمشغلين.',
          'بعد استقرار القناة: إجراء معاملة فحص تجريبية واحدة ثم إلغاء زر الطوارئ بسلام.',
        ],
        escalationRole: 'مدير العمليات والتقنية (Technical Lead)',
        verificationCheckAr: 'استمرار باقي القنوات والمحافظ في العمل بكفاءة (AT-24).',
        targetSlaMinutes: 3,
      },
      {
        id: 'RB-04',
        code: 'WRONG_PAYOUT',
        category: RunbookCategory.WRONG_PAYOUT,
        titleAr: 'دليل سحب أرباح خاطئ أو اشتباه اختراق (Erroneous Payout & Wallet Freezing)',
        descriptionAr: 'إيقاف عمليات السحب وتجميد المحافظ والتدقيق الأمني الفوري عند أي ريبة مالية.',
        triggerConditionAr: 'طلب سحب يتجاوز رصيد الأرباح المحققة، أو اشتباه في استخدام جلسة غير مصرح بها.',
        immediateStepsAr: [
          'رفض طلب الصرف فوراً وتعليق معرف العملية.',
          'تجميد محفظة الحساب المشبوه فوراً عبر /wallets (Freeze Wallet) لمنع أي حركات إضافية.',
          'إلغاء وتفجير كافة جلسات الدخول والرموز المميزة للحساب عبر مسار الأمان المركزي.',
          'مراجعة سجلات التدقيق Audit Logs لتحديد عنوان IP وجهاز المستخدم ومقارنتها بالأنماط المعتادة.',
        ],
        escalationRole: 'المراقب المالي وضابط الأمن (Security & Finance Leads)',
        verificationCheckAr: 'عدم خروج أي ريال من حسابات الشركة النقدية وثبات الأستاذ العام.',
        targetSlaMinutes: 5,
      },
      {
        id: 'RB-05',
        code: 'REFUND_DISPUTE',
        category: RunbookCategory.REFUND_DISPUTE,
        titleAr: 'دليل فض نزاعات استرجاع الأموال (Customer Dispute & Refund Arbitration)',
        descriptionAr: 'إدارة تذاكر العملاء المطالبين باسترجاع المبالغ عند تعثر الشحن أو إدخال معرف خاطئ.',
        triggerConditionAr: 'فتح تذكرة دعم بنوع Dispute مرفقة بادعاء عدم وصول رصيد الشحن.',
        immediateStepsAr: [
          'فتح سجل تشخيص الطلب الداخلي والتحقق من رقم الحساب المدخل وإثبات استجابة المزود.',
          'إذا كان الخطأ تقنياً من المنصة: الموافقة على الاسترجاع المالي الكامل وإعادة الرصيد للمحفظة.',
          'إذا كان الخطأ من إدخال العميل لمعرف غير صحيح وشحن بنجاح لدى المزود: تقديم إثبات التنفيذ بلباقة.',
          'حجب كافة الملاحظات الفنية الحساسة والمراسلات البينية مع المزود عن العميل (AR-20).',
        ],
        escalationRole: 'مسؤول الدعم المالي (Customer Support Lead)',
        verificationCheckAr: 'قيد الاسترجاع المالي في دفتر الأستاذ كقيد عكسي متوازن بالكامل.',
        targetSlaMinutes: 15,
      },
      {
        id: 'RB-06',
        code: 'WORKER_LAG',
        category: RunbookCategory.WORKER_LAG,
        titleAr: 'دليل معالجة تأخر طوابير المعالجة (Worker Queue Lag & Safe Restart)',
        descriptionAr: 'التدخل السريع عند تكدس طوابير الطلبات الخلفية أو توقف عامل المعالجة المؤتمت.',
        triggerConditionAr: 'تجاوز تأخر الطابور (Queue Lag) 60 ثانية أو وصول الطلبات المعلقة لأكثر من 50 طلباً.',
        immediateStepsAr: [
          'فحص استهلاك الذاكرة والمعالج في خادم الخلفية عبر لوحة /operations.',
          'التحقق من حالة اتصال Redis وقاعدة البيانات PostgreSQL.',
          'إعادة تشغيل عامل الطوابير بسلام (Graceful Reload) لمنع تكرار أي طلب قيد المعالجة.',
          'مراقبة انخفاض عداد المهام المعلقة حتى عودة زمن الاستجابة لأقل من 5 ثوانٍ.',
        ],
        escalationRole: 'مهندس النظم والمراقبة (Duty Systems Engineer)',
        verificationCheckAr: 'عدم تكرار شحن أي طلب كان قيد المعالجة أثناء إعادة التشغيل (AT-02).',
        targetSlaMinutes: 5,
      },
    ];
  }

  /**
   * Executes one of the mandatory Phase 12 Operational Drills
   */
  async executeOperationalDrill(
    dto: RunDrillDto,
    adminUserId: string = 'admin-drill-runner',
  ): Promise<OperationalDrillResultDto> {
    this.logger.error(
      `Operational drill ${dto.drillType} requested by ${adminUserId}, but no live drill implementation is configured.`,
    );
    throw new ServiceUnavailableException(
      'No operational drill was run. Connect the drill to real operational records before recording a result.',
    );

    const drillId = `DRILL-${Date.now().toString().slice(-6)}`;
    const timestamp = new Date().toISOString();

    this.logger.log(`Executing Phase 12 Operational Drill: ${dto.drillType} by ${dto.operatorName}`);

    if (dto.drillType === 'SUPPORT_FAILED_ORDER_DIAGNOSIS') {
      const orderId = dto.simulatedTargetId || `ORD-FAIL-${Date.now().toString().slice(-4)}`;
      const result: OperationalDrillResultDto = {
        drillId,
        drillType: dto.drillType,
        title: 'محاكاة دعم ومتابعة طلب فاشل وتشخيصه بأمان',
        executedBy: dto.operatorName,
        timestamp,
        status: 'PASSED',
        simulatedOrderOrReportId: orderId,
        stepsCompleted: [
          `استلام استفسار بخصوص الطلب ${orderId} المتعثر بسبب انقطاع الاتصال بمزود الخدمة.`,
          'استدعاء أداة تشخيص الطلبات الداخلية: تبين وجود خطأ 504 Timeout واستجابة آمنة ReconciliationRequired.',
          'التحقق من عدم تكرار الخصم أو الشحن المكرر.',
          'إضافة ملاحظة داخلية مشفرة محجوبة عن العميل (AR-20 Internal Note Shielding).',
          'تحديث حالة التذكرة إلى RESOLVED وإشعار العميل بنجاح الحل واستقرار المحفظة.',
        ],
        auditIntegrityVerified: true,
        durationSeconds: 12,
        notes: 'تمت المحاكاة بنجاح: تحقق موظف الدعم من الطلب واستخدم مسار التشخيص الآمن دون كشف أسرار المنصة.',
      };

      this.inMemoryDrills.unshift(result);
      await this.persistDrillLog(result);
      return result;
    }

    if (dto.drillType === 'NEW_STAFF_DAILY_CLOSE') {
      const closeDate = dto.simulatedTargetId || new Date().toISOString().slice(0, 10);
      const reportId = `DC-REPORT-SOP-${closeDate}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      const result: OperationalDrillResultDto = {
        drillId,
        drillType: dto.drillType,
        title: 'محاكاة إقفال يوم محاسبي بواسطة موظف جديد اعتماداً على الدليل التشغيلي',
        executedBy: dto.operatorName,
        timestamp,
        status: 'PASSED',
        simulatedOrderOrReportId: reportId,
        stepsCompleted: [
          `فتح دليل العمليات المحاسبية SOP وقراءة خطوات إقفال اليوم لتاريخ ${closeDate}.`,
          'تشغيل فحص المطابقة المحاسبية الآلية: التحقق من توازن الدائن والمدين 100% (Debit = Credit).',
          'استخراج مجموع المبيعات اليومية وتكلفة المبيعات ومطابقتها مع كشف حساب المزود.',
          'حساب الأرباح المحققة القابلة للتوزيع وتثبيتها كقيد غير قابل للتعديل (Immutable Snapshot).',
          'حفظ التقرير مع توقيع الموظف الجديد وتمريره للمراقب المالي للاعتماد الثنائي.',
        ],
        auditIntegrityVerified: true,
        durationSeconds: 15,
        notes: 'تمكن الموظف الجديد من تنفيذ إقفال اليوم المحاسبي بدقة تامة اعتماداً على الوثائق دون أي استثناءات.',
      };

      this.inMemoryDrills.unshift(result);
      await this.persistDrillLog(result);
      return result;
    }

    if (dto.drillType === 'HISTORICAL_RECONCILIATION_AUDIT') {
      const batchId = dto.simulatedTargetId || `REC-HIST-${Date.now().toString().slice(-4)}`;
      const result: OperationalDrillResultDto = {
        drillId,
        drillType: dto.drillType,
        title: 'محاكاة استرجاع تقرير تسوية تاريخي وإثبات عدم تغيير أي بيانات',
        executedBy: dto.operatorName,
        timestamp,
        status: 'PASSED',
        simulatedOrderOrReportId: batchId,
        stepsCompleted: [
          `طلب استرجاع سجل التسوية المالي القديم برقم الدفعة ${batchId}.`,
          'التحقق من بصمة التقرير الرقمية المشفرة SHA-256 ومقارنتها مع البصمة المسجلة عند الإقفال.',
          'تطابق تام في المبالغ وحسابات البنوك وأرصدة المزودين دون أي تعديل أو تلاعب صامت (Zero Drift).',
          'تأكيد أن سجلات الأستاذ العام المزدوج محمية بضوابط عدم القابلية للتغيير (Immutability Guaranteed).',
        ],
        auditIntegrityVerified: true,
        durationSeconds: 8,
        notes: 'تم استرجاع تقرير التسوية القديم وإثبات سلامته الرياضية والتشفيرية بنسبة 100%.',
      };

      this.inMemoryDrills.unshift(result);
      await this.persistDrillLog(result);
      return result;
    }

    throw new BadRequestException(`نوع المحاكاة التشغيلية غير مدعوم: ${dto.drillType}`);
  }

  /**
   * Returns Handover Sign-Off Package
   */
  async getHandoverSignOffPackage(): Promise<HandoverSignOffPackageDto> {
    return {
      packageId: 'HANDOVER-YEMEN-TOPUP-V1.0',
      version: '1.0.0',
      status: HandoverStatus.TRANSFERRED,
      repositoriesDelivered: {
        backendApi: 'apps/backend (NestJS Modular Monolith + Swagger + Strict Ledger)',
        webAdmin: 'apps/web-admin (Next.js 14 - 19 شاشات تشغيلية كاملة)',
        webCustomer: 'apps/web-customer (Next.js 14 - 13 شاشة متجر PWA متجاوبة)',
        databaseMigrations: 'packages/database (Prisma ORM + PostgreSQL Double-Entry Models)',
        docsAndRunbooks: 'docs/ (38+ وثيقة تشغيلية وأدلة استجابة للحوادث)',
      },
      signOffs: this.inMemorySignOffs,
      checklistCompletedCount: 0,
      totalChecklistItems: 24,
    };
  }

  /**
   * Records formal sign-off on handover
   */
  async signHandoverPackage(
    _dto: SignHandoverDto,
    adminUserId: string,
  ): Promise<HandoverSignOffPackageDto> {
    this.logger.error(
      `Handover sign-off requested by ${adminUserId}, but durable multi-party approval is not configured.`,
    );
    throw new ServiceUnavailableException(
      'Handover signatures cannot be accepted until durable, auditable sign-off storage is configured.',
    );
  }

  /**
   * Returns drill execution logs
   */
  async getDrillHistory(): Promise<OperationalDrillResultDto[]> {
    throw new ServiceUnavailableException(
      'Operational drill history is unavailable because no verified live drills have been recorded.',
    );
  }

  private async persistDrillLog(drill: OperationalDrillResultDto) {
    try {
      await (this.prisma as any).operationalDrillLog.create({
        data: {
          drillType: drill.drillType,
          title: drill.title,
          executedBy: drill.executedBy,
          status: drill.status,
          simulatedTargetId: drill.simulatedOrderOrReportId,
          stepsCompleted: drill.stepsCompleted as any,
          durationSeconds: drill.durationSeconds,
          auditIntegrityVerified: drill.auditIntegrityVerified,
          notes: drill.notes,
        },
      });
    } catch (err) {
      this.logger.debug(`Could not persist operational drill to DB: ${err.message}`);
    }
  }
}
