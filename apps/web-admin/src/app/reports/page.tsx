'use client';

import { useState, useEffect } from 'react';
import { Header } from '../../components/Header';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/+$/, '');
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Percent,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  Calendar,
  Filter,
  RefreshCw,
  Server,
  Layers,
  Lock,
  ShieldCheck,
  Download,
  PlusCircle,
  KeyRound,
  FileSpreadsheet,
  Check,
  X,
  CreditCard,
  Building,
} from 'lucide-react';

export default function AdminReportsPage() {
  const [activeMainTab, setActiveMainTab] = useState<'dailyClose' | 'ownerEarnings' | 'analytics'>('dailyClose');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'today' | '7d' | '30d' | 'all'>('30d');
  const [activeCurrencyTab, setActiveCurrencyTab] = useState<'YER' | 'USD' | 'SAR'>('YER');

  // Daily Close States
  const [dailyReports, setDailyReports] = useState<any[]>([]);
  const [selectedCloseDate, setSelectedCloseDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
  const [closingNotes, setClosingNotes] = useState('');
  const [closingForcePreliminary, setClosingForcePreliminary] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Adjustment Modal
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [adjDate, setAdjDate] = useState('');
  const [adjCurrency, setAdjCurrency] = useState<'YER' | 'USD' | 'SAR'>('YER');
  const [adjType, setAdjType] = useState('RECONCILIATION_VARIANCE');
  const [adjAmount, setAdjAmount] = useState<number>(0);
  const [adjReason, setAdjReason] = useState('');

  // Owner Earnings States
  const [ownerStatement, setOwnerStatement] = useState<any>(null);
  const [ownerBeneficiaries, setOwnerBeneficiaries] = useState<any[]>([]);
  const [ownerPayouts, setOwnerPayouts] = useState<any[]>([]);
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [payoutCurrency, setPayoutCurrency] = useState<'YER' | 'USD' | 'SAR'>('YER');
  const [payoutAmount, setPayoutAmount] = useState<number>(0);
  const [payoutBeneficiaryId, setPayoutBeneficiaryId] = useState('');
  const [payoutTotpCode, setPayoutTotpCode] = useState('');
  const [payoutNotes, setPayoutNotes] = useState('');
  const [payoutIdempotencyKey, setPayoutIdempotencyKey] = useState(`PO-${Date.now()}`);

  // Finance Confirmation Modal
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [selectedPayoutId, setSelectedPayoutId] = useState('');
  const [externalReference, setExternalReference] = useState('');

  const getAuthHeader = (): Record<string, string> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    if (!token) throw new Error('جلسة الإدارة غير متوفرة. سجّل الدخول مجدداً.');
    return { Authorization: `Bearer ${token}` };
  };

  const fetchAll = async () => {
    setLoading(true);
    setLoadError(null);
    await Promise.all([
      fetchDailyCloseReports(),
      fetchOwnerStatement(activeCurrencyTab),
      fetchOwnerBeneficiaries(),
      fetchOwnerPayouts(),
      fetchAnalyticsReport(),
    ]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, [dateRange, activeCurrencyTab]);

  const fetchDailyCloseReports = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/reports/daily-close`, { headers: getAuthHeader() });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.message || 'تعذر تحميل تقارير الإغلاق اليومي.');
      const rows = Array.isArray(payload) ? payload : payload.data;
      if (!Array.isArray(rows)) throw new Error('استجابة تقارير الإغلاق غير صحيحة.');
      setDailyReports(rows);
    } catch (err) {
      setDailyReports([]);
      setLoadError(err instanceof Error ? err.message : 'تعذر تحميل تقارير الإغلاق اليومي.');
    }
  };

  const fetchOwnerStatement = async (cur: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/reports/owner-earnings/statement?currency=${encodeURIComponent(cur)}`, {
        headers: getAuthHeader(),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.message || 'بيان أرباح المالك غير متاح حالياً.');
      setOwnerStatement(payload);
    } catch (err) {
      setOwnerStatement(null);
      setLoadError(err instanceof Error ? err.message : 'بيان أرباح المالك غير متاح حالياً.');
    }
  };

  const fetchOwnerBeneficiaries = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/reports/owner-earnings/beneficiaries`, { headers: getAuthHeader() });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.message || 'تعذر تحميل مستفيدي السحب.');
      const rows = Array.isArray(payload) ? payload : payload.data;
      if (!Array.isArray(rows)) throw new Error('استجابة المستفيدين غير صحيحة.');
      setOwnerBeneficiaries(rows);
      if (rows.length > 0 && !payoutBeneficiaryId) setPayoutBeneficiaryId(rows[0].id);
    } catch (err) {
      setOwnerBeneficiaries([]);
      setLoadError(err instanceof Error ? err.message : 'تعذر تحميل مستفيدي السحب.');
    }
  };

  const fetchOwnerPayouts = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/reports/owner-earnings/payouts`, { headers: getAuthHeader() });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.message || 'تعذر تحميل طلبات السحب.');
      const rows = Array.isArray(payload) ? payload : payload.data;
      if (!Array.isArray(rows)) throw new Error('استجابة طلبات السحب غير صحيحة.');
      setOwnerPayouts(rows);
    } catch (err) {
      setOwnerPayouts([]);
      setLoadError(err instanceof Error ? err.message : 'تعذر تحميل طلبات السحب.');
    }
  };

  const fetchAnalyticsReport = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/reports/profit-and-performance?dateRange=${encodeURIComponent(dateRange)}`, {
        headers: getAuthHeader(),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.message || 'تعذر تحميل مؤشرات الأداء المالي.');
      setData(payload);
    } catch (err) {
      setData(null);
      setLoadError(err instanceof Error ? err.message : 'تعذر تحميل مؤشرات الأداء المالي.');
    }
  };

  // 1. Submit Daily Close
  const handleExecuteDailyClose = async () => {
    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch(`${API_BASE_URL}/reports/daily-close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          closeDate: selectedCloseDate,
          notes: closingNotes,
          forcePreliminary: closingForcePreliminary,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.message || 'فشل إغلاق اليوم المالي');
      }
      setActionSuccess(result.message || 'تم إغلاق اليوم المالي وحفظ اللقطة بنجاح.');
      setIsClosingModalOpen(false);
      setClosingNotes('');
      fetchDailyCloseReports();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // 2. Submit Daily Close Adjustment
  const handleAddAdjustment = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/reports/daily-close/${adjDate}/adjustment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          currency: adjCurrency,
          adjustmentType: adjType,
          amount: Number(adjAmount),
          reason: adjReason,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || 'فشل إضافة التسوية');
      setActionSuccess('تم إلحاق التسوية التعديلية بالتقرير بنجاح دون المساس باللقطة الأصلية.');
      setIsAdjustmentModalOpen(false);
      fetchDailyCloseReports();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Submit Owner Payout Request (TOTP MFA)
  const handleRequestPayout = async () => {
    if (!payoutBeneficiaryId) {
      setActionError('لا يوجد مستفيد مسجل وموثق. لا يمكن إرسال طلب السحب.');
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/reports/owner-earnings/payouts/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          currency: payoutCurrency,
          amount: Number(payoutAmount),
          beneficiaryId: payoutBeneficiaryId,
          totpCode: payoutTotpCode,
          idempotencyKey: payoutIdempotencyKey,
          notes: payoutNotes,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || 'فشل طلب سحب الأرباح');
      setActionSuccess(result.message || 'تم تسجيل طلب السحب وحجز المبلغ في الأرباح المقفلة بنجاح.');
      setIsPayoutModalOpen(false);
      setPayoutAmount(0);
      setPayoutTotpCode('');
      setPayoutIdempotencyKey(`PO-${Date.now()}`);
      fetchOwnerStatement(payoutCurrency);
      fetchOwnerPayouts();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Finance Officer Approves Payout
  const handleApprovePayout = async (id: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/reports/owner-earnings/payouts/${id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({ approved: true, financeNotes: 'تمت مراجعة السيولة والموافقة' }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || 'فشل اعتماد الطلب');
      setActionSuccess('تمت موافقة الإدارة المالية على السحب (مبدأ الرقابة الثنائية Four-Eyes).');
      fetchOwnerPayouts();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // 5. Finance Officer Confirms Wire & Posts Ledger
  const handleConfirmPayout = async () => {
    if (!externalReference) {
      setActionError('رقم الحوالة البنكية أو المرجع الخارجي مطلوب');
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/reports/owner-earnings/payouts/${selectedPayoutId}/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({ externalReference }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || 'فشل تأكيد الصرف');
      setActionSuccess('تم تأكيد الصرف الخارجي وتوثيق القيد المحاسبي المتوازن في دفتر الأستاذ العام.');
      setConfirmModalOpen(false);
      setExternalReference('');
      fetchOwnerStatement(payoutCurrency);
      fetchOwnerPayouts();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const activeFin = data?.financialSummary?.[activeCurrencyTab] || {
    realizedSales: 0,
    cogs: 0,
    netProfit: 0,
    marginPercentage: 0,
  };

  return (
    <div className="flex-1 bg-slate-950 text-slate-100 min-h-screen p-8 pr-72 font-sans text-right" dir="rtl">
      <Header title="التقارير المالية وإغلاق اليوم وسحب أرباح المالك" />
      {loadError && (
        <div role="alert" className="mx-auto mt-4 max-w-7xl rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          لا تُعرض بيانات تجريبية في التقارير المالية. بعض البيانات غير متاحة من الخادم حالياً: {loadError}
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-6 pt-4">
        {/* Page Top Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-indigo-400" />
              التقارير المالية وإغلاق اليوم وسحب أرباح المالك
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              متابعة حسابات الإغلاق اليومي غير القابلة للتعديل (AT-23)، وفصل أرباح المالك المحققة عن أموال العملاء مع التحقق الثنائي MFA (AT-17, AT-18).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchAll()}
              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
              تحديث
            </button>
            <button
              onClick={() => setIsClosingModalOpen(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02]"
            >
              <Lock className="w-3.5 h-3.5" />
              إغلاق اليوم المالي (Daily Close)
            </button>
          </div>
        </div>

        {/* Global Notifications */}
        {actionSuccess && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" /> {actionSuccess}
            </span>
            <button onClick={() => setActionSuccess(null)} className="hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {actionError && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center justify-between">
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {actionError}
            </span>
            <button onClick={() => setActionError(null)} className="hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 gap-2">
          <button
            onClick={() => setActiveMainTab('dailyClose')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeMainTab === 'dailyClose'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Lock className="w-4 h-4" />
            إغلاق اليوم المالي ولقطات التدقيق (Daily Close)
          </button>
          <button
            onClick={() => setActiveMainTab('ownerEarnings')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeMainTab === 'ownerEarnings'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            أرباح المالك وسحب السيولة (Owner Earnings & MFA Payout)
          </button>
          <button
            onClick={() => setActiveMainTab('analytics')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeMainTab === 'analytics'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            الأداء العام وهوامش المزودين (Analytics & Margins)
          </button>
        </div>

        {/* ---------------------------------------------------- */}
        {/* TAB 1: DAILY CLOSE & IMMUTABLE AUDIT TRAIL */}
        {/* ---------------------------------------------------- */}
        {activeMainTab === 'dailyClose' && (
          <div className="space-y-6">
            {/* Quick Currency Filter for Snapshots */}
            <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-semibold">عرض مؤشرات العملة:</span>
                {(['YER', 'USD', 'SAR'] as const).map((curr) => (
                  <button
                    key={curr}
                    onClick={() => setActiveCurrencyTab(curr)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      activeCurrencyTab === curr
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {curr}
                  </button>
                ))}
              </div>

              <div className="text-xs text-slate-400">
                قاعدة عدم التكرار (AT-23): إعادة تشغيل الإغلاق لنفس التاريخ لا يكرر القيود ولا يمسح السجل الأساسي
              </div>
            </div>

            {/* Daily Close History Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl space-y-4 p-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-indigo-400" />
                  سجل لقطات الإغلاق اليومي المعتمدة (Immutable Daily Close Snapshots)
                </h3>
                <span className="text-xs text-slate-400">{dailyReports.length} تقرير مسجل</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-3 font-bold">تاريخ الإغلاق</th>
                      <th className="p-3 font-bold">الحالة والنوع</th>
                      <th className="p-3 font-bold">إجمالي المبيعات ({activeCurrencyTab})</th>
                      <th className="p-3 font-bold">تكلفة المزودين</th>
                      <th className="p-3 font-bold">الربح المحقق</th>
                      <th className="p-3 font-bold">السيولة الحرة القابلة للتوزيع</th>
                      <th className="p-3 font-bold">الطلبات المكتملة</th>
                      <th className="p-3 font-bold">التسويات الملحقة</th>
                      <th className="p-3 font-bold text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {dailyReports.map((report) => {
                      const curMetrics = report.metricsByCurrency?.[activeCurrencyTab] || {};
                      const adjCount = report.adjustments?.length || 0;
                      return (
                        <tr key={report.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="p-3 text-white font-bold">{report.closeDate}</td>
                          <td className="p-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                report.status === 'CLOSED'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : report.status === 'ADJUSTED'
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              }`}
                            >
                              {report.status === 'CLOSED'
                                ? 'مغلق معتمد'
                                : report.status === 'ADJUSTED'
                                ? 'معدل بتسوية'
                                : 'إغلاق أولي'}
                            </span>
                          </td>
                          <td className="p-3 text-slate-200">
                            {Number(curMetrics.grossSales || 0).toLocaleString()} {activeCurrencyTab}
                          </td>
                          <td className="p-3 text-rose-400">
                            {Number(curMetrics.supplierCost || 0).toLocaleString()} {activeCurrencyTab}
                          </td>
                          <td className="p-3 text-emerald-400 font-bold">
                            {Number(curMetrics.realizedProfit || 0).toLocaleString()} {activeCurrencyTab}
                          </td>
                          <td className="p-3 text-indigo-400 font-bold">
                            {Number(curMetrics.withdrawableLiquidity || 0).toLocaleString()} {activeCurrencyTab}
                          </td>
                          <td className="p-3 text-slate-300">
                            {curMetrics.completedOrdersCount || 0} / {curMetrics.totalOrdersCount || 0}
                          </td>
                          <td className="p-3">
                            {adjCount > 0 ? (
                              <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 text-[10px] font-bold">
                                {adjCount} تسوية
                              </span>
                            ) : (
                              <span className="text-slate-500 text-[10px]">لا توجد</span>
                            )}
                          </td>
                          <td className="p-3 text-center space-x-2 space-x-reverse">
                            <a
                              href={`${API_BASE_URL}/reports/daily-close/${report.closeDate}/export`}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-medium inline-flex items-center gap-1 transition-colors"
                            >
                              <Download className="w-3 h-3" /> CSV
                            </a>
                            <button
                              onClick={() => {
                                setAdjDate(report.closeDate);
                                setAdjCurrency(activeCurrencyTab);
                                setIsAdjustmentModalOpen(true);
                              }}
                              className="px-2.5 py-1 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 rounded-lg text-[11px] font-medium inline-flex items-center gap-1 transition-colors border border-amber-500/30"
                            >
                              <PlusCircle className="w-3 h-3" /> إضافة تسوية
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {dailyReports.length === 0 && (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-slate-500 text-xs">
                          لا توجد تقارير إغلاق سابقة مسجلة. اضغط على زر "إغلاق اليوم المالي" لإنشاء أول لقطة.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TAB 2: OWNER EARNINGS & MFA PAYOUT STATEMENT */}
        {/* ---------------------------------------------------- */}
        {activeMainTab === 'ownerEarnings' && (
          <div className="space-y-6">
            {/* Currency Selector */}
            <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-semibold">عملة محفظة الأرباح:</span>
                {(['YER', 'USD', 'SAR'] as const).map((curr) => (
                  <button
                    key={curr}
                    onClick={() => {
                      setActiveCurrencyTab(curr);
                      fetchOwnerStatement(curr);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      activeCurrencyTab === curr
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {curr}
                  </button>
                ))}
              </div>

              <button
                onClick={() => {
                  setPayoutCurrency(activeCurrencyTab);
                  setPayoutIdempotencyKey(`PO-${Date.now()}`);
                  setIsPayoutModalOpen(true);
                }}
                disabled={!ownerStatement?.hasSufficientLiquidity || ownerStatement?.availableForPayout <= 0}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all hover:scale-[1.02]"
              >
                <KeyRound className="w-3.5 h-3.5" />
                طلب سحب أرباح المالك (MFA Protected)
              </button>
            </div>

            {/* Owner Statement KPI Cards */}
            {ownerStatement && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Realized Distributable Earnings */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2 shadow-xl">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs font-medium">الأرباح المحققة التراكمية</span>
                    <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                      <DollarSign className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black font-mono text-emerald-400">
                    {Number(ownerStatement.realizedEarnings).toLocaleString()} {activeCurrencyTab}
                  </div>
                  <p className="text-[10px] text-slate-500">
                    من العمليات المكتملة والمسواة فقط (استبعاد الطلبات المعلقة)
                  </p>
                </div>

                {/* 2. Locked in Pending Payouts */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2 shadow-xl">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs font-medium">أرباح محجوزة في طلبات سحب</span>
                    <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
                      <Lock className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black font-mono text-amber-400">
                    {Number(ownerStatement.lockedEarnings).toLocaleString()} {activeCurrencyTab}
                  </div>
                  <p className="text-[10px] text-slate-500">
                    مبالغ قيد المراجعة المالية والمصرفية (Hold)
                  </p>
                </div>

                {/* 3. Withdrawn to Date */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2 shadow-xl">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs font-medium">المسحوب فعلياً حتى الآن</span>
                    <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black font-mono text-blue-400">
                    {Number(ownerStatement.withdrawnEarnings).toLocaleString()} {activeCurrencyTab}
                  </div>
                  <p className="text-[10px] text-slate-500">
                    حوالات مؤكدة بمرجع مصرفي وقيد في دفتر الأستاذ
                  </p>
                </div>

                {/* 4. Available for Payout (Strictly Gated) */}
                <div className="bg-slate-900 border border-indigo-500/30 rounded-2xl p-5 space-y-2 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-1.5 h-full bg-indigo-500"></div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs font-bold text-indigo-300">الرصيد المتاح للسحب حالياً</span>
                    <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black font-mono text-indigo-400">
                    {Number(ownerStatement.availableForPayout).toLocaleString()} {activeCurrencyTab}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    مقيد بالسيولة النقدية الحرة بعد خصم التزامات العملاء
                  </p>
                </div>
              </div>
            )}

            {/* Liquidity Formula Audit Breakdown */}
            {ownerStatement && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  كشف مطابقة السيولة النقدية الحرة لمنع توليد أموال وهمية (Liquidity Gate Audit)
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-sans">الرصيد النقدي الفعلي (Cash)</span>
                    <span className="text-emerald-400 font-bold text-sm block mt-1">
                      {Number(ownerStatement.actualCashBalance).toLocaleString()} {activeCurrencyTab}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-xl border border-rose-500/20">
                    <span className="text-[10px] text-rose-400 block font-sans">التزامات محافظ العملاء (−)</span>
                    <span className="text-rose-400 font-bold text-sm block mt-1">
                      {Number(ownerStatement.customerWalletLiabilities).toLocaleString()} {activeCurrencyTab}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-xl border border-amber-500/20">
                    <span className="text-[10px] text-amber-400 block font-sans">ديون المزودين المستحقة (−)</span>
                    <span className="text-amber-400 font-bold text-sm block mt-1">
                      {Number(ownerStatement.supplierPayables).toLocaleString()} {activeCurrencyTab}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-xl border border-indigo-500/20">
                    <span className="text-[10px] text-indigo-400 block font-sans">احتياطي التشغيل والاسترجاع (−)</span>
                    <span className="text-indigo-400 font-bold text-sm block mt-1">
                      {Number(ownerStatement.operatingReserve).toLocaleString()} {activeCurrencyTab}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-indigo-950/30 border border-indigo-500/20 rounded-xl text-xs text-indigo-300 flex items-center justify-between">
                  <span>
                    السيولة الحرة في الخزينة بعد خصم كافة الالتزامات ={' '}
                    <strong className="text-white font-mono">
                      {Number(ownerStatement.withdrawableLiquidity).toLocaleString()} {activeCurrencyTab}
                    </strong>
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {ownerStatement.availableForPayout <= ownerStatement.withdrawableLiquidity
                      ? '✓ السيولة تغطي الأرباح المحققة بالكامل'
                      : '⚠ السحب محدد بحد أقصى للسيولة الحرة المتوفرة'}
                  </span>
                </div>
              </div>
            )}

            {/* Payout Requests & Approvals Queue */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl space-y-4 p-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-indigo-400" />
                  قائمة طلبات سحب الأرباح واعتمادات الإدارة المالية (Owner Payouts Queue)
                </h3>
                <span className="text-xs text-slate-400">مبدأ الرقابة الثنائية (Four-Eyes Principle)</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-3 font-bold">رقم الطلب</th>
                      <th className="p-3 font-bold">المبلغ والعملة</th>
                      <th className="p-3 font-bold">المستفيد والحساب</th>
                      <th className="p-3 font-bold">الحالة</th>
                      <th className="p-3 font-bold">اعتماد المالية</th>
                      <th className="p-3 font-bold">رقم المرجع المصرفي</th>
                      <th className="p-3 font-bold">تاريخ الطلب</th>
                      <th className="p-3 font-bold text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {ownerPayouts.map((po) => (
                      <tr key={po.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-3 text-white font-bold">{po.payoutNumber}</td>
                        <td className="p-3 text-emerald-400 font-bold">
                          {Number(po.amount).toLocaleString()} {po.currency}
                        </td>
                        <td className="p-3">
                          <span className="text-slate-200 block font-sans">{po.beneficiaryName}</span>
                          <span className="text-[10px] text-slate-400">
                            {po.channelCode} • {po.accountNumber}
                          </span>
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              po.status === 'CONFIRMED'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : po.status === 'APPROVED'
                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                : po.status === 'REQUESTED'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {po.status === 'CONFIRMED'
                              ? 'مصروف ومقيد'
                              : po.status === 'APPROVED'
                              ? 'معتمد مالياً'
                              : po.status === 'REQUESTED'
                              ? 'مطلوب للمراجعة'
                              : 'ملغى / فاشل'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-300">
                          {po.financeApprovedBy ? (
                            <span className="text-emerald-400 text-[11px]">✓ {po.financeApprovedBy}</span>
                          ) : (
                            <span className="text-slate-500 text-[11px]">بانتظار الاعتماد</span>
                          )}
                        </td>
                        <td className="p-3 text-slate-200">
                          {po.externalReference ? (
                            <span className="text-indigo-400">{po.externalReference}</span>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </td>
                        <td className="p-3 text-slate-400">{new Date(po.createdAt).toLocaleDateString('ar-YE')}</td>
                        <td className="p-3 text-center space-x-2 space-x-reverse">
                          {po.status === 'REQUESTED' && (
                            <button
                              onClick={() => handleApprovePayout(po.id)}
                              disabled={actionLoading}
                              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[11px] font-bold transition-colors"
                            >
                              موافقة المالية
                            </button>
                          )}
                          {po.status === 'APPROVED' && (
                            <button
                              onClick={() => {
                                setSelectedPayoutId(po.id);
                                setConfirmModalOpen(true);
                              }}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold transition-colors"
                            >
                              تأكيد الحوالة
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {ownerPayouts.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-500 text-xs">
                          لا توجد طلبات سحب أرباح سابقة.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TAB 3: ANALYTICS & PROVIDER PERFORMANCE */}
        {/* ---------------------------------------------------- */}
        {activeMainTab === 'analytics' && (
          <div className="space-y-6">
            {/* Range & Currency Filters */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-semibold">الفترة الزمنية:</span>
                {(['today', '7d', '30d', 'all'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setDateRange(r)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      dateRange === r
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {r === 'today' ? 'اليوم' : r === '7d' ? '7 أيام' : r === '30d' ? '30 يوماً' : 'الكل'}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-semibold">العملة:</span>
                {(['YER', 'USD', 'SAR'] as const).map((curr) => (
                  <button
                    key={curr}
                    onClick={() => setActiveCurrencyTab(curr)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      activeCurrencyTab === curr
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {curr}
                  </button>
                ))}
              </div>
            </div>

            {/* General Financial KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2 shadow-xl">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-medium">إجمالي المبيعات المحققة</span>
                  <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black font-mono text-white">
                  {Number(activeFin.realizedSales).toLocaleString()} {activeCurrencyTab}
                </div>
                <p className="text-[10px] text-slate-500">المبيعات الإجمالية للطلبات الناجحة</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2 shadow-xl">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-medium">تكلفة البضاعة للمزودين</span>
                  <div className="p-2 bg-rose-500/10 text-rose-400 rounded-lg">
                    <ShoppingCart className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black font-mono text-rose-400">
                  {Number(activeFin.cogs).toLocaleString()} {activeCurrencyTab}
                </div>
                <p className="text-[10px] text-slate-500">التكلفة المسددة لمزودي الشحن والخدمات</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2 shadow-xl">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-medium">صافي الربح المحقق</span>
                  <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black font-mono text-emerald-400">
                  {Number(activeFin.netProfit).toLocaleString()} {activeCurrencyTab}
                </div>
                <p className="text-[10px] text-slate-500">الأرباح المحققة بعد خصم التكاليف</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2 shadow-xl">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-medium">متوسط هامش الربح</span>
                  <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
                    <Percent className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black font-mono text-amber-400">
                  %{activeFin.marginPercentage}
                </div>
                <p className="text-[10px] text-slate-500">نسبة هامش الربح من إجمالي المبيعات</p>
              </div>
            </div>

            {/* Provider Performance Metrics Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl space-y-4 p-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Server className="w-4 h-4 text-indigo-400" /> أداء المزودين ومعدلات النجاح (Provider Performance)
                </h3>
                <span className="text-xs text-slate-400">معدل الإنجاز ومتوسط زمن التسليم</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-3 font-bold">المزود والنوع</th>
                      <th className="p-3 font-bold">إجمالي الطلبات</th>
                      <th className="p-3 font-bold">المكتمل</th>
                      <th className="p-3 font-bold">مراجعة يدوية / معلق</th>
                      <th className="p-3 font-bold">الفاشل</th>
                      <th className="p-3 font-bold">نسبة النجاح</th>
                      <th className="p-3 font-bold">متوسط وقت التسليم</th>
                      <th className="p-3 font-bold">رصيد المزود</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {(data?.providerPerformance || []).map((prov: any) => (
                      <tr key={prov.providerId} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-3 space-y-0.5">
                          <span className="text-white font-bold block">{prov.providerName}</span>
                          <span className="text-[10px] text-indigo-400">
                            {prov.providerCode} • {prov.type}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-white">{prov.totalOrders}</td>
                        <td className="p-3 text-emerald-400 font-bold">{prov.completedOrders}</td>
                        <td className="p-3 text-amber-400">{prov.manualReviewOrders}</td>
                        <td className="p-3 text-rose-400">{prov.failedOrders}</td>
                        <td className="p-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold text-[11px]">
                            %{prov.successRate}
                          </span>
                        </td>
                        <td className="p-3 text-slate-300">
                          {prov.averageCompletionTimeMs > 60000
                            ? `${(prov.averageCompletionTimeMs / 60000).toFixed(1)} دقيقة`
                            : `${(prov.averageCompletionTimeMs / 1000).toFixed(1)} ثانية`}
                        </td>
                        <td className="p-3 text-emerald-400 font-bold">
                          {Number(prov.balance).toLocaleString()} {prov.currency}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ---------------------------------------------------- */}
      {/* MODAL 1: CLOSE BUSINESS DAY (DAILY CLOSE) */}
      {/* ---------------------------------------------------- */}
      {isClosingModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Lock className="w-5 h-5 text-indigo-400" />
                إغلاق اليوم المالي وحفظ اللقطة الدائمة (Daily Close)
              </h3>
              <button onClick={() => setIsClosingModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">تاريخ اليوم المالي (YYYY-MM-DD):</label>
                <input
                  type="date"
                  value={selectedCloseDate}
                  onChange={(e) => setSelectedCloseDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">ملاحظات الإغلاق:</label>
                <textarea
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  placeholder="ملاحظات تدقيق الإغلاق اليومي ومطابقة الخزائن..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white h-20"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="forcePre"
                  checked={closingForcePreliminary}
                  onChange={(e) => setClosingForcePreliminary(e.target.checked)}
                  className="rounded border-slate-700"
                />
                <label htmlFor="forcePre" className="text-slate-400">
                  إغلاق مبدئي (Preliminary) - لا يقفل السجلات بصفة نهائية
                </label>
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-[11px]">
                تنبيه: اللقطة النهائية لا يمكن إعادة كتابتها صامتاً. أي فروقات لاحقة يتم إلحاقها كقيود تسوية تالية.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setIsClosingModalOpen(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs"
              >
                إلغاء
              </button>
              <button
                onClick={handleExecuteDailyClose}
                disabled={actionLoading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold"
              >
                {actionLoading ? 'جارٍ الإغلاق...' : 'تأكيد الإغلاق وحفظ اللقطة'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL 2: ADD DAILY CLOSE ADJUSTMENT */}
      {/* ---------------------------------------------------- */}
      {isAdjustmentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-amber-400" />
                إلحاق تسوية تعديلية بتقرير الإغلاق ({adjDate})
              </h3>
              <button onClick={() => setIsAdjustmentModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">نوع التسوية:</label>
                <select
                  value={adjType}
                  onChange={(e) => setAdjType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                >
                  <option value="RECONCILIATION_VARIANCE">فارق مطابقة بنكية (Reconciliation Variance)</option>
                  <option value="BANK_CHARGE_CORRECTION">تصحيح عمولة بنكية (Bank Charge)</option>
                  <option value="ROUNDING_DIFF">فارق تقريب حسابي (Rounding Diff)</option>
                  <option value="MANUAL_LEDGER_AUDIT">تسوية قيد محاسبي معتمد (Audit Adjustment)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">مبلغ التسوية ({adjCurrency}):</label>
                <input
                  type="number"
                  value={adjAmount}
                  onChange={(e) => setAdjAmount(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">سبب التسوية والتوضيح المحاسبي:</label>
                <textarea
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  placeholder="بيان سبب التعديل ورقم المستند المؤيد..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white h-20"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setIsAdjustmentModalOpen(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs"
              >
                إلغاء
              </button>
              <button
                onClick={handleAddAdjustment}
                disabled={actionLoading || !adjAmount || !adjReason}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold"
              >
                {actionLoading ? 'جارٍ الإضافة...' : 'حفظ التسوية وتحديث الحالة'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL 3: REQUEST OWNER PAYOUT (TOTP MFA) */}
      {/* ---------------------------------------------------- */}
      {isPayoutModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-indigo-400" />
                طلب سحب أرباح المالك مع التحقق الثنائي MFA
              </h3>
              <button onClick={() => setIsPayoutModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-slate-300 flex justify-between">
                <span>الرصيد المتاح للسحب ({payoutCurrency}):</span>
                <strong className="text-indigo-400 font-mono">
                  {Number(ownerStatement?.availableForPayout || 0).toLocaleString()} {payoutCurrency}
                </strong>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">المبلغ المطلوب سحبه:</label>
                <input
                  type="number"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(Number(e.target.value))}
                  placeholder="المبلغ المطلوب..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">حساب المستفيد المعتمد:</label>
                <select
                  value={payoutBeneficiaryId}
                  onChange={(e) => setPayoutBeneficiaryId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                >
                  {ownerBeneficiaries.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.beneficiaryName} ({b.channelCode} - {b.accountNumber})
                    </option>
                  ))}
                  {ownerBeneficiaries.length === 0 && (
                    {ownerBeneficiaries.map((beneficiary) => (
              <option key={beneficiary.id} value={beneficiary.id}>
                {beneficiary.beneficiaryName || beneficiary.name || beneficiary.id}
              </option>
            ))}
                  )}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">
                  رمز التحقق الثنائي TOTP Authenticator (6 أرقام):
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={payoutTotpCode}
                  onChange={(e) => setPayoutTotpCode(e.target.value)}
                  placeholder="مثال: 123456"
                  className="w-full bg-slate-950 border border-indigo-500/50 rounded-xl px-3 py-2 text-center text-indigo-400 font-mono text-base tracking-widest font-black"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  رمز تطبيق المصادقة (Google Authenticator / Authy) لضمان أمان أموال الإدارة
                </span>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">ملاحظات الطلب:</label>
                <input
                  type="text"
                  value={payoutNotes}
                  onChange={(e) => setPayoutNotes(e.target.value)}
                  placeholder="سحب أرباح دورية..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setIsPayoutModalOpen(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs"
              >
                إلغاء
              </button>
              <button
                onClick={handleRequestPayout}
                disabled={actionLoading || !payoutAmount || !payoutTotpCode}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold"
              >
                {actionLoading ? 'جارٍ التحقق...' : 'تأكيد الطلب وحجز المبلغ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL 4: CONFIRM EXTERNAL TRANSFER (LEDGER POST) */}
      {/* ---------------------------------------------------- */}
      {confirmModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                تأكيد الحوالة الخارجية وتسجيل القيد في دفتر الأستاذ
              </h3>
              <button onClick={() => setConfirmModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-300">
                أدخل رقم الحوالة البنكية أو الإشعار المصرفي الصادر لتأكيد صرف أرباح المالك وترحيل القيد المحاسبي
                المتوازن (من Retained Earnings إلى Cash).
              </p>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">
                  رقم المرجع المصرفي / إشعار الحوالة (Bank Reference):
                </label>
                <input
                  type="text"
                  value={externalReference}
                  onChange={(e) => setExternalReference(e.target.value)}
                  placeholder="مثال: KUR-WIRE-20261011-8899"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setConfirmModalOpen(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs"
              >
                إلغاء
              </button>
              <button
                onClick={handleConfirmPayout}
                disabled={actionLoading || !externalReference}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold"
              >
                {actionLoading ? 'جارٍ التوثيق...' : 'تأكيد وصرف القيد المحاسبي'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
