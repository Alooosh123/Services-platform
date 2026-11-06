'use client';

import { useState, useEffect } from 'react';
import {
  DollarSign,
  Bot,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  ExternalLink,
  Smartphone,
  Landmark,
  Coins,
  Send,
  Eye,
  Check,
  X,
  FileText,
} from 'lucide-react';

export default function DepositsManagementPage() {
  const [deposits, setDeposits] = useState<any[]>([]);
  const [stats, setStats] = useState({
    pendingManualReview: 0,
    autoCreditedOrApproved: 0,
    totalDeposits: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'PENDING' | 'CREDITED' | 'ALL'>('PENDING');
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // SMS / OCR Simulator state for Owner testing
  const [showSimulator, setShowSimulator] = useState(false);
  const [simulatorText, setSimulatorText] = useState(
    'تم تحويل 25000 ريال يمني بنجاح إلى حساب جيب 782600400 من رقم 771234567 مرجع JIB-992812'
  );
  const [simulatorPhone, setSimulatorPhone] = useState('771234567');
  const [simulatorLoading, setSimulatorLoading] = useState(false);
  const [simulatorResult, setSimulatorResult] = useState<any>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

  const fetchDeposits = async () => {
    setLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') || localStorage.getItem('token') || '' : '';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_URL}/admin/deposits?status=${activeTab}&limit=50`, { headers });
      if (res.ok) {
        const data = await res.json();
        setDeposits(data.items || []);
        if (data.stats) {
          setStats(data.stats);
        }
      } else {
        // Fallback to listPending
        const pendingRes = await fetch(`${API_URL}/admin/deposits/pending`, { headers });
        if (pendingRes.ok) {
          const pData = await pendingRes.json();
          setDeposits(pData.items || []);
          setStats((prev) => ({ ...prev, pendingManualReview: pData.total || 0 }));
        }
      }
    } catch (err: any) {
      console.warn('Deposits fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeposits();
  }, [activeTab]);

  const handleApprove = async (depositId: string) => {
    setActionLoading(depositId);
    setFeedback(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') || localStorage.getItem('token') || '' : '';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_URL}/admin/deposits/${depositId}/approve`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ notes: 'اعتماد يدوي مباشر وتغذية المحفظة بواسطة مالك المنصة' }),
      });

      const data = await res.json();
      if (res.ok) {
        setFeedback({
          type: 'success',
          message: data.message || 'تم اعتماد الإيداع بنجاح وتغذية رصيد العميل فورياً.',
        });
        fetchDeposits();
      } else {
        setFeedback({
          type: 'error',
          message: data.message || 'فشل اعتماد الإيداع، يرجى المحاولة لاحقاً.',
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'حدث خطأ أثناء الاعتماد' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (depositId: string) => {
    const reason = window.prompt('يرجى كتابة سبب رفض الإيداع:', 'سند غير مطابق أو لم يتم استلام المبلغ في الحساب');
    if (!reason) return;

    setActionLoading(depositId);
    setFeedback(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') || localStorage.getItem('token') || '' : '';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_URL}/admin/deposits/${depositId}/reject`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reason }),
      });

      const data = await res.json();
      if (res.ok) {
        setFeedback({
          type: 'success',
          message: data.message || 'تم رفض الإيداع وتوثيق السبب.',
        });
        fetchDeposits();
      } else {
        setFeedback({
          type: 'error',
          message: data.message || 'فشل رفض الإيداع.',
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'حدث خطأ أثناء الرفض' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRunSimulator = async () => {
    setSimulatorLoading(true);
    setSimulatorResult(null);
    try {
      const res = await fetch(`${API_URL}/ai-agents/auto-credit-deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationText: simulatorText,
          depositorPhone: simulatorPhone,
        }),
      });
      const data = await res.json();
      setSimulatorResult(data);
      fetchDeposits();
    } catch (err: any) {
      setSimulatorResult({ error: err.message });
    } finally {
      setSimulatorLoading(false);
    }
  };

  const filteredDeposits = deposits.filter((d) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (d.depositNumber && d.depositNumber.toLowerCase().includes(q)) ||
      (d.referenceNumber && d.referenceNumber.toLowerCase().includes(q)) ||
      (d.senderPhone && d.senderPhone.includes(q)) ||
      (d.user?.fullName && d.user.fullName.toLowerCase().includes(q)) ||
      (d.user?.phone && d.user.phone.includes(q))
    );
  });

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto font-sans" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                إيداعات العملاء والتحقق الآلي بالذكاء الاصطناعي
              </h1>
              <p className="text-sm text-slate-400">
                منظومة التدقيق الذكي (AI OCR & Auto-Creditor) للمحافظ والبنوك اليمنية مع الاعتماد اليدوي لمالك التطبيق
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSimulator(!showSimulator)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 text-sm font-medium hover:bg-indigo-600/30 transition-all"
          >
            <Smartphone className="w-4 h-4" />
            {showSimulator ? 'إخفاء محاكي الإشعارات' : 'فحص إشعار تجريبي (Simulator)'}
          </button>
          <button
            onClick={fetchDeposits}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-slate-200 border border-slate-700 text-sm font-medium hover:bg-slate-700 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            تحديث البيانات
          </button>
        </div>
      </div>

      {/* Official Merchant Accounts Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-indigo-300 font-semibold text-sm">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
            الحسابات الرسمية المعتمدة لمالك المنصة (المطابقة آلياً عبر الذكاء الاصطناعي)
          </div>
          <span className="text-xs bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full font-mono border border-indigo-500/30">
            المنطقة المالية: جنوب شلن / ريال يمني (YER)
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Landmark className="w-4 h-4 text-amber-400" />
              <div>
                <p className="text-xs text-slate-400">بنك الكريمي (حاسب/جوال)</p>
                <p className="text-sm font-bold text-white font-mono">3048773717</p>
              </div>
            </div>
            <span className="text-[11px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20">جنوب شلن</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Smartphone className="w-4 h-4 text-emerald-400" />
              <div>
                <p className="text-xs text-slate-400">محفظة جيب (CAC Bank)</p>
                <p className="text-sm font-bold text-white font-mono">782600400</p>
              </div>
            </div>
            <span className="text-[11px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">شحن فوري</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Smartphone className="w-4 h-4 text-blue-400" />
              <div>
                <p className="text-xs text-slate-400">جوالي / ون كاش / وي كاش</p>
                <p className="text-sm font-bold text-white font-mono">782600400</p>
              </div>
            </div>
            <span className="text-[11px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20">شحن فوري</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Coins className="w-4 h-4 text-teal-400" />
              <div>
                <p className="text-xs text-slate-400">محفظة USDT (تيثر)</p>
                <p className="text-xs font-bold text-white font-mono truncate max-w-[140px]" title="TGy4uXg2kmCPuMwGrRKpzKC6Zi6cx5Fssx">
                  TGy4uXg2kmCP...
                </p>
              </div>
            </div>
            <span className="text-[11px] bg-teal-500/10 text-teal-400 px-2 py-0.5 rounded border border-teal-500/20">TRC20 / EVM</span>
          </div>
        </div>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-3">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <p className="text-sm font-medium">{feedback.message}</p>
          </div>
          <button onClick={() => setFeedback(null)} className="text-xs hover:underline">
            إغلاق
          </button>
        </div>
      )}

      {/* Simulator Drawer for testing */}
      {showSimulator && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-indigo-500/40 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-indigo-300 font-bold">
              <Bot className="w-5 h-5" />
              محاكي فحص الإشعارات ورسائل الـ SMS بالذكاء الاصطناعي (Gemini 3 Flash Vision & NLP)
            </div>
            <span className="text-xs text-slate-400">اختبر استجابة الوكيل الذكي وقراره الفوري</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs text-slate-300 font-medium">نص الرسالة أو الإشعار الوارد لهاتف المالك:</label>
              <textarea
                value={simulatorText}
                onChange={(e) => setSimulatorText(e.target.value)}
                rows={3}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                placeholder="أدخل نص إشعار الإيداع..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-300 font-medium">رقم هاتف المودع (للبحث والربط بمحفظته):</label>
              <input
                type="text"
                value={simulatorPhone}
                onChange={(e) => setSimulatorPhone(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                placeholder="مثال: 771234567"
              />
              <button
                onClick={handleRunSimulator}
                disabled={simulatorLoading}
                className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 disabled:opacity-50"
              >
                {simulatorLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                تشغيل وكيل الفحص والشحن
              </button>
            </div>
          </div>

          {simulatorResult && (
            <div
              className={`p-4 rounded-xl border text-sm ${
                simulatorResult.isAutoCredited
                  ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                  : 'bg-amber-950/30 border-amber-500/40 text-amber-200'
              }`}
            >
              <div className="flex items-center gap-2 font-bold mb-2">
                {simulatorResult.isAutoCredited ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                )}
                قرار الوكيل: {simulatorResult.status}
              </div>
              <p className="mb-2">{simulatorResult.reasonAr}</p>
              {simulatorResult.extracted && (
                <div className="text-xs font-mono bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 space-y-1">
                  <div>القناة المستخرجة: {simulatorResult.extracted.channel}</div>
                  <div>المبلغ: {simulatorResult.extracted.amount} {simulatorResult.extracted.currency}</div>
                  <div>رقم المستلم: {simulatorResult.extracted.recipientAccount}</div>
                  <div>المرجع: {simulatorResult.extracted.referenceNumber}</div>
                  <div>نسبة الثقة: {((simulatorResult.extracted.confidenceScore || 0) * 100).toFixed(0)}%</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">بانتظار مراجعة مالك التطبيق</p>
            <p className="text-3xl font-extrabold text-amber-400 mt-2 font-mono">
              {stats.pendingManualReview}
            </p>
            <p className="text-xs text-slate-500 mt-1">تتطلب تدقيق المالك واعتماده يدوياً</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">معتمدة آلياً (AI Auto-Credited)</p>
            <p className="text-3xl font-extrabold text-emerald-400 mt-2 font-mono">
              {stats.autoCreditedOrApproved}
            </p>
            <p className="text-xs text-slate-500 mt-1">شحن مباشر فوري دون تدخل بشري</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">إجمالي سجل العمليات</p>
            <p className="text-3xl font-extrabold text-indigo-400 mt-2 font-mono">
              {stats.totalDeposits || deposits.length}
            </p>
            <p className="text-xs text-slate-500 mt-1">مسجلة في قاعدة بيانات PostgreSQL</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 p-1.5 bg-slate-900 border border-slate-800 rounded-xl">
          <button
            onClick={() => setActiveTab('PENDING')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'PENDING'
                ? 'bg-amber-600/20 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            بانتظار المراجعة والاعتماد ({stats.pendingManualReview})
          </button>
          <button
            onClick={() => setActiveTab('CREDITED')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'CREDITED'
                ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            معتمدة بالذكاء الاصطناعي ({stats.autoCreditedOrApproved})
          </button>
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'ALL'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            كافة السجلات
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث برقم السند، الهاتف، العميل..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-4 pr-10 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Deposits List */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-16 text-center text-slate-400 bg-slate-900/40 rounded-2xl border border-slate-800 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-400" />
            <p className="text-sm">جاري جلب إيداعات وسجلات التدقيق من قاعدة البيانات...</p>
          </div>
        ) : filteredDeposits.length === 0 ? (
          <div className="p-16 text-center text-slate-400 bg-slate-900/40 rounded-2xl border border-slate-800">
            <CheckCircle2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-base font-medium text-slate-300">لا توجد طلبات إيداع معلقة حالياً</p>
            <p className="text-xs text-slate-500 mt-1">
              جميع الإيداعات تمت معالجتها وتدقيقها بالكامل بواسطة الوكيل الذكي أو تم اعتمادها مسبقاً.
            </p>
          </div>
        ) : (
          filteredDeposits.map((item) => {
            const isCredited = item.status === 'CREDITED' || item.status === 'APPROVED';
            const isPending = item.status === 'PENDING' || item.status === 'UNDER_REVIEW';
            const isRejected = item.status === 'REJECTED';

            return (
              <div
                key={item.id}
                className={`p-6 rounded-2xl border transition-all ${
                  isPending
                    ? 'bg-slate-900/90 border-amber-500/40 hover:border-amber-500/60 shadow-lg shadow-amber-950/20'
                    : isCredited
                    ? 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    : 'bg-slate-900/40 border-rose-900/30'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: General & User Details */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold font-mono text-white">
                        {item.depositNumber || `DEP-${item.id.slice(0, 8)}`}
                      </span>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${
                          isPending
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            : isCredited
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        }`}
                      >
                        {isPending
                          ? 'بانتظار مراجعة المالك'
                          : isCredited
                          ? 'معتمد ومقيد في المحفظة'
                          : 'مرفوض'}
                      </span>
                      <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono border border-slate-700">
                        {item.paymentMethodCode || item.channelCode}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        {new Date(item.createdAt).toLocaleString('ar-YE')}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-slate-300">
                      <div>
                        العميل:{' '}
                        <span className="text-white font-medium">
                          {item.user?.fullName || item.senderName || 'عميل مسجل'}
                        </span>
                      </div>
                      <div>
                        هاتف العميل / المرسل:{' '}
                        <span className="text-indigo-400 font-mono font-medium">
                          {item.user?.phone || item.senderPhone || 'غير متوفر'}
                        </span>
                      </div>
                      <div>
                        الرقم المرجعي / السند:{' '}
                        <span className="text-slate-200 font-mono font-bold">
                          {item.referenceNumber || item.transactionReference}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Amount & Action Buttons */}
                  <div className="flex items-center justify-between lg:justify-end gap-6 border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-800">
                    <div className="text-left">
                      <p className="text-2xl font-black text-emerald-400 font-mono">
                        {Number(item.amount).toLocaleString('en-US')}{' '}
                        <span className="text-sm font-sans text-emerald-500">
                          {item.currency === 'YER' ? 'جنوب شلن / ريال' : item.currency}
                        </span>
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {item.currency === 'YER' ? 'شلن جنوبي (عدن والمناطق المحررة)' : 'دولار أمريكي'}
                      </p>
                    </div>

                    {isPending && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApprove(item.id)}
                          disabled={actionLoading === item.id}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-all shadow-lg shadow-emerald-600/30 disabled:opacity-50"
                        >
                          {actionLoading === item.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                          اعتماد وقيد فوري
                        </button>
                        <button
                          onClick={() => handleReject(item.id)}
                          disabled={actionLoading === item.id}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 text-xs font-medium transition-all"
                        >
                          <X className="w-4 h-4" />
                          رفض
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* AI Review Notes Box */}
                {(item.reviewNotes || item.rejectionReason) && (
                  <div className="mt-4 p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs flex items-start gap-3">
                    <Bot className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-1">
                      <p className="text-slate-300 leading-relaxed font-sans">
                        {item.reviewNotes || `سبب الرفض: ${item.rejectionReason}`}
                      </p>
                      {item.ledgerTxId && (
                        <p className="text-[10px] text-indigo-400 font-mono">
                          رقم القيد في دفتر الأستاذ (Double-Entry Ledger): {item.ledgerTxId}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

