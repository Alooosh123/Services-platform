'use client';

import { useState, useEffect } from 'react';
import {
  Clock,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  User,
  Calendar,
  Building2,
  FileText,
  DollarSign,
  ArrowRight,
  Power,
} from 'lucide-react';

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/+$/, '');

interface DepositItem {
  id: string;
  depositNumber: string;
  userId: string;
  walletId: string;
  currency: string;
  amount: number;
  paymentMethodCode: string;
  referenceNumber: string;
  proofImageUrl?: string;
  senderName?: string;
  senderPhone?: string;
  status: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'CREDITED' | 'REJECTED';
  reviewedByUserId?: string;
  reviewNotes?: string;
  rejectionReason?: string;
  ledgerTxId?: string;
  createdAt: string;
  user?: {
    id: string;
    fullName: string;
    email?: string;
    phone?: string;
  };
  statusHistory?: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    notes?: string;
    createdAt: string;
  }>;
}

export default function AdminDepositsPage() {
  const [deposits, setDeposits] = useState<DepositItem[]>([]);
  const [activeView, setActiveView] = useState<'deposits' | 'channels'>('deposits');
  const [channels, setChannels] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDeposit, setSelectedDeposit] = useState<DepositItem | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);

  const requestApi = async (path: string, init: RequestInit = {}) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    const headers = new Headers(init.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

    const response = await fetch(`${API_URL}${path}`, { ...init, headers });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const message = Array.isArray(data?.message) ? data.message.join('، ') : data?.message;
      throw new Error(message || `تعذر تنفيذ الطلب (HTTP ${response.status})`);
    }
    return data;
  };

  const fetchDeposits = async () => {
    setIsLoadingData(true);
    try {
      const query = filterStatus === 'ALL' ? '' : `?status=${encodeURIComponent(filterStatus)}`;
      const data = await requestApi(`/admin/deposits${query}`);
      if (!Array.isArray(data)) throw new Error('استجابة قائمة الإيداعات غير صالحة.');
      setDeposits(data);
      setDataError(null);
    } catch (error) {
      setDeposits([]);
      setDataError(error instanceof Error ? error.message : 'تعذر تحميل الإيداعات من الخادم.');
    } finally {
      setIsLoadingData(false);
    }
  };

  const fetchChannels = async () => {
    try {
      const data = await requestApi('/admin/deposits/channels/all');
      if (!Array.isArray(data)) throw new Error('استجابة قنوات الدفع غير صالحة.');
      setChannels(data);
    } catch (error) {
      setChannels([]);
      setDataError(error instanceof Error ? error.message : 'تعذر تحميل قنوات الدفع من الخادم.');
    }
  };

  useEffect(() => {
    void fetchDeposits();
  }, [filterStatus]);

  useEffect(() => {
    void fetchChannels();
  }, []);

  const handleUpdateSenderIdentifierType = async (code: string, identifierType: string) => {
    const selected = channels.find((item) => item.code === code);
    const currentType = selected?.senderIdentifierType || 'PHONE';
    if (currentType === identifierType) return;
    if (!confirm(`سيتم تغيير معرّف حساب الإرسال لقناة ${code} إلى ${identifierType}. سيحتاج العملاء إلى إعادة حفظ معرّفهم بهذا النوع. هل تريد المتابعة؟`)) return;
    setLoadingAction(true);
    try {
      await requestApi(`/admin/deposits/channels/${encodeURIComponent(code)}/sender-identifier-type`, {
        method: 'POST',
        body: JSON.stringify({ identifierType }),
      });
      await fetchChannels();
      setActionSuccess(`تم تغيير نوع معرّف الإرسال لقناة ${code} إلى ${identifierType}. يجب على العميل إعادة حفظ حساب الإرسال.`);
      setDataError(null);
    } catch (error) {
      setDataError(error instanceof Error ? error.message : 'تعذر تغيير نوع معرّف الإرسال.');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleProposeAccountChange = async (code: string) => {
    const accountNumber = prompt(`أدخل رقم حساب الاستقبال الرسمي لقناة ${code}:`);
    if (!accountNumber?.trim()) return;
    const accountHolderName = prompt('أدخل اسم صاحب الحساب كما يظهر في مستند البنك/المزود:');
    if (!accountHolderName?.trim()) return;
    const instructionsAr = prompt('أدخل تعليمات التحويل التي ستظهر للعملاء:');
    if (!instructionsAr?.trim()) return;

    setLoadingAction(true);
    try {
      await requestApi(`/admin/deposits/channels/${encodeURIComponent(code)}/propose-account`, {
        method: 'POST',
        body: JSON.stringify({
          accountNumber: accountNumber.trim(),
          accountHolderName: accountHolderName.trim(),
          instructionsAr: instructionsAr.trim(),
        }),
      });
      await fetchChannels();
      setDataError(null);
      setActionSuccess(`تم تسجيل مقترح بيانات الاستقبال لقناة ${code}. القناة ما زالت متوقفة حتى مراجعة مالية مستقلة.`);
    } catch (error) {
      setDataError(error instanceof Error ? error.message : 'تعذر تسجيل بيانات حساب الاستقبال.');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleProposeCompliance = async (code: string) => {
    const regulatoryApprovalReference = prompt('رقم/مرجع موافقة الجهة الرقابية (لا تستخدم بيانات غير معتمدة):');
    if (!regulatoryApprovalReference?.trim()) return;
    const regulatoryApprovalDocumentUrl = prompt('رابط HTTPS للمستند الرسمي الخاص بالموافقة الرقابية:');
    if (!regulatoryApprovalDocumentUrl?.trim()) return;
    const providerAgreementReference = prompt('رقم اتفاقية التاجر أو الوكيل مع الجهة المشغلة:');
    if (!providerAgreementReference?.trim()) return;
    const providerAgreementDocumentUrl = prompt('رابط HTTPS لاتفاقية التاجر/الوكيل الموقعة:');
    if (!providerAgreementDocumentUrl?.trim()) return;

    setLoadingAction(true);
    try {
      await requestApi(`/admin/deposits/channels/${encodeURIComponent(code)}/propose-compliance`, {
        method: 'POST',
        body: JSON.stringify({
          regulatoryApprovalReference: regulatoryApprovalReference.trim(),
          regulatoryApprovalDocumentUrl: regulatoryApprovalDocumentUrl.trim(),
          providerAgreementReference: providerAgreementReference.trim(),
          providerAgreementDocumentUrl: providerAgreementDocumentUrl.trim(),
        }),
      });
      await fetchChannels();
      setDataError(null);
      setActionSuccess(`تم إرسال وثائق الاعتماد لقناة ${code} للمراجعة المستقلة. القناة لم تُفعّل.`);
    } catch (error) {
      setDataError(error instanceof Error ? error.message : 'تعذر تسجيل وثائق الاعتماد.');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleApproveFinance = async (code: string, approved: boolean) => {
    const notes = prompt(
      approved
        ? `ملاحظات مراجعة واعتماد حساب ووثائق ${code}:`
        : `سبب رفض بيانات/وثائق قناة ${code}:`,
    );
    if (!notes?.trim()) return;

    setLoadingAction(true);
    try {
      await requestApi(`/admin/deposits/channels/${encodeURIComponent(code)}/finance-approval`, {
        method: 'POST',
        body: JSON.stringify({ approved, financeNotes: notes.trim() }),
      });
      await fetchChannels();
      setDataError(null);
      setActionSuccess(
        approved
          ? `تم اعتماد ملف قناة ${code} مالياً. لا تزال بحاجة إلى تفعيل منفصل من مسؤول آخر.`
          : `تم رفض مقترح قناة ${code} وتوثيق القرار.`,
      );
    } catch (error) {
      setDataError(error instanceof Error ? error.message : 'تعذرت مراجعة القناة مالياً.');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleToggleChannelKillSwitch = async (code: string) => {
    const channel = channels.find((item) => item.code === code);
    if (!channel) return;

    setLoadingAction(true);
    try {
      if (channel.isActive) {
        const reason = prompt(`سبب الإيقاف الطارئ الإلزامي لقناة ${code}:`);
        if (!reason?.trim()) return;
        await requestApi(`/admin/deposits/channels/${encodeURIComponent(code)}/kill-switch`, {
          method: 'POST',
          body: JSON.stringify({ reason: reason.trim() }),
        });
        setActionSuccess(`تم إيقاف قناة ${code} من الخادم وتسجيل سبب الإيقاف.`);
      } else {
        await requestApi(`/admin/deposits/channels/${encodeURIComponent(code)}/switch-mode`, {
          method: 'POST',
          body: JSON.stringify({ mode: 'MANUAL' }),
        });
        setActionSuccess(`قبل الخادم تفعيل قناة ${code} في الوضع اليدوي.`);
      }
      await fetchChannels();
      setDataError(null);
    } catch (error) {
      setDataError(error instanceof Error ? error.message : 'تعذر تغيير حالة القناة.');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleMarkUnderReview = async (depositId: string) => {
    setLoadingAction(true);
    try {
      const data = await requestApi(`/admin/deposits/${depositId}/under-review`, {
        method: 'POST',
        body: JSON.stringify({ reviewNotes: reviewNotes.trim() || 'بدء مطابقة مرجع التحويل مع سجل المحفظة.' }),
      });
      if (data?.deposit) updateLocalDeposit(data.deposit);
      await fetchDeposits();
      setDataError(null);
      setActionSuccess('تم نقل الطلب إلى قيد التدقيق في الخادم.');
    } catch (error) {
      setDataError(error instanceof Error ? error.message : 'تعذر نقل الطلب إلى قيد التدقيق.');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleApproveAndCredit = async (depositId: string) => {
    setLoadingAction(true);
    try {
      const data = await requestApi(`/admin/deposits/${depositId}/approve`, {
        method: 'POST',
        body: JSON.stringify({
          reviewNotes: reviewNotes.trim() || 'تمت مطابقة التحويل من مصدر الحساب المعتمد.',
        }),
      });
      if (!data?.success || !data?.deposit?.ledgerTxId) {
        throw new Error('لم يؤكد الخادم إنشاء قيد محاسبي منشور؛ لم يتم إظهار نجاح الإيداع.');
      }
      updateLocalDeposit(data.deposit);
      await fetchDeposits();
      setDataError(null);
      setActionSuccess(`تم تأكيد الإيداع بعد نشر القيد المحاسبي ${data.deposit.ledgerTxId}.`);
    } catch (error) {
      setDataError(error instanceof Error ? error.message : 'تعذر اعتماد الإيداع. لم يتم تغيير الحالة محلياً.');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleReject = async (depositId: string) => {
    if (!rejectionReason.trim()) {
      alert('سبب الرفض إجباري للعميل');
      return;
    }
    setLoadingAction(true);
    try {
      const data = await requestApi(`/admin/deposits/${depositId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ rejectionReason: rejectionReason.trim() }),
      });
      if (data?.deposit) updateLocalDeposit(data.deposit);
      await fetchDeposits();
      setShowRejectModal(false);
      setRejectionReason('');
      setDataError(null);
      setActionSuccess('تم رفض طلب الإيداع في الخادم وتوثيق السبب.');
    } catch (error) {
      setDataError(error instanceof Error ? error.message : 'تعذر رفض طلب الإيداع.');
    } finally {
      setLoadingAction(false);
    }
  };

  const updateLocalDeposit = (updated: DepositItem) => {
    setDeposits((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    if (selectedDeposit?.id === updated.id) {
      setSelectedDeposit(updated);
    }
  };

  const filteredDeposits = deposits.filter((d) => {
    const matchesFilter = filterStatus === 'ALL' || d.status === filterStatus;
    const matchesSearch =
      !searchTerm ||
      d.depositNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.senderName && d.senderName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (d.user?.fullName && d.user.fullName.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  const getStatusBadge = (status: DepositItem['status']) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Clock className="w-3.5 h-3.5" /> قيد الانتظار
          </span>
        );
      case 'UNDER_REVIEW':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-500/10 text-sky-400 border border-sky-500/30">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> قيد المراجعة والمطابقة
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30">
            <CheckCircle className="w-3.5 h-3.5" /> معتمد مبدئياً
          </span>
        );
      case 'CREDITED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle className="w-3.5 h-3.5" /> مقيد في المحفظة
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <XCircle className="w-3.5 h-3.5" /> مرفوض
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <DollarSign className="w-7 h-7 text-emerald-400" />
            إيداعات العملاء والتحقق المالي
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            مراجعة حوالات المحافظ اليمنية (جيب، جوالي، كاش، ون كاش، إيزي) واعتمادها بالقيد المزدوج.
          </p>
        </div>

        <button
          onClick={fetchDeposits}
          className="flex items-center gap-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors"
        >
          <RefreshCw className="w-4 h-4 text-indigo-400" /> تحديث القائمة
        </button>
      </div>

      {actionSuccess && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-3 text-emerald-400 text-xs font-bold">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {dataError && (
        <div role="alert" className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 text-xs">
          {dataError}
        </div>
      )}
      {isLoadingData && (
        <p role="status" className="text-xs text-slate-400">جاري تحميل البيانات المؤكدة من الخادم...</p>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800 gap-4">
        <button
          onClick={() => setActiveView('deposits')}
          className={`pb-3 px-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
            activeView === 'deposits'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <DollarSign className="w-4 h-4" /> طلبات إيداعات العملاء ومطابقة الحوالات
        </button>
        <button
          onClick={() => setActiveView('channels')}
          className={`pb-3 px-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
            activeView === 'channels'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4" /> قنوات الدفع والاعتماد المالي المزدوج (Four-Eyes & Kill Switch - P06)
          {channels.filter((c) => c.verificationStatus === 'PENDING_REVIEW').length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
              {channels.filter((c) => c.verificationStatus === 'PENDING_REVIEW').length} بانتظار المالية
            </span>
          )}
        </button>
      </div>

      {activeView === 'deposits' && (
        <>
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <span className="text-slate-400 text-[11px] font-bold block mb-1">
                بانتظار المراجعة (PENDING)
              </span>
              <span className="text-2xl font-black font-mono text-amber-400">
                {deposits.filter((d) => d.status === 'PENDING').length}
              </span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <span className="text-slate-400 text-[11px] font-bold block mb-1">
                قيد التدقيق (UNDER REVIEW)
              </span>
              <span className="text-2xl font-black font-mono text-sky-400">
                {deposits.filter((d) => d.status === 'UNDER_REVIEW').length}
              </span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <span className="text-slate-400 text-[11px] font-bold block mb-1">
                المقيدة بنجاح (CREDITED)
              </span>
              <span className="text-2xl font-black font-mono text-emerald-400">
                {deposits.filter((d) => d.status === 'CREDITED').length}
              </span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <span className="text-slate-400 text-[11px] font-bold block mb-1">
                الطلبات المرفوضة (REJECTED)
              </span>
              <span className="text-2xl font-black font-mono text-rose-400">
                {deposits.filter((d) => d.status === 'REJECTED').length}
              </span>
            </div>
          </div>

          {/* Filter and Search Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {['ALL', 'PENDING', 'UNDER_REVIEW', 'CREDITED', 'REJECTED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    filterStatus === st
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {st === 'ALL' && 'الكل'}
                  {st === 'PENDING' && 'قيد الانتظار'}
                  {st === 'UNDER_REVIEW' && 'قيد التدقيق'}
                  {st === 'CREDITED' && 'المقيدة'}
                  {st === 'REJECTED' && 'المرفوضة'}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-72">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="بحث برقم الطلب، الحوالة، أو الاسم..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-right pr-9"
              />
              <Search className="w-4 h-4 text-slate-500 absolute right-3 top-2.5" />
            </div>
          </div>

          {/* Deposits Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-bold">
                  <tr>
                    <th className="py-3 px-4">رقم الطلب</th>
                    <th className="py-3 px-4">العميل</th>
                    <th className="py-3 px-4">القناة</th>
                    <th className="py-3 px-4">المبلغ</th>
                    <th className="py-3 px-4">الرقم المرجعي</th>
                    <th className="py-3 px-4">الحالة</th>
                    <th className="py-3 px-4">التاريخ</th>
                    <th className="py-3 px-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredDeposits.map((dep) => (
                    <tr key={dep.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-4 px-4 font-mono font-bold text-indigo-300">
                        {dep.depositNumber}
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-bold text-white block">
                          {dep.user?.fullName || dep.senderName || 'عميل تجريبي'}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-mono">
                          {dep.user?.phone || dep.senderPhone}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="bg-slate-800 px-2 py-0.5 rounded text-[11px] font-bold text-slate-200">
                          {dep.paymentMethodCode}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-mono font-black text-sm text-emerald-400">
                        {dep.amount.toLocaleString('en-US')} {dep.currency}
                      </td>
                      <td className="py-4 px-4 font-mono text-slate-300">{dep.referenceNumber}</td>
                      <td className="py-4 px-4">{getStatusBadge(dep.status)}</td>
                      <td className="py-4 px-4 text-slate-400 font-mono text-[11px]">
                        {new Date(dep.createdAt).toLocaleDateString('ar-EG', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={() => setSelectedDeposit(dep)}
                          className="bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 px-3 py-1.5 rounded-xl font-bold text-xs transition-colors"
                        >
                          معاينة وتدقيق
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeView === 'channels' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">قنوات الدفع والمحافظ الإلكترونية اليمنية</h2>
              <p className="text-xs text-slate-400">
                إدارة أرقام الحسابات المستقبلة، فرض مبدأ الرقابة الثنائية (Four-Eyes Principle) عند تعديل الحسابات، وزر الإيقاف الطارئ (Kill Switch).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {channels.map((channel) => (
              <div
                key={channel.code}
                className={`bg-slate-900 border rounded-2xl p-5 space-y-4 transition-all ${
                  !channel.isActive
                    ? 'border-rose-900/60 bg-rose-950/20'
                    : channel.verificationStatus === 'PENDING_REVIEW'
                    ? 'border-amber-700/60 bg-amber-950/10'
                    : 'border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">{channel.nameAr || channel.name}</h3>
                      <span className="text-[10px] text-slate-400 font-mono">كود القناة: {channel.code}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        channel.verificationStatus === 'VERIFIED'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : channel.verificationStatus === 'PENDING_REVIEW'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'bg-rose-950 text-rose-300 border border-rose-800'
                      }`}
                    >
                      {channel.verificationStatus === 'VERIFIED' && 'موثقة وقانونية'}
                      {channel.verificationStatus === 'PENDING_REVIEW' && 'بانتظار موافقة المالية'}
                      {channel.verificationStatus === 'REJECTED' && 'مرفوضة'}
                    </span>

                    <button
                      disabled={loadingAction}
                      onClick={() => handleToggleChannelKillSwitch(channel.code)}
                      title={channel.isActive ? 'إيقاف طارئ للقناة (Kill Switch)' : 'استعادة التشغيل'}
                      className={`p-1.5 rounded-lg transition-colors ${
                        channel.isActive
                          ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                      }`}
                    >
                      <Power className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">رقم الحساب المعتمد الحالي:</span>
                    <span className="font-mono font-bold text-emerald-400 text-sm">
                      {channel.accountNumber && channel.accountNumber !== 'NOT_CONFIGURED' ? channel.accountNumber : 'غير مهيأ'}
                    </span>
                  </div>

                  {channel.pendingAccountNumber && (
                    <div className="flex justify-between items-center p-2 rounded-lg bg-amber-950/40 border border-amber-800/60 text-amber-300">
                      <span>رقم الحساب الجديد المقترح:</span>
                      <span className="font-mono font-bold text-amber-200">{channel.pendingAccountNumber}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-[11px] text-slate-500">
                    <span>وضع التشغيل: {channel.mode}</span>
                    <span>العملة: {(channel.supportedCurrencies || []).join(' / ') || 'غير محددة'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-800">
                    <label htmlFor={`sender-id-type-${channel.code}`} className="text-slate-400 text-[11px]">
                      معرّف حساب العميل المرسل:
                    </label>
                    <select
                      id={`sender-id-type-${channel.code}`}
                      value={channel.senderIdentifierType || 'PHONE'}
                      disabled={loadingAction}
                      onChange={(event) => void handleUpdateSenderIdentifierType(channel.code, event.target.value)}
                      className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                    >
                      <option value="ALIAS">رقم بديل (ALIAS)</option>
                      <option value="PHONE">رقم الهاتف المرتبط (PHONE)</option>
                      <option value="WALLET_ID">معرّف المحفظة (WALLET_ID)</option>
                      <option value="ACCOUNT_NUMBER">رقم الحساب (ACCOUNT_NUMBER)</option>
                    </select>
                  </div>
                </div>

                {!channel.isActive && (
                  <div className="p-2.5 rounded-xl bg-rose-950/50 border border-rose-900 text-rose-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>⚠️ {channel.killSwitchReason || 'القناة متوقفة بزر الطوارئ لمنع الاحتيال'}</span>
                  </div>
                )}

                {/* Four-Eyes Actions */}
                <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-3">
                    <button
                      disabled={loadingAction}
                      onClick={() => handleProposeAccountChange(channel.code)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 disabled:opacity-50"
                    >
                      إعداد/تعديل حساب الاستقبال
                    </button>
                    <button
                      disabled={loadingAction}
                      onClick={() => handleProposeCompliance(channel.code)}
                      className="text-xs text-sky-400 hover:text-sky-300 font-bold disabled:opacity-50"
                    >
                      تسجيل وثائق الاعتماد
                    </button>
                  </div>

                  {channel.verificationStatus === 'PENDING_REVIEW' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApproveFinance(channel.code, false)}
                        className="px-2.5 py-1 rounded-lg text-xs bg-rose-950 text-rose-300 hover:bg-rose-900 border border-rose-800"
                      >
                        رفض التعديل
                      </button>
                      <button
                        onClick={() => handleApproveFinance(channel.code, true)}
                        className="px-3 py-1 rounded-lg text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md shadow-emerald-600/30 flex items-center gap-1"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" /> موافقة واعتماد المالية
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Review Modal */}
      {selectedDeposit && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 space-y-6 shadow-2xl text-right max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-400" />
                تدقيق طلب الإيداع: {selectedDeposit.depositNumber}
              </h3>
              <button
                onClick={() => setSelectedDeposit(null)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <div>
                <span className="text-slate-400 block mb-0.5">القناة البنكية:</span>
                <span className="font-bold text-white text-sm">
                  {selectedDeposit.paymentMethodCode}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">المبلغ المطلوب:</span>
                <span className="font-bold font-mono text-emerald-400 text-base">
                  {selectedDeposit.amount.toLocaleString('en-US')} {selectedDeposit.currency}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">الرقم المرجعي للحوالة:</span>
                <span className="font-bold font-mono text-indigo-300">
                  {selectedDeposit.referenceNumber}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">الحالة الحالية:</span>
                <div>{getStatusBadge(selectedDeposit.status)}</div>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">اسم المحول:</span>
                <span className="font-bold text-slate-200">
                  {selectedDeposit.senderName || selectedDeposit.user?.fullName}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">رقم الهاتف:</span>
                <span className="font-mono text-slate-200">
                  {selectedDeposit.senderPhone || selectedDeposit.user?.phone}
                </span>
              </div>
            </div>

            {/* Receipt Proof Preview */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-indigo-400" /> صورة إشعار الحوالة (السند البنكي)
              </span>
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-center">
                <div className="aspect-video max-h-48 bg-slate-900 rounded-xl flex items-center justify-center border border-slate-800 text-slate-400 text-xs font-mono">
                  {selectedDeposit.proofImageUrl || 'صورة الإشعار: /images/proofs/receipt.jpg'}
                </div>
              </div>
            </div>

            {/* Notes Input */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                ملاحظات التدقيق المالي
              </label>
              <textarea
                rows={2}
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="أدخل ملاحظات مطابقة الإشعار مع كشف الحساب البنكي..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 text-right"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800">
              {selectedDeposit.status === 'PENDING' && (
                <button
                  type="button"
                  disabled={loadingAction}
                  onClick={() => handleMarkUnderReview(selectedDeposit.id)}
                  className="bg-sky-600 hover:bg-sky-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> نقل إلى قيد التدقيق
                </button>
              )}

              {selectedDeposit.status !== 'CREDITED' && selectedDeposit.status !== 'REJECTED' && (
                <>
                  <button
                    type="button"
                    disabled={loadingAction}
                    onClick={() => handleApproveAndCredit(selectedDeposit.id)}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-colors shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> موافقة وتغذية الرصيد بالقيد المزدوج
                  </button>

                  <button
                    type="button"
                    disabled={loadingAction}
                    onClick={() => setShowRejectModal(true)}
                    className="bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-colors"
                  >
                    رفض الطلب
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => setSelectedDeposit(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 px-4 rounded-xl text-xs transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedDeposit && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl text-right">
            <h3 className="text-base font-bold text-rose-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              تأكيد رفض طلب الإيداع
            </h3>
            <p className="text-xs text-slate-400">
              يرجى كتابة سبب الرفض بوضوح ليتم إرساله للعميل وتوثيقه في سجل التدقيق:
            </p>

            <textarea
              required
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="مثال: رقم الإشعار غير مطابق لكشف الحساب البنكي أو المبلغ غير واصل..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500 text-right"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="flex-1 bg-slate-800 text-slate-300 font-bold py-2.5 rounded-xl text-xs"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={loadingAction || !rejectionReason.trim()}
                onClick={() => handleReject(selectedDeposit.id)}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 rounded-xl text-xs disabled:opacity-50"
              >
                تأكيد الرفض
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
