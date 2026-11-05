'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  Copy,
  Check,
  ShieldCheck,
  Gamepad2,
  RotateCcw,
  Eye,
  EyeOff,
  Printer,
  ChevronRight,
} from 'lucide-react';
import { apiUrl } from '../../../lib/api';

export default function OrderDetailsPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copiedVoucher, setCopiedVoucher] = useState(false);
  const [showVoucher, setShowVoucher] = useState(true);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('customer_token') : null;
        const res = await fetch(apiUrl(`/orders/${id}`), {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          setOrder(data);
        } else {
          setOrder(null);
          setLoadError('تعذر تحميل الطلب. تحقق من تسجيل الدخول أو صحة رقم الطلب.');
        }
      } catch (err) {
        setOrder(null);
        setLoadError(err instanceof Error ? err.message : 'تعذر الاتصال بالخادم');
      } finally {
        setLoading(false);
      }
    };

    const loadFallback = () => {
      setOrder({
        id,
        orderNumber: `ORD-${Date.now().toString().slice(-6)}`,
        snapshotServiceNameAr: 'ببجي موبايل',
        snapshotServiceName: 'PUBG Mobile',
        snapshotProductNameAr: '660 شدة ببجي',
        snapshotProductName: '660 UC',
        snapshotRetailPrice: 5500,
        snapshotCurrency: 'YER',
        snapshotBeneficiaryFields: { player_id: '512938475' },
        status: 'Completed',
        voucherCode: 'PUBG-8877-6655-4433',
        createdAt: new Date().toISOString(),
        statusHistory: [
          { oldStatus: 'AwaitingPayment', newStatus: 'Queued', reason: 'تم حجز الرصيد من المحفظة', createdAt: new Date(Date.now() - 120000).toISOString() },
          { oldStatus: 'Queued', newStatus: 'Processing', reason: 'إرسال الطلب لمحرك التنفيذ', createdAt: new Date(Date.now() - 60000).toISOString() },
          { oldStatus: 'Processing', newStatus: 'Completed', reason: 'تم تسليم الشحنة بنجاح', createdAt: new Date().toISOString() },
        ],
      });
    };

    fetchOrder();
  }, [id]);

  const copyVoucher = () => {
    if (order?.voucherCode) {
      navigator.clipboard.writeText(order.voucherCode);
      setCopiedVoucher(true);
      setTimeout(() => setCopiedVoucher(false), 2500);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-24 text-center text-slate-400 text-sm">
        جاري تحميل تفاصيل الشحنة...
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-4xl mx-auto py-24 text-center space-y-4">
        <p role="alert" className="text-rose-400 font-bold">{loadError || 'لم يتم العثور على الطلب المطلوب.'}</p>
        <Link href="/orders" className="text-indigo-400 underline text-xs">
          العودة إلى سجل طلباتي
        </Link>
      </div>
    );
  }

  const beneficiary = order.snapshotBeneficiaryFields || {};
  const isCompleted = order.status === 'Completed';
  const isFailed = order.status === 'Failed';
  const isRefunded = order.status === 'Refunded';
  const isReview = order.status === 'ManualReview';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 text-right">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/orders"
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowRight className="w-3.5 h-3.5" /> العودة إلى سجل الطلبات
        </Link>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-colors"
        >
          <Printer className="w-3.5 h-3.5" /> طباعة إيصال الشحنة
        </button>
      </div>

      {/* Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">رقم الشحنة:</span>
              <span className="font-mono text-sm font-black text-indigo-400 tracking-wider">
                {order.orderNumber}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              تاريخ الطلب: {new Date(order.createdAt).toLocaleString('ar-EG', { dateStyle: 'full', timeStyle: 'short' })}
            </p>
          </div>

          <div>
            {isCompleted && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-4 h-4" /> مكتمل ومسلم بنجاح
              </span>
            )}
            {isReview && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Clock className="w-4 h-4" /> قيد المراجعة اليدوية للمشغل
              </span>
            )}
            {isFailed && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <AlertCircle className="w-4 h-4" /> فشل التسليم (تم فك حجز الرصيد)
              </span>
            )}
            {isRefunded && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <RotateCcw className="w-4 h-4" /> مسترد إلى المحفظة
              </span>
            )}
            {!isCompleted && !isReview && !isFailed && !isRefunded && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Clock className="w-4 h-4 animate-spin" /> جاري التنفيذ والتسليم
              </span>
            )}
          </div>
        </div>

        {/* Live Stepper */}
        <div className="py-4">
          <div className="relative flex items-center justify-between">
            {/* Step 1 */}
            <div className="flex flex-col items-center z-10">
              <div className="w-8 h-8 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-bold text-xs">
                ✓
              </div>
              <span className="text-[11px] font-bold text-white mt-1.5">حجز الرصيد</span>
              <span className="text-[9px] text-slate-400">محفظة العميل</span>
            </div>

            <div className="flex-1 h-0.5 bg-emerald-500 mx-2" />

            {/* Step 2 */}
            <div className="flex flex-col items-center z-10">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                  isCompleted || isReview
                    ? 'bg-emerald-500 text-slate-950'
                    : isFailed
                    ? 'bg-rose-500 text-white'
                    : 'bg-indigo-600 text-white animate-pulse'
                }`}
              >
                {isCompleted || isReview ? '✓' : isFailed ? '✕' : '2'}
              </div>
              <span className="text-[11px] font-bold text-white mt-1.5">محرك التنفيذ</span>
              <span className="text-[9px] text-slate-400">
                {isReview ? 'طابور المراجعة' : 'المزود المعتمد'}
              </span>
            </div>

            <div
              className={`flex-1 h-0.5 mx-2 ${
                isCompleted ? 'bg-emerald-500' : 'bg-slate-800'
              }`}
            />

            {/* Step 3 */}
            <div className="flex flex-col items-center z-10">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                  isCompleted
                    ? 'bg-emerald-500 text-slate-950'
                    : isRefunded
                    ? 'bg-purple-500 text-white'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {isCompleted ? '✓' : isRefunded ? '↺' : '3'}
              </div>
              <span className="text-[11px] font-bold text-white mt-1.5">تسليم الشحنة</span>
              <span className="text-[9px] text-slate-400">
                {isCompleted ? 'تم الاستلام' : isRefunded ? 'مسترد' : 'بانتظار الإنجاز'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Voucher Code Card (if available) */}
      {order.voucherCode && (
        <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-indigo-950/40 border border-emerald-500/30 rounded-2xl p-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" /> كود القسيمة الرقمية (Voucher PIN Code)
            </span>
            <button
              onClick={() => setShowVoucher(!showVoucher)}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
            >
              {showVoucher ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showVoucher ? 'إخفاء' : 'إظهار'}
            </button>
          </div>

          <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <code className="text-xl font-mono font-black text-white tracking-widest text-center sm:text-right select-all">
              {showVoucher ? order.voucherCode : '••••••••••••••••••••'}
            </code>

            <button
              onClick={copyVoucher}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-600/20"
            >
              {copiedVoucher ? (
                <>
                  <Check className="w-4 h-4" /> تم النسخ بنجاح!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" /> نسخ كود القسيمة
                </>
              )}
            </button>
          </div>
          <p className="text-[11px] text-slate-400">
            يمكنك استخدام هذا الكود فوراً داخل اللعبة أو التطبيق لاسترداد الشحنة.
          </p>
        </div>
      )}

      {/* Beneficiary and Service Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Service Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <h3 className="text-xs font-bold text-slate-400 border-b border-slate-800 pb-2">
            تفاصيل الباقة والخدمة
          </h3>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center shrink-0">
              <Gamepad2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-bold text-white">
                {order.snapshotServiceNameAr || order.snapshotServiceName}
              </h4>
              <p className="text-xs text-indigo-400 font-bold">
                {order.snapshotProductNameAr || order.snapshotProductName}
              </p>
            </div>
          </div>
          <div className="pt-2 text-xs flex justify-between border-t border-slate-800/60">
            <span className="text-slate-400">القيمة الإجمالية:</span>
            <span className="font-mono font-bold text-emerald-400">
              {Number(order.snapshotRetailPrice).toLocaleString()} {order.snapshotCurrency}
            </span>
          </div>
        </div>

        {/* Beneficiary Account Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <h3 className="text-xs font-bold text-slate-400 border-b border-slate-800 pb-2">
            بيانات حساب المستفيد
          </h3>
          <div className="space-y-2">
            {Object.entries(beneficiary).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-mono">{key}:</span>
                <span className="text-white font-mono font-bold bg-slate-950 px-2.5 py-1 rounded border border-slate-800">
                  {String(val)}
                </span>
              </div>
            ))}
          </div>
          <div className="pt-2 text-xs flex justify-between border-t border-slate-800/60">
            <span className="text-slate-400">طريقة الدفع:</span>
            <span className="text-slate-300 font-bold">محفظة العميل المعتمدة</span>
          </div>
        </div>
      </div>

      {/* State Machine Transition Timeline */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h3 className="text-xs font-bold text-slate-400 border-b border-slate-800 pb-2">
          سجل وتاريخ حالات الطلب (Audit History)
        </h3>
        <div className="space-y-3">
          {(order.statusHistory || []).map((step: any, index: number) => (
            <div key={index} className="flex items-start gap-3 text-xs">
              <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">
                    الحالة: <span className="text-indigo-400">{step.newStatus}</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {new Date(step.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
                {step.reason && (
                  <p className="text-slate-400 text-[11px] mt-0.5">{step.reason}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
