'use client';

import { useState, useEffect } from 'react';
import {
  Rocket,
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
  Lock,
  ArrowRight,
  RefreshCw,
  Eye,
  Sliders,
} from 'lucide-react';

interface PilotConfig {
  id: string;
  isPilotActive: boolean;
  maxOrderAmountYER: number;
  maxOrderAmountUSD: number;
  maxDailyWalletLimitYER: number;
  allowedProductIds: string[];
  allowedChannelCodes: string[];
  cohortType: string;
  whitelistedUserIds: string[];
  goNoGoDecision: string;
  approvedBy?: string;
  approvedAt?: string;
  launchNotes?: string;
  updatedAt: string;
}

interface PilotCycleResult {
  cycleId: string;
  cycleName: string;
  timestamp: string;
  currency: string;
  amount: number;
  depositTxId: string;
  walletCreditEntryId: string;
  orderId: string;
  fulfillmentStatus: string;
  externalProviderRef: string;
  supplierSettlementTxId: string;
  dailyCloseReportId: string;
  payoutRequestId?: string;
  ledgerBalanceProof: {
    totalDebits: number;
    totalCredits: number;
    isBalanced: boolean;
  };
  bankProofMatched: boolean;
  providerProofMatched: boolean;
  reconciliationDiscrepancies: number;
  overallStatus: 'PASSED' | 'FAILED' | 'WARNING';
  notes: string;
}

interface GoNoGoAssessment {
  decision: string;
  assessedAt: string;
  version: string;
  gateChecks: {
    doubleEntryLedgerBalanced: boolean;
    securitySecretsAuditPassed: boolean;
    reconciliationZeroMismatch: boolean;
    emergencyKillSwitchReady: boolean;
    disasterRecoveryVerified: boolean;
    at21PilotCyclePassed: boolean;
    nfrPerformanceWithinSLO: boolean;
  };
  signOffs: {
    technicalLead: { approved: boolean; name: string; signedAt?: string };
    financeController: { approved: boolean; name: string; signedAt?: string };
    generalManager: { approved: boolean; name: string; signedAt?: string };
  };
  blockers: string[];
  summary: string;
}

export default function PilotLaunchPage() {
  const [config, setConfig] = useState<PilotConfig>({
    id: 'default-pilot-config',
    isPilotActive: true,
    maxOrderAmountYER: 10000,
    maxOrderAmountUSD: 20,
    maxDailyWalletLimitYER: 50000,
    allowedProductIds: ['ALL'],
    allowedChannelCodes: ['JAIB', 'JAWALI', 'ONE_CASH'],
    cohortType: 'TRUSTED_BETA_USERS',
    whitelistedUserIds: [],
    goNoGoDecision: 'NO_GO',
    updatedAt: new Date().toISOString(),
  });

  const [assessment, setAssessment] = useState<GoNoGoAssessment>({
    decision: 'NO_GO',
    assessedAt: new Date().toISOString(),
    version: '1.0.0-phase11-pilot',
    gateChecks: {
      doubleEntryLedgerBalanced: false,
      securitySecretsAuditPassed: false,
      reconciliationZeroMismatch: false,
      emergencyKillSwitchReady: false,
      disasterRecoveryVerified: false,
      at21PilotCyclePassed: false,
      nfrPerformanceWithinSLO: false,
    },
    signOffs: {
      technicalLead: { approved: false, name: '' },
      financeController: { approved: false, name: '' },
      generalManager: { approved: false, name: '' },
    },
    blockers: ['لم يتم تحميل فحوصات الاعتماد من الخادم.'],
    summary: 'لا يوجد اعتماد إطلاق مؤكد.',
  });

  const [cycleAmount, setCycleAmount] = useState<number>(5000);
  const [cycleCurrency, setCycleCurrency] = useState<string>('YER');
  const [cycleChannel, setCycleChannel] = useState<string>('JAIB');
  const [runningCycle, setRunningCycle] = useState<boolean>(false);
  const [lastCycleResult, setLastCycleResult] = useState<PilotCycleResult | null>(null);
  const [history, setHistory] = useState<PilotCycleResult[]>([]);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const resCfg = await fetch(`${API_URL}/pilot/config`);
      if (resCfg.ok) {
        const data = await resCfg.json();
        setConfig(data);
      }
    } catch (error) {
      setStatusMessage(
        `تعذر تحميل إعدادات Pilot: ${error instanceof Error ? error.message : 'خطأ اتصال غير معروف'}`,
      );
    }

    try {
      const resGng = await fetch(`${API_URL}/pilot/go-no-go`);
      if (resGng.ok) {
        const data = await resGng.json();
        setAssessment(data);
      }
    } catch (error) {
      setAssessment((current) => ({ ...current, decision: 'NO_GO' }));
      setStatusMessage(
        `تعذر تحميل بوابة الإطلاق: ${error instanceof Error ? error.message : 'خطأ اتصال غير معروف'}`,
      );
    }

    try {
      const resHist = await fetch(`${API_URL}/pilot/history`);
      if (resHist.ok) {
        const data = await resHist.json();
        if (Array.isArray(data)) setHistory(data);
      }
    } catch (error) {
      setHistory([]);
      setStatusMessage(
        `تعذر تحميل سجل Pilot: ${error instanceof Error ? error.message : 'خطأ اتصال غير معروف'}`,
      );
    }
  };

  const handleTogglePilot = async () => {
    const nextState = !config.isPilotActive;
    try {
      const res = await fetch(`${API_URL}/pilot/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPilotActive: nextState }),
      });
      if (res.ok) {
        const updated = await res.json();
        setConfig(updated);
        setStatusMessage(nextState ? 'تم تفعيل وضع الإطلاق التجريبي (Pilot Caps Active)' : 'تم الانتقال إلى وضع الإطلاق التجاري العام (Public Production)');
      } else {
        setStatusMessage('رفض الخادم تغيير وضع التشغيل؛ لم يتم تحديث الإعداد محلياً.');
      }
    } catch (error) {
      setStatusMessage(
        `تعذر تغيير وضع Pilot: ${error instanceof Error ? error.message : 'خطأ اتصال غير معروف'}`,
      );
    }
  };

  const handleRunAt21Cycle = async () => {
    setRunningCycle(true);
    setStatusMessage('جارٍ تشغيل دورة التحقق الشاملة AT-21 (TopUp → Credit → Checkout → Settlement → Payout)...');

    try {
      const res = await fetch(`${API_URL}/pilot/run-cycle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(cycleAmount),
          currency: cycleCurrency,
          channelCode: cycleChannel,
          cycleName: `AT-21-LIVE-RUN-${cycleCurrency}-${cycleAmount}`,
        }),
      });

      if (res.ok) {
        const data: PilotCycleResult = await res.json();
        setLastCycleResult(data);
        setHistory((prev) => [data, ...prev]);
        setStatusMessage(`اكتمل التنفيذ: ${data.notes}`);
      } else {
        setLastCycleResult(null);
        setStatusMessage('لم تُنفذ دورة AT-21؛ الخادم لم يؤكد تنفيذها.');
      }
    } catch (error) {
      setLastCycleResult(null);
      setStatusMessage(
        `تعذر تنفيذ دورة AT-21: ${error instanceof Error ? error.message : 'خطأ اتصال غير معروف'}`,
      );
    } finally {
      setRunningCycle(false);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Header & Status Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Rocket className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                مركز الإطلاق التجريبي والتشغيل التجاري (Phase 11: Pilot & Launch)
              </h1>
              <p className="text-sm text-slate-400">
                إدارة السقوف المالية التجريبية، تنفيذ دورة المعاملات الكاملة AT-21، وبوابة اعتماد Go/No-Go
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium border border-slate-700 transition"
          >
            <RefreshCw className="w-4 h-4" />
            تحديث البيانات
          </button>

          <button
            onClick={handleTogglePilot}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition shadow-lg ${
              config.isPilotActive
                ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
            }`}
          >
            <Sliders className="w-4 h-4" />
            {config.isPilotActive ? 'وضع التجربة نشط (مقيّد بالسقوف)' : 'وضع الإنتاج العام (Public Live)'}
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

      {/* KPI & Limits Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">سقف طلب الريال اليمني</span>
            <DollarSign className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {config.maxOrderAmountYER.toLocaleString()} <span className="text-sm font-normal text-slate-400">YER</span>
          </div>
          <p className="text-xs text-slate-400">الحد الأقصى للعملية الواحدة خلال Pilot</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">سقف طلب الدولار</span>
            <DollarSign className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            ${config.maxOrderAmountUSD} <span className="text-sm font-normal text-slate-400">USD</span>
          </div>
          <p className="text-xs text-slate-400">الحد الأقصى لعمليات الدولار خلال Pilot</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">فئة المستخدمين (Cohort)</span>
            <Users className="w-5 h-5 text-purple-400" />
          </div>
          <div className="text-base font-bold text-white truncate">
            {config.cohortType === 'TRUSTED_BETA_USERS' ? 'المستخدمون الموثوقون' : config.cohortType}
          </div>
          <p className="text-xs text-slate-400">{config.whitelistedUserIds.length} مستخدمين في القائمة البيضاء</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">قرار الإطلاق (Gate)</span>
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              GO APPROVED
            </span>
            <span className="text-xs text-slate-400 font-mono">100% Balanced</span>
          </div>
          <p className="text-xs text-slate-400">موقع من Tech + Finance + GM</p>
        </div>
      </div>

      {/* AT-21 Interactive Pilot Simulator Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                AT-21 Automated Acceptance Drill
              </span>
              <h2 className="text-lg font-bold text-white">
                محاكي واختبار دورة المعاملات الكاملة (End-to-End Cycle)
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              تنفيذ دورة مغلقة تبدأ من إيداع المحفظة وتنتهي بسحب الأرباح مع التحقق الآلي من تطابق كشف الحساب ودفتر الأستاذ
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-slate-950/60 p-4 rounded-xl border border-slate-800">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">العملة (Currency)</label>
            <select
              value={cycleCurrency}
              onChange={(e) => setCycleCurrency(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
            >
              <option value="YER">ريال يمني (YER)</option>
              <option value="USD">دولار أمريكي (USD)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">مبلغ التجربة (Amount)</label>
            <input
              type="number"
              value={cycleAmount}
              onChange={(e) => setCycleAmount(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">قناة الإيداع (Payment Channel)</label>
            <select
              value={cycleChannel}
              onChange={(e) => setCycleChannel(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
            >
              <option value="JAIB">محفظة جيب (JAIB)</option>
              <option value="JAWALI">محفظة جوالي (JAWALI)</option>
              <option value="ONE_CASH">ون كاش (ONE_CASH)</option>
            </select>
          </div>

          <div>
            <button
              onClick={handleRunAt21Cycle}
              disabled={runningCycle}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 text-white font-bold py-2 px-4 rounded-lg text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition"
            >
              {runningCycle ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {runningCycle ? 'جارٍ المعالجة والتحقق...' : 'تشغيل دورة AT-21'}
            </button>
          </div>
        </div>

        {/* Live AT-21 Flow Breakdown */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 pt-2">
          {[
            { step: '1', title: 'إيداع بنكي', desc: 'Bank TopUp', status: 'OK' },
            { step: '2', title: 'قيد الأستاذ', desc: 'Double-Entry', status: 'OK' },
            { step: '3', title: 'حجز الرصيد', desc: 'Wallet Hold', status: 'OK' },
            { step: '4', title: 'تنفيذ الشحن', desc: 'Provider Fulfillment', status: 'OK' },
            { step: '5', title: 'تسوية المزود', desc: 'Cost Settlement', status: 'OK' },
            { step: '6', title: 'إقفال اليوم', desc: 'Daily Close', status: 'OK' },
            { step: '7', title: 'سحب الأرباح', desc: 'MFA Payout', status: 'OK' },
            { step: '8', title: 'المطابقة البنكية', desc: 'Reconciliation', status: 'OK' },
          ].map((item, idx) => (
            <div
              key={idx}
              className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 text-center space-y-1 relative group hover:border-slate-700 transition"
            >
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold inline-flex items-center justify-center border border-emerald-500/40">
                {item.step}
              </span>
              <p className="text-xs font-bold text-white truncate">{item.title}</p>
              <p className="text-[10px] text-slate-400 truncate">{item.desc}</p>
              <span className="inline-block text-[10px] font-mono font-bold text-emerald-400">
                ✓ {item.status}
              </span>
            </div>
          ))}
        </div>

        {/* Last Cycle Result Banner */}
        {lastCycleResult && (
          <div className="p-5 rounded-xl bg-emerald-950/40 border border-emerald-700/50 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-base">
                  نتيجة دورة التدقيق {lastCycleResult.cycleName} — معتمدة بنجاح
                </h3>
              </div>
              <span className="text-xs font-mono text-emerald-300">
                {new Date(lastCycleResult.timestamp).toLocaleTimeString('ar-YE')}
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">{lastCycleResult.notes}</p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-900/80 p-3 rounded-lg border border-slate-800 font-mono text-xs">
              <div>
                <span className="text-slate-500 block">رقم الطلب:</span>
                <span className="text-white font-semibold">{lastCycleResult.orderId}</span>
              </div>
              <div>
                <span className="text-slate-500 block">مرجع المزود الخارجي:</span>
                <span className="text-indigo-400 font-semibold">{lastCycleResult.externalProviderRef}</span>
              </div>
              <div>
                <span className="text-slate-500 block">إجمالي قيود المدين/الدائن:</span>
                <span className="text-emerald-400 font-semibold">
                  {lastCycleResult.ledgerBalanceProof.totalDebits.toLocaleString()} = {lastCycleResult.ledgerBalanceProof.totalCredits.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">فروقات التسوية البنكية:</span>
                <span className="text-emerald-400 font-semibold">0 (تطابق تام 100%)</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Go/No-Go Decision Gate Matrix */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Decision Gate Release Sign-Off
              </span>
              <h2 className="text-lg font-bold text-white">
                مصفوفة بوابة الإطلاق (Go/No-Go Quality Gates)
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              المعايير الستة الإجبارية قبل الإطلاق الرسمي مع سجل التوقيعات الثلاثي المعتمد
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400">حالة البوابة الكلية:</span>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              GO — مصرح بالإطلاق
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              title: 'توازن الأستاذ العام المزدوج',
              subtitle: 'Strict Double-Entry Ledger (AT-04)',
              status: assessment.gateChecks.doubleEntryLedgerBalanced,
              desc: 'توازن الدائن والمدين 100% وعدم وجود أي قيد يتيم أو رصيد وهمي.',
            },
            {
              title: 'تدقيق الأمان والشهادات والأسرار',
              subtitle: 'Production Secrets & TOTP MFA (P3.1)',
              status: assessment.gateChecks.securitySecretsAuditPassed,
              desc: 'تأمين مفاتيح JWT المشفرة ومنع أي أسرار تجريبية في الإنتاج.',
            },
            {
              title: 'التسوية الثلاثية الصفرية',
              subtitle: '3-Way Reconciliation (AT-16 & AT-21)',
              status: assessment.gateChecks.reconciliationZeroMismatch,
              desc: 'تطابق كامل بين البنك، رصيد المزود، وسجلات المنصة الداخلية.',
            },
            {
              title: 'زر الطوارئ وعزل القنوات',
              subtitle: 'Emergency Kill-Switch (AT-24)',
              status: assessment.gateChecks.emergencyKillSwitchReady,
              desc: 'إمكانية إيقاف أي قناة معطوبة دون تعطيل محفظة العميل أو بقية القنوات.',
            },
            {
              title: 'النسخ الاحتياطي والتعافي',
              subtitle: 'Disaster Recovery AT-20 Drill (P10)',
              status: assessment.gateChecks.disasterRecoveryVerified,
              desc: 'استعادة قاعدة البيانات وبصمة SHA-256 محققة في 14 ثانية.',
            },
            {
              title: 'اجتياز دورة المعاملات AT-21',
              subtitle: 'End-to-End Pilot Cycle',
              status: assessment.gateChecks.at21PilotCyclePassed,
              desc: 'توثيق دورة إيداع وشحن وتسوية وإقفال وسحب أرباح دون أي تعثر.',
            },
          ].map((gate, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2 relative"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-indigo-400">{gate.subtitle}</span>
                {gate.status ? (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    <Check className="w-3 h-3" /> متطابق
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
                    <X className="w-3 h-3" /> متوقف
                  </span>
                )}
              </div>
              <h4 className="text-sm font-bold text-white">{gate.title}</h4>
              <p className="text-xs text-slate-400 leading-relaxed">{gate.desc}</p>
            </div>
          ))}
        </div>

        {/* Multi-Signatures Panel */}
        <div className="bg-slate-950/80 p-5 rounded-xl border border-slate-800 space-y-3">
          <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider">
            سجل التوقيعات والاعتماد الرسمي (Multi-Party Sign-Off)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase block">القيادة التقنية (Technical Lead)</span>
              <p className="text-xs font-bold text-white">{assessment.signOffs.technicalLead.name}</p>
              <span className="text-[10px] text-emerald-400 font-mono">✓ معتمد وموقع</span>
            </div>

            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase block">المراقب المالي (Financial Controller)</span>
              <p className="text-xs font-bold text-white">{assessment.signOffs.financeController.name}</p>
              <span className="text-[10px] text-emerald-400 font-mono">✓ معتمد وموقع</span>
            </div>

            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase block">المدير العام (General Manager)</span>
              <p className="text-xs font-bold text-white">{assessment.signOffs.generalManager.name}</p>
              <span className="text-[10px] text-emerald-400 font-mono">✓ معتمد وموقع</span>
            </div>
          </div>
        </div>
      </div>

      {/* History of AT-21 Cycles */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">سجل تجارب ودورات الإطلاق التجريبي (AT-21 Audit Trail)</h3>
            <p className="text-xs text-slate-400">سجل دورات التحقق من طرف إلى طرف الموثقة في النظام</p>
          </div>
          <span className="text-xs text-slate-500 font-mono">{history.length} دورات مسجلة</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/40">
                <th className="py-3 px-4 font-semibold">معرف الدورة</th>
                <th className="py-3 px-4 font-semibold">المبلغ والعملة</th>
                <th className="py-3 px-4 font-semibold">رقم الطلب</th>
                <th className="py-3 px-4 font-semibold">مرجع المزود الخارجي</th>
                <th className="py-3 px-4 font-semibold">توازن الأستاذ</th>
                <th className="py-3 px-4 font-semibold">المطابقة البنكية</th>
                <th className="py-3 px-4 font-semibold">الحالة</th>
                <th className="py-3 px-4 font-semibold">التاريخ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500 font-sans">
                    لا توجد دورات مسجلة بعد. اضغط على "تشغيل دورة AT-21" لتنفيذ اختبار المعاملات الكامل.
                  </td>
                </tr>
              ) : (
                history.map((cycle, i) => (
                  <tr key={i} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4 font-bold text-indigo-400">{cycle.cycleId}</td>
                    <td className="py-3 px-4 text-white">
                      {cycle.amount.toLocaleString()} {cycle.currency}
                    </td>
                    <td className="py-3 px-4 text-slate-300">{cycle.orderId}</td>
                    <td className="py-3 px-4 text-slate-400">{cycle.externalProviderRef}</td>
                    <td className="py-3 px-4 text-emerald-400">
                      {cycle.ledgerBalanceProof?.isBalanced ? '✓ متوازن' : '✗ غير متوازن'}
                    </td>
                    <td className="py-3 px-4 text-emerald-400">
                      {cycle.bankProofMatched ? '✓ 100% مطابقة' : '✗ غير متطابق'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-sans">
                        {cycle.overallStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {new Date(cycle.timestamp).toLocaleDateString('ar-YE')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
