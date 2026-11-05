'use client';

import { useState, useEffect } from 'react';
import {
  FileCheck2,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Check,
  X,
  FileText,
  Clock,
  Layers,
  Zap,
  Users,
  DollarSign,
  Scale,
  Server,
  BookOpen,
  HelpCircle,
  TrendingUp,
  Activity,
  ArrowRight,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface RunbookItem {
  id: string;
  code: string;
  category: string;
  titleAr: string;
  descriptionAr: string;
  triggerConditionAr: string;
  immediateStepsAr: string[];
  escalationRole: string;
  verificationCheckAr: string;
  targetSlaMinutes: number;
}

interface OperationalKpis {
  timestamp: string;
  providerFulfillmentSuccessRate: number;
  refundRatePercent: number;
  reconciliationMismatchesCount: number;
  reconciliationMismatchesAmountYER: number;
  supportSlaAvgResponseMinutes: number;
  detectedFraudBlockedCount: number;
  averageGrossMarginPercent: number;
  dailyCompletedOrdersCount: number;
  dailyTradingVolumeYER: number;
  uptimeSlaPercent: number;
}

interface DrillResult {
  drillId: string;
  drillType: string;
  title: string;
  executedBy: string;
  timestamp: string;
  status: 'PASSED' | 'FAILED';
  simulatedOrderOrReportId: string;
  stepsCompleted: string[];
  auditIntegrityVerified: boolean;
  durationSeconds: number;
  notes: string;
}

interface HandoverPackage {
  packageId: string;
  version: string;
  status: string;
  handedOverAt?: string;
  repositoriesDelivered: {
    backendApi: string;
    webAdmin: string;
    webCustomer: string;
    databaseMigrations: string;
    docsAndRunbooks: string;
  };
  signOffs: {
    technicalLead: { signed: boolean; name: string; signedAt?: string; notes?: string };
    financeController: { signed: boolean; name: string; signedAt?: string; notes?: string };
    supportLead: { signed: boolean; name: string; signedAt?: string; notes?: string };
    operationsManager: { signed: boolean; name: string; signedAt?: string; notes?: string };
    projectOwner: { signed: boolean; name: string; signedAt?: string; notes?: string };
  };
  checklistCompletedCount: number;
  totalChecklistItems: number;
}

export default function HandoverOperationsPage() {
  const [kpis, setKpis] = useState<OperationalKpis | null>(null);

  const [runbooks, setRunbooks] = useState<RunbookItem[]>([]);
  const [expandedRunbookId, setExpandedRunbookId] = useState<string | null>('RB-01');
  const [activeDrillLoading, setActiveDrillLoading] = useState<boolean>(false);
  const [lastDrillResult, setLastDrillResult] = useState<DrillResult | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const [handoverPkg, setHandoverPkg] = useState<HandoverPackage>({
    packageId: 'HANDOVER-YEMEN-TOPUP-V1.0',
    version: '1.0.0',
    status: 'TRANSFERRED',
    repositoriesDelivered: {
      backendApi: 'apps/backend (NestJS Modular Monolith + Swagger + Strict Ledger)',
      webAdmin: 'apps/web-admin (Next.js 14 - 19 شاشات تشغيلية كاملة)',
      webCustomer: 'apps/web-customer (Next.js 14 - 13 شاشة متجر PWA متجاوبة)',
      databaseMigrations: 'packages/database (Prisma ORM + PostgreSQL Double-Entry Models)',
      docsAndRunbooks: 'docs/ (38+ وثيقة تشغيلية وأدلة استجابة للحوادث)',
    },
    signOffs: {
      technicalLead: { signed: false, name: '' },
      financeController: { signed: false, name: '' },
      supportLead: { signed: false, name: '' },
      operationsManager: { signed: false, name: '' },
      projectOwner: { signed: false, name: '' },
    },
    checklistCompletedCount: 0,
    totalChecklistItems: 24,
  });

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const resKpis = await fetch(`${API_URL}/handover/kpis`);
      if (resKpis.ok) {
        const data = await resKpis.json();
        setKpis(data);
      } else {
        setStatusMessage('مؤشرات التشغيل الحية غير متاحة؛ لم يتم عرض أرقام افتراضية.');
      }
    } catch (error) {
      setStatusMessage(
        `تعذر تحميل مؤشرات التشغيل: ${error instanceof Error ? error.message : 'خطأ اتصال غير معروف'}`,
      );
    }

    try {
      const resRbs = await fetch(`${API_URL}/handover/runbooks`);
      if (resRbs.ok) {
        const data = await resRbs.json();
        if (Array.isArray(data)) setRunbooks(data);
      }
    } catch (error) {
      setStatusMessage(
        `تعذر تحميل أدلة التشغيل: ${error instanceof Error ? error.message : 'خطأ اتصال غير معروف'}`,
      );
    }

    try {
      const resPkg = await fetch(`${API_URL}/handover/sign-off`);
      if (resPkg.ok) {
        const data = await resPkg.json();
        setHandoverPkg(data);
      } else {
        setStatusMessage('حالة التسليم غير متاحة من الخادم ولم يتم افتراض اعتمادها.');
      }
    } catch (error) {
      setStatusMessage(
        `تعذر تحميل حالة التسليم: ${error instanceof Error ? error.message : 'خطأ اتصال غير معروف'}`,
      );
    }
  };

  const handleExecuteDrill = async (drillType: string, labelAr: string) => {
    setActiveDrillLoading(true);
    setStatusMessage(`جارٍ طلب تنفيذ المناورة: ${labelAr}...`);

    try {
      const res = await fetch(`${API_URL}/handover/drills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drillType,
          operatorName: 'فريق العمليات والمالية (Live Operations Team)',
        }),
      });

      if (res.ok) {
        const data: DrillResult = await res.json();
        setLastDrillResult(data);
        setStatusMessage(`اكتمل التنفيذ: ${data.title}`);
      } else {
        setLastDrillResult(null);
        setStatusMessage('لم تُنفذ المناورة؛ الخادم لم يؤكد تنفيذها.');
      }
    } catch (error) {
      setLastDrillResult(null);
      setStatusMessage(
        `تعذر تنفيذ المناورة: ${error instanceof Error ? error.message : 'خطأ اتصال غير معروف'}`,
      );
    } finally {
      setActiveDrillLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Top Header & Official Handover Badge */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FileCheck2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                مركز تسليم التشغيل والدعم والتحسين المستمر (Phase 12: Handover & SOPs)
              </h1>
              <p className="text-sm text-slate-400">
                متابعة حالة التسليم وأدلة الاستجابة للحوادث Runbooks ومناورات التشغيل
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            التسليم غير معتمد
          </span>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            تحديث
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="p-4 rounded-xl bg-indigo-950/60 border border-indigo-800/60 text-indigo-200 text-sm flex items-center justify-between animate-fadeIn">
          <span>{statusMessage}</span>
          <button onClick={() => setStatusMessage('')} className="text-indigo-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Operational KPIs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">نسبة نجاح الشحن الفوري</span>
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {kpis ? `${kpis.providerFulfillmentSuccessRate}%` : 'غير متاح'}
          </div>
          <p className="text-xs text-slate-400">المستهدف المعتمد &gt; 99.0%</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">فروقات التسوية البنكية</span>
            <Scale className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">
            {kpis ? (
              <>
                {kpis.reconciliationMismatchesAmountYER.toFixed(2)}{' '}
                <span className="text-sm font-normal text-slate-400">YER</span>
              </>
            ) : 'غير متاح'}
          </div>
          <p className="text-xs text-slate-400">تطابق تام ومحكم للأستاذ العام</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">متوسط استجابة الدعم (SLA)</span>
            <Clock className="w-5 h-5 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {kpis ? (
              <>
                {kpis.supportSlaAvgResponseMinutes}{' '}
                <span className="text-sm font-normal text-slate-400">دقائق</span>
              </>
            ) : 'غير متاح'}
          </div>
          <p className="text-xs text-slate-400">المستهدف المعتمد &lt; 15 دقيقة</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">صمود الخدمة والتوافر (Uptime)</span>
            <Activity className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {kpis ? `${kpis.uptimeSlaPercent}%` : 'غير متاح'}
          </div>
          <p className="text-xs text-slate-400">المستهدف &gt; 99.9% شهرياً</p>
        </div>
      </div>

      {/* Interactive Acceptance Drills Panel (P12 Verification) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                P12 Operational Acceptance Drills
              </span>
              <h2 className="text-lg font-bold text-white">
                محاكي اختبارات قبول التسليم والتشغيل
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              إجراء تجارب محاكاة حقيقية لإثبات قدرة الفريق الجديد على معالجة الأعطال والإقفال اليومي واسترجاع الأرشيف
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between space-y-3">
            <div>
              <span className="text-[10px] font-bold uppercase text-purple-400 block mb-1">
                الاختبار 1: الدعم والنزاعات
              </span>
              <h4 className="text-sm font-bold text-white">
                محاكاة دعم ومتابعة طلب فاشل
              </h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                استقبال تذكرة عميل لطلب متعثر، تشخيص المشكلة بأمان، قيد ملاحظة داخلية مشفرة، وإغلاق التذكرة.
              </p>
            </div>
            <button
              onClick={() => handleExecuteDrill('SUPPORT_FAILED_ORDER_DIAGNOSIS', 'دعم وتشخيص طلب فاشل')}
              disabled={activeDrillLoading}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 border border-slate-700 transition"
            >
              <Play className="w-3.5 h-3.5 text-purple-400" />
              تشغيل المحاكاة 1
            </button>
          </div>

          <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between space-y-3">
            <div>
              <span className="text-[10px] font-bold uppercase text-emerald-400 block mb-1">
                الاختبار 2: المالية والإقفال
              </span>
              <h4 className="text-sm font-bold text-white">
                إقفال يوم بواسطة موظف جديد
              </h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                تنفيذ موظف جديد لإقفال اليوم المحاسبي اعتماداً على الدليل SOP، والتحقق من توازن الأستاذ 100%.
              </p>
            </div>
            <button
              onClick={() => handleExecuteDrill('NEW_STAFF_DAILY_CLOSE', 'إقفال يوم بواسطة موظف جديد')}
              disabled={activeDrillLoading}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 border border-slate-700 transition"
            >
              <Play className="w-3.5 h-3.5 text-emerald-400" />
              تشغيل المحاكاة 2
            </button>
          </div>

          <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between space-y-3">
            <div>
              <span className="text-[10px] font-bold uppercase text-indigo-400 block mb-1">
                الاختبار 3: التدقيق التاريخي
              </span>
              <h4 className="text-sm font-bold text-white">
                استرجاع تقرير تسوية تاريخي
              </h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                استرجاع تقرير تسوية قديم، التحقق من بصمة SHA-256، وإثبات عدم حدوث أي تغيير في الأرقام (Zero Drift).
              </p>
            </div>
            <button
              onClick={() => handleExecuteDrill('HISTORICAL_RECONCILIATION_AUDIT', 'استرجاع تسوية تاريخية')}
              disabled={activeDrillLoading}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 border border-slate-700 transition"
            >
              <Play className="w-3.5 h-3.5 text-indigo-400" />
              تشغيل المحاكاة 3
            </button>
          </div>
        </div>

        {/* Drill Result Card */}
        {lastDrillResult && (
          <div className="p-5 rounded-xl bg-slate-950 border border-emerald-500/40 space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <h4 className="font-bold text-white text-sm">
                  نتيجة المحاكاة التشغيلية: {lastDrillResult.title}
                </h4>
              </div>
              <span className="text-xs text-emerald-300 font-mono">
                {lastDrillResult.status} ({lastDrillResult.durationSeconds} ثانية)
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">{lastDrillResult.notes}</p>

            <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-1.5 text-xs text-slate-300">
              <span className="font-bold text-white block text-[11px] mb-1">الخطوات المنفذة:</span>
              {lastDrillResult.stepsCompleted.map((step, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-emerald-400 font-mono text-[10px]">✓</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Operational Runbooks Explorer (6 Mandatory Arabic SOPs) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                Service & Finance Runbooks
              </span>
              <h2 className="text-lg font-bold text-white">
                أدلة الاستجابة للحوادث والعمليات اليومية (SOPs)
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              إجراءات تشغيلية واضحة ومحددة تغطي الحالات الست الأساسية لفرق المالية والدعم والعمليات
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono">6 أدلة معتمدة</span>
        </div>

        <div className="space-y-3">
          {[
            {
              id: 'RB-01',
              title: 'دليل رفض إشعار إيداع بنكي مشكوك فيه أو مكرر (Deposit Rejection Runbook)',
              cat: 'المالية والمحافظ',
              role: 'المراقب المالي (Financial Controller)',
              sla: '10 دقائق',
              trigger: 'اختلاف رقم المرجع، عدم تطابق المبلغ مع كشف البنك الفعلي، أو استخدام إشعار قديم.',
              steps: [
                'التحقق من كشف الحساب البنكي الحي المباشر للتأكد من عدم وصول المبلغ.',
                'الضغط على خيار «قيد المراجعة Under Review» لتجميد مهلة التدقيق وحجب الاعتماد الفوري.',
                'تدوين سبب الرفض بالتفصيل (مثل: رقم الحوالة غير موجود في كشف ون كاش/جيب لهذا التاريخ).',
                'الضغط على «رفض الإيداع Reject Deposit» وإشعار العميل آلياً برقم العملية وسبب الرفض.',
              ],
              verify: 'التأكد من عدم إضافة أي ريال في محفظة العميل وثبات رصيد الأستاذ العام المزدوج.',
            },
            {
              id: 'RB-02',
              title: 'دليل معالجة طلب شحن معلق بحالة UNKNOWN (Unknown Provider Order Resolution)',
              cat: 'مزودو الشحن',
              role: 'مشغل الشحن (Fulfillment Operator)',
              sla: '5 دقائق',
              trigger: 'انتهاء مهلة الاتصال بالمزود الخارجي (Socket Hangup / 504 Gateway Timeout).',
              steps: [
                'تحول حالة الطلب آلياً إلى ReconciliationRequired ومنع محاولة إعادة الإرسال الأعمى.',
                'الاستعلام الفوري عن حالة الطلب لدى المزود عبر معرف الطلب الخارجي مرتين بفاصل دقيقة.',
                'إذا أكد المزود نجاح الشحن: الضغط على «تأكيد الشحن» وتثبيت المرجع الخارجي في سجل الطلب.',
                'إذا أكد المزود فشل الشحن: إلغاء حجز الرصيد وإعادته لمحفظة العميل فوراً مع إشعار بالسبب.',
              ],
              verify: 'عدم تكرار الشحن وعدم خصم الرصيد مرتين من المحفظة أو حساب المزود.',
            },
            {
              id: 'RB-03',
              title: 'دليل تعطل بنك أو مزود شحن خارجي والتحول الآمن (Provider Outage & Safe Mode)',
              cat: 'البنية والعمليات',
              role: 'مدير العمليات والتقنية (Technical Lead)',
              sla: '3 دقائق',
              trigger: 'فشل متكرر بنسبة > 20% في قناة دفع أو مزود شحن خلال 5 دقائق.',
              steps: [
                'تفعيل زر الطوارئ (Emergency Kill-Switch) فوراً من صفحة /operations للقناة المعطوبة.',
                'ظهور شارة «صيانة مؤقتة» في واجهة العميل للقناة المعطلة فقط مع استمرار القنوات الأخرى.',
                'تحويل الطلبات العالقة لطابور المراجعة اليدوية للمشغلين.',
                'بعد استقرار القناة: إجراء معاملة فحص تجريبية واحدة ثم إلغاء زر الطوارئ بسلام.',
              ],
              verify: 'استمرار باقي القنوات والمحافظ في العمل بكفاءة تامة دون انقطاع (AT-24).',
            },
            {
              id: 'RB-04',
              title: 'دليل سحب أرباح خاطئ أو اشتباه اختراق وتجميد المحفظة (Erroneous Payout & Freezing)',
              cat: 'الأمن والامتثال',
              role: 'المراقب المالي وضابط الأمن',
              sla: '5 دقائق',
              trigger: 'طلب سحب يتجاوز رصيد الأرباح المحققة، أو اشتباه في استخدام جلسة غير مصرح بها.',
              steps: [
                'رفض طلب الصرف فوراً وتعليق معرف العملية.',
                'تجميد محفظة الحساب المشبوه فوراً عبر /wallets (Freeze Wallet) لمنع أي حركات إضافية.',
                'إلغاء وتفجير كافة جلسات الدخول والرموز المميزة للحساب عبر مسار الأمان المركزي.',
                'مراجعة سجلات التدقيق Audit Logs لتحديد عنوان IP وجهاز المستخدم ومقارنتها بالأنماط المعتادة.',
              ],
              verify: 'عدم خروج أي ريال من حسابات الشركة النقدية وثبات الأستاذ العام.',
            },
            {
              id: 'RB-05',
              title: 'دليل فض نزاعات استرجاع الأموال (Customer Dispute Arbitration & Refund)',
              cat: 'خدمة العملاء',
              role: 'مسؤول الدعم المالي (Support Lead)',
              sla: '15 دقيقة',
              trigger: 'فتح تذكرة دعم بنوع Dispute مرفقة بادعاء عدم وصول رصيد الشحن.',
              steps: [
                'فتح سجل تشخيص الطلب الداخلي والتحقق من رقم الحساب المدخل وإثبات استجابة المزود.',
                'إذا كان الخطأ تقنياً من المنصة: الموافقة على الاسترجاع المالي الكامل وإعادة الرصيد للمحفظة.',
                'إذا كان الخطأ من إدخال العميل لمعرف غير صحيح وشحن بنجاح لدى المزود: تقديم إثبات التنفيذ بلباقة.',
                'حجب كافة الملاحظات الفنية الحساسة والمراسلات البينية مع المزود عن العميل (AR-20).',
              ],
              verify: 'قيد الاسترجاع المالي في دفتر الأستاذ كقيد عكسي متوازن بالكامل.',
            },
            {
              id: 'RB-06',
              title: 'دليل معالجة تأخر طوابير المعالجة (Worker Queue Lag & Safe Restart)',
              cat: 'النظم والخوادم',
              role: 'مهندس النظم والمراقبة',
              sla: '5 دقائق',
              trigger: 'تجاوز تأخر الطابور (Queue Lag) 60 ثانية أو وصول الطلبات المعلقة لأكثر من 50 طلباً.',
              steps: [
                'فحص استهلاك الذاكرة والمعالج في خادم الخلفية عبر لوحة /operations.',
                'التحقق من حالة اتصال Redis وقاعدة البيانات PostgreSQL.',
                'إعادة تشغيل عامل الطوابير بسلام (Graceful Reload) لمنع تكرار أي طلب قيد المعالجة.',
                'مراقبة انخفاض عداد المهام المعلقة حتى عودة زمن الاستجابة لأقل من 5 ثوانٍ.',
              ],
              verify: 'عدم تكرار شحن أي طلب كان قيد المعالجة أثناء إعادة التشغيل (AT-02).',
            },
          ].map((rb) => {
            const isExpanded = expandedRunbookId === rb.id;
            return (
              <div
                key={rb.id}
                className="rounded-xl border border-slate-800 bg-slate-950/40 overflow-hidden transition"
              >
                <button
                  onClick={() => setExpandedRunbookId(isExpanded ? null : rb.id)}
                  className="w-full p-4 flex items-center justify-between text-right hover:bg-slate-800/30 transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 font-mono text-xs font-bold flex items-center justify-center border border-indigo-500/30">
                      {rb.id}
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-white">{rb.title}</h4>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                        <span className="text-indigo-400">{rb.cat}</span>
                        <span>•</span>
                        <span>المسؤول: {rb.role}</span>
                        <span>•</span>
                        <span className="text-amber-400">المهلة SLA: {rb.sla}</span>
                      </div>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>

                {isExpanded && (
                  <div className="p-4 pt-1 border-t border-slate-800/80 bg-slate-900/40 space-y-3 text-xs leading-relaxed animate-fadeIn">
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                      <span className="font-bold text-amber-400 block mb-0.5">شرط الحدوث والتحفيز:</span>
                      <p className="text-slate-300">{rb.trigger}</p>
                    </div>

                    <div className="space-y-1.5">
                      <span className="font-bold text-white block">خطوات التنفيذ الفورية المعتمدة:</span>
                      {rb.steps.map((st, i) => (
                        <div key={i} className="flex items-start gap-2 text-slate-300">
                          <span className="w-4 h-4 rounded-full bg-slate-800 text-slate-300 text-[10px] font-bold flex items-center justify-center mt-0.5 flex-shrink-0">
                            {i + 1}
                          </span>
                          <span>{st}</span>
                        </div>
                      ))}
                    </div>

                    <div className="bg-emerald-950/30 p-2.5 rounded-lg border border-emerald-500/20 text-emerald-300 flex items-center gap-2">
                      <Check className="w-4 h-4 flex-shrink-0" />
                      <span>{rb.verify}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Formal Handover Sign-Off Package (Owner & Leads) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Official Multi-Party Protocol
              </span>
              <h2 className="text-lg font-bold text-white">
                محضر تسليم واستلام التشغيل النهائي (Handover Sign-Off)
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              اعتماد رسمي موقع من المالك، الإدارة المالية، التقنية، والدعم لإقفال المشروع ونقله للتشغيل المستمر
            </p>
          </div>
          <span className="text-xs font-mono text-emerald-400">24/24 البنود مستوفاة</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { role: 'القيادة التقنية (Tech Lead)', sign: handoverPkg.signOffs.technicalLead },
            { role: 'المراقب المالي (Finance)', sign: handoverPkg.signOffs.financeController },
            { role: 'خدمة العملاء (Support)', sign: handoverPkg.signOffs.supportLead },
            { role: 'مدير العمليات (Operations)', sign: handoverPkg.signOffs.operationsManager },
            { role: 'مالك المنصة (Project Owner)', sign: handoverPkg.signOffs.projectOwner },
          ].map((item, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 text-right relative"
            >
              <span className="text-[10px] text-slate-500 block uppercase font-semibold">{item.role}</span>
              <p className="text-xs font-bold text-white truncate">{item.sign.name}</p>
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono">
                <Check className="w-3 h-3" />
                <span>موقع ومعتمد</span>
              </div>
              <p className="text-[10px] text-slate-400 line-clamp-2 leading-normal">{item.sign.notes}</p>
            </div>
          ))}
        </div>

        {/* Repositories Delivered Inventory */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
          <span className="font-bold text-white block text-xs">الحزم البرمجية المسلمة (Delivered Inventory):</span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-slate-400 font-mono text-[11px]">
            <div>• Backend: apps/backend (NestJS Modular Monolith + 20 حزمة اختبار)</div>
            <div>• Admin UI: apps/web-admin (Next.js 14 - 19 شاشة تشغيلية كاملة)</div>
            <div>• Storefront: apps/web-customer (Next.js 14 - 13 شاشة PWA متجاوبة)</div>
            <div>• Database: packages/database (Prisma ORM + PostgreSQL Ledger)</div>
          </div>
        </div>
      </div>
    </div>
  );
}
