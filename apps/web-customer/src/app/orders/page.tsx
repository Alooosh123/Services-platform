'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShoppingBag,
  Clock,
  CheckCircle,
  AlertCircle,
  RotateCcw,
  Copy,
  Check,
  ChevronLeft,
  Filter,
  Eye,
  FileText,
} from 'lucide-react';
import { apiUrl } from '../../lib/api';

export default function CustomerOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [copiedVoucher, setCopiedVoucher] = useState<string | null>(null);

  const fetchOrders = async (filter?: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('customer_token') : null;
      let url = `${apiUrl('/orders/my-orders')}?limit=50`;
      if (filter && filter !== 'ALL') {
        url += `&status=${filter}`;
      }

      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (res.ok) {
        const data = await res.json();
        setOrders(data.data || []);
      } else {
        setOrders([]);
        setLoadError('تعذر تحميل سجل الطلبات. سجّل الدخول أو أعد المحاولة.');
      }
    } catch (err) {
      setOrders([]);
      setLoadError(err instanceof Error ? err.message : 'تعذر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders(statusFilter);
  }, [statusFilter]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedVoucher(id);
    setTimeout(() => setCopiedVoucher(null), 2500);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle className="w-3 h-3" /> تم التسليم بنجاح
          </span>
        );
      case 'Processing':
      case 'Queued':
      case 'Paid':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Clock className="w-3 h-3 animate-spin" /> قيد التنفيذ
          </span>
        );
      case 'ManualReview':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertCircle className="w-3 h-3" /> مراجعة المشغل اليدوية
          </span>
        );
      case 'Refunded':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <RotateCcw className="w-3 h-3" /> مسترد إلى المحفظة
          </span>
        );
      case 'Failed':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertCircle className="w-3 h-3" /> فشل التسليم
          </span>
        );
      default:
        return (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 text-right">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl font-black text-white">سجل شحناتي وطلباتي</h1>
          <p className="text-xs text-slate-400 mt-1">
            متابعة فورية ومباشرة لحالات تسليم شدات الألعاب، الرصيد المحجوز، وأكواد القسائم الرقمية
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/20"
        >
          <ShoppingBag className="w-4 h-4" /> شحن طلب جديد
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <span className="text-xs text-slate-400 flex items-center gap-1 ml-2">
          <Filter className="w-3.5 h-3.5" /> تصفية:
        </span>
        {[
          { key: 'ALL', label: 'كافة الطلبات' },
          { key: 'Completed', label: 'المكتملة' },
          { key: 'Processing', label: 'قيد التنفيذ' },
          { key: 'ManualReview', label: 'المراجعة اليدوية' },
          { key: 'Refunded', label: 'المستردة' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
              statusFilter === tab.key
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 text-sm">
          جاري تحميل سجل الطلبات...
        </div>
      ) : loadError ? (
        <div role="alert" className="py-20 text-center text-rose-400 text-sm">
          {loadError}
          <p className="mt-3">
            <Link href="/login" className="text-indigo-400 hover:underline">سجّل الدخول لعرض طلباتك</Link>
          </p>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-4">
          <FileText className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white">لا توجد طلبات مطابقة</h3>
          <p className="text-xs text-slate-400">لم تقم بإجراء أي عمليات شحن في هذا التصنيف حتى الآن.</p>
          <Link
            href="/"
            className="inline-block px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-500 transition-colors"
          >
            تصفح متجر الخدمات والشحن
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((ord) => {
            const beneficiary = ord.snapshotBeneficiaryFields || {};
            const playerVal = beneficiary.player_id || beneficiary.user_id || Object.values(beneficiary)[0] || '—';

            return (
              <div
                key={ord.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all space-y-4"
              >
                {/* Top Row: Order Number & Status Badge */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-indigo-400">
                      {ord.orderNumber}
                    </span>
                    {getStatusBadge(ord.status)}
                  </div>
                  <span className="text-xs text-slate-500 font-mono">
                    {new Date(ord.createdAt).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                </div>

                {/* Middle Content */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-white">
                      {ord.snapshotServiceNameAr || ord.snapshotServiceName} -{' '}
                      <span className="text-slate-300 font-normal">
                        {ord.snapshotProductNameAr || ord.snapshotProductName}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      حساب المستفيد: <span className="text-white font-mono font-bold">{String(playerVal)}</span>
                    </p>
                  </div>

                  <div className="flex sm:flex-col items-end justify-between sm:justify-center border-t sm:border-0 border-slate-800 pt-3 sm:pt-0">
                    <span className="text-lg font-black font-mono text-emerald-400">
                      {Number(ord.snapshotRetailPrice).toLocaleString()} {ord.snapshotCurrency}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      الدفع عبر المحفظة الحقيقية
                    </span>
                  </div>
                </div>

                {/* Voucher Code Box if delivered */}
                {ord.voucherCode && (
                  <div className="bg-slate-950/80 border border-emerald-500/20 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-emerald-400">كود القسيمة / PIN:</span>
                      <code className="text-sm font-mono font-black text-white bg-slate-900 px-3 py-1 rounded border border-slate-800 tracking-wider">
                        {ord.voucherCode}
                      </code>
                    </div>
                    <button
                      onClick={() => copyToClipboard(ord.voucherCode, ord.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-colors w-fit"
                    >
                      {copiedVoucher === ord.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" /> تم النسخ!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> نسخ الكود
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Bottom Action: Link to Detailed Stepper */}
                <div className="flex items-center justify-end pt-1">
                  <Link
                    href={`/orders/${ord.id}`}
                    className="inline-flex items-center gap-1 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    عرض تفاصيل ومسار الشحن <ChevronLeft className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
