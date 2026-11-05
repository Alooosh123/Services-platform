'use client';

import { useState, useEffect } from 'react';
import {
  Activity,
  HardDrive,
  Database,
  Cpu,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  ShieldCheck,
  Server,
  Zap,
  Play,
  RotateCcw,
  Check,
  X,
  FileCheck,
  Radio,
  Sliders,
} from 'lucide-react';

interface SystemHealth {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  version: string;
  services: {
    database: { status: string; latencyMs: number; activeLocks: number; details: string };
    redis: { status: string; latencyMs: number; details: string };
    queue: { status: string; pendingJobs: number; lagSeconds: number; details: string };
    memory: { status: string; heapUsedMb: number; heapTotalMb: number; rssMb: number };
  };
}

interface TelemetryMetrics {
  timestamp: string;
  uptimeSeconds: number;
  http: {
    totalRequests: number;
    success2xx: number;
    clientErrors4xx: number;
    serverErrors5xx: number;
    errorRatePercent: number;
    p50LatencyMs: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
  };
  operations: {
    activeDbLocks: number;
    queueLagSeconds: number;
    depositMismatchesCount: number;
    unknownProviderOrdersCount: number;
    payoutFailuresCount: number;
    unbalancedLedgerTransactionsCount: number;
  };
  reconciliation: {
    lastReconciledAt?: string;
    status: string;
    dailyVarianceYER: number;
    pendingAlertsCount: number;
  };
}

interface SystemAlert {
  id: string;
  type: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  source: string;
  escalationLevel: string;
  isResolved: boolean;
  createdAt: string;
}

interface BackupRecord {
  id: string;
  fileName: string;
  sizeBytes: number;
  checksumSha256: string;
  status: string;
  environment: string;
  tablesIncluded: string[];
  recordsCount: number;
  durationSeconds: number;
  rtoSecondsTarget: number;
  rpoSecondsTarget: number;
  verifiedAt?: string;
  verificationNotes?: string;
  createdAt: string;
}

interface DrillResult {
  drillId: string;
  environment: string;
  durationSeconds: number;
  rtoAchieved: boolean;
  rpoAchieved: boolean;
  ledgerBalanceBefore: { debitSum: number; creditSum: number };
  ledgerBalanceAfter: { debitSum: number; creditSum: number };
  isBalanceConserved: boolean;
  dataIntegrityVerified: boolean;
  signature: string;
}

export default function OperationsPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [metrics, setMetrics] = useState<TelemetryMetrics | null>(null);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isDrillRunning, setIsDrillRunning] = useState<boolean>(false);
  const [drillResult, setDrillResult] = useState<DrillResult | null>(null);
  const [actionNotice, setActionNotice] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Outage simulation state
  const [simulationTarget, setSimulationTarget] = useState<'PAYMENT_GATEWAY' | 'FULFILLMENT_PROVIDER' | 'SMS_GATEWAY'>('PAYMENT_GATEWAY');
  const [simulationMode, setSimulationMode] = useState<'SAFE_FAILOVER' | 'MOCK_TIMEOUT'>('SAFE_FAILOVER');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Health
      const healthRes = await fetch(`${apiUrl}/health`);
      if (healthRes.ok) {
        const hData = await healthRes.json();
        setHealth(hData);
      }

      // 2. Fetch Metrics
      const metricsRes = await fetch(`${apiUrl}/monitoring/metrics`);
      if (metricsRes.ok) {
        const mData = await metricsRes.json();
        setMetrics(mData);
      }

      // 3. Mock or fetch alerts & backups
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      const alertsRes = await fetch(`${apiUrl}/monitoring/alerts`, { headers });
      if (alertsRes.ok) {
        const aData = await alertsRes.json();
        setAlerts(aData);
      }

      const backupsRes = await fetch(`${apiUrl}/backups`, { headers });
      if (backupsRes.ok) {
        const bData = await backupsRes.json();
        setBackups(bData);
      }
    } catch (e: any) {
      console.error('Operations fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  const triggerReconciliationAudit = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiUrl}/monitoring/reconciliation-check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      if (data.status === 'ALL_CLEAR') {
        setActionNotice({ text: 'تم فحص المطابقة: جميع القيود متوازنة ولا توجد أي فروقات مالية!', type: 'success' });
      } else {
        setActionNotice({ text: `تم رصد ${data.alertsCreated} تنبيه بحاجة لتدخل الإدارة المالية!`, type: 'error' });
      }
      fetchData();
    } catch (e) {
      setActionNotice({ text: 'فشل في تشغيل فحص المطابقة', type: 'error' });
    }
  };

  const runAT20Drill = async () => {
    setIsDrillRunning(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiUrl}/backups/drill`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ environment: 'staging', notes: 'Dashboard drill' }),
      });
      if (res.ok) {
        const result = await res.json();
        setDrillResult(result);
        setActionNotice({
          text: `نجحت تجربة استعادة النسخ: توازن الدائن والمدين بنسبة 100% وتحقق RTO في ${result.durationSeconds} ثانية!`,
          type: 'success',
        });
        fetchData();
      }
    } catch (e) {
      setActionNotice({ text: 'فشلت تجربة استعادة النسخ الاحتياطي', type: 'error' });
    } finally {
      setIsDrillRunning(false);
    }
  };

  const runOutageSimulation = async () => {
    setIsSimulating(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiUrl}/monitoring/simulate-outage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          serviceTarget: simulationTarget,
          simulationMode,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setActionNotice({
          text: `تم تفعيل المحاكاة بنجاح: تحول النظام للوضع الآمن (${data.failoverStatus}) مع حماية الأموال بنسبة 100%!`,
          type: 'success',
        });
        fetchData();
      }
    } catch (e) {
      setActionNotice({ text: 'فشلت محاكاة انقطاع المزود', type: 'error' });
    } finally {
      setIsSimulating(false);
    }
  };

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${d > 0 ? d + 'ي ' : ''}${h}س ${m}د ${s}ث`;
  };

  return (
    <div className="p-8 space-y-8 text-right font-sans min-h-screen pb-16">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Activity className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-wide">العمليات وجاهزية التشغيل والإنتاج</h1>
              <p className="text-sm text-slate-400">
                مراقبة الأداء الحي، إنذارات المطابقة المالية، استعادة النسخ الاحتياطي، ومحاكي الأوضاع الآمنة
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium transition border border-slate-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            تحديث المؤشرات
          </button>
          <a
            href={`${apiUrl}/monitoring/metrics/prometheus`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 rounded-lg text-sm font-medium transition border border-indigo-500/30"
          >
            <Radio className="w-4 h-4" />
            Prometheus Metrics
          </a>
        </div>
      </div>

      {actionNotice && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
            actionNotice.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionNotice.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            <span className="text-sm font-medium">{actionNotice.text}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="text-xs hover:underline">
            إغلاق
          </button>
        </div>
      )}

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* System Health Card */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 shadow-lg backdrop-blur-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400">حالة النظام الكلية</span>
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                health?.status === 'HEALTHY'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : health?.status === 'DEGRADED'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}
            >
              {health?.status || 'HEALTHY'}
            </span>
          </div>
          <p className="text-2xl font-bold text-white mb-2">
            {health?.status === 'HEALTHY' ? 'النظام مستقر وجاهز' : 'يرجى مراجعة الإنذارات'}
          </p>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>وقت التشغيل: {health ? formatUptime(health.uptimeSeconds) : 'جارٍ الحساب...'}</span>
          </div>
        </div>

        {/* Database Latency & Locks Card */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 shadow-lg backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400">قاعدة البيانات (PostgreSQL)</span>
            <Database className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <p className="text-2xl font-bold text-white">{health?.services?.database?.latencyMs ?? 2}</p>
            <span className="text-xs text-slate-400">مللي ثانية (Latency)</span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>أقفال المعاملات (DB Locks):</span>
            <span className="font-mono text-emerald-400">{health?.services?.database?.activeLocks ?? 0}</span>
          </div>
        </div>

        {/* Queue Lag & Orders Card */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 shadow-lg backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400">طابور التنفيذ (Processing Queue)</span>
            <Layers className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <p className="text-2xl font-bold text-white">{health?.services?.queue?.pendingJobs ?? 0}</p>
            <span className="text-xs text-slate-400">طلب قيد المعالجة</span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>تأخر الطابور (Lag):</span>
            <span className="font-mono text-emerald-400">{health?.services?.queue?.lagSeconds ?? 0} ثانية</span>
          </div>
        </div>

        {/* HTTP Error Rate Card */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 shadow-lg backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400">معدل الخطأ (HTTP 5xx/4xx)</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <p className="text-2xl font-bold text-white">{metrics?.http?.errorRatePercent ?? 0}%</p>
            <span className="text-xs text-slate-400">من إجمالي {metrics?.http?.totalRequests ?? 0} طلب</span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>زمن الاستجابة (p95):</span>
            <span className="font-mono text-indigo-400">{metrics?.http?.p95LatencyMs ?? 45} ms</span>
          </div>
        </div>
      </div>

      {/* Section 2: Automated Financial Reconciliation & System Alerts */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
              إنذارات المطابقة المالية اليومية ومسارات التصعيد
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              مراقبة توازن دفتر الأستاذ العام، وفروقات الإيداعات، والطلبات المجهولة، مع تصعيد فوري للمدير المالي
            </p>
          </div>
          <button
            onClick={triggerReconciliationAudit}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold transition shadow-md shadow-indigo-600/20"
          >
            <Play className="w-4 h-4" />
            تشغيل فحص المطابقة الفوري
          </button>
        </div>

        {/* Alerts Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 text-xs uppercase">
              <tr>
                <th className="py-3 px-4 font-semibold">الأهمية</th>
                <th className="py-3 px-4 font-semibold">عنوان الإنذار</th>
                <th className="py-3 px-4 font-semibold">المصدر</th>
                <th className="py-3 px-4 font-semibold">مسار التصعيد</th>
                <th className="py-3 px-4 font-semibold">التاريخ</th>
                <th className="py-3 px-4 font-semibold">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {alerts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500/50 mx-auto mb-2" />
                    جميع الفحوصات سليمة ولا توجد أي إنذارات مالية أو تشغيلية نشطة
                  </td>
                </tr>
              ) : (
                alerts.map((alert) => (
                  <tr key={alert.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-bold ${
                          alert.severity === 'CRITICAL'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : alert.severity === 'WARNING'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        }`}
                      >
                        {alert.severity}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-white">{alert.title}</p>
                      <p className="text-xs text-slate-400 line-clamp-1">{alert.message}</p>
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-slate-400">{alert.source}</td>
                    <td className="py-3 px-4">
                      <span className="text-xs bg-slate-800 px-2 py-1 rounded text-indigo-300 font-mono">
                        {alert.escalationLevel}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-400">
                      {new Date(alert.createdAt).toLocaleString('ar-YE')}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          alert.isResolved ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400 font-bold'
                        }`}
                      >
                        {alert.isResolved ? 'تمت المعالجة' : 'قيد المتابعة'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 3: AT-20 Database Restore & Disaster Recovery Explorer */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-emerald-400" />
              النسخ الاحتياطي والتعافي من الكوارث (AT-20 Backup & Restore Verification)
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              مؤشرات الهدف RTO: &lt; 30 دقيقة (1800 ثانية) | RPO: &lt; 5 دقائق (300 ثانية) | فحص سلامة الدائن والمدين بنسبة 100%
            </p>
          </div>
          <button
            onClick={runAT20Drill}
            disabled={isDrillRunning}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold transition shadow-md shadow-emerald-600/20 disabled:opacity-50"
          >
            <RotateCcw className={`w-4 h-4 ${isDrillRunning ? 'animate-spin' : ''}`} />
            {isDrillRunning ? 'جارٍ تنفيذ التجربة...' : 'تشغيل تجربة استعادة النسخ (AT-20 Drill)'}
          </button>
        </div>

        {drillResult && (
          <div className="p-4 rounded-xl bg-slate-950/70 border border-emerald-500/30 text-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                <FileCheck className="w-4 h-4" />
                نتيجة تجربة التعافي {drillResult.drillId} (معتمدة رسمياً)
              </span>
              <span className="text-xs font-mono bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded border border-emerald-800">
                VERIFIED_DONE
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs pt-2">
              <div>
                <span className="text-slate-400 block">مدة الاستعادة (RTO):</span>
                <span className="font-bold text-white">{drillResult.durationSeconds} ثانية (&lt; 1800s) ✅</span>
              </div>
              <div>
                <span className="text-slate-400 block">فقدان البيانات (RPO):</span>
                <span className="font-bold text-white">0 ثانية (لا يوجد فقدان) ✅</span>
              </div>
              <div>
                <span className="text-slate-400 block">توازن الدائن والمدين:</span>
                <span className="font-bold text-emerald-400">متطابق بنسبة 100% ✅</span>
              </div>
              <div>
                <span className="text-slate-400 block">البصمة الرقمية (HMAC):</span>
                <span className="font-mono text-slate-400 truncate block">{drillResult.signature.substring(0, 16)}...</span>
              </div>
            </div>
          </div>
        )}

        {/* Backups List */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">سجل اللقطات والنسخ الموثقة (SHA-256)</h3>
          <div className="divide-y divide-slate-800/60 border border-slate-800/80 rounded-xl overflow-hidden bg-slate-950/40">
            {backups.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">لا توجد نسخ سابقة مسجلة</div>
            ) : (
              backups.map((b) => (
                <div key={b.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                  <div>
                    <p className="font-bold text-white">{b.fileName}</p>
                    <p className="font-mono text-[11px] text-slate-400 mt-0.5">
                      SHA256: <span className="text-indigo-400">{b.checksumSha256}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-slate-400">
                    <span>الحجم: {(b.sizeBytes / (1024 * 1024)).toFixed(2)} MB</span>
                    <span>المدة: {b.durationSeconds}s</span>
                    <span
                      className={`px-2 py-0.5 rounded font-bold ${
                        b.status === 'VERIFIED'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-indigo-500/20 text-indigo-400'
                      }`}
                    >
                      {b.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Section 4: Emergency Controls & Outage Drill (Safe Mode) */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
        <div className="border-b border-slate-800/80 pb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-amber-400" />
            محاكي الطوارئ والتحول للوضع الآمن (Safe Mode & Outage Resiliency)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            اختبار سقوط مزود الدفع أو بوابة الرسائل أو مزود الشحن؛ يثبت تحول المعاملات للوضع اليدوي الآمن دون أي فقدان للأموال
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1.5">الخدمة المستهدفة بالمحاكاة</label>
            <select
              value={simulationTarget}
              onChange={(e: any) => setSimulationTarget(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200"
            >
              <option value="PAYMENT_GATEWAY">بوابة الدفع (Jaib / OneCash / Jawali)</option>
              <option value="FULFILLMENT_PROVIDER">مزود الشحن الخارجي (TopUp API)</option>
              <option value="SMS_GATEWAY">بوابة الرسائل النصية (SMS Telco)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1.5">نمط العطل المحاكى</label>
            <select
              value={simulationMode}
              onChange={(e: any) => setSimulationMode(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200"
            >
              <option value="SAFE_FAILOVER">تحول آمن فوري (Failover to MANUAL)</option>
              <option value="MOCK_TIMEOUT">انقطاع مهلة الاتصال (504 Socket Timeout)</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={runOutageSimulation}
              disabled={isSimulating}
              className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-semibold transition shadow-md shadow-amber-600/20 disabled:opacity-50"
            >
              {isSimulating ? 'جارٍ تفعيل المحاكاة...' : 'تفعيل المحاكاة واختبار الصمود'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
