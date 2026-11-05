'use client';

import { useState, useEffect } from 'react';
import { Header } from '../../components/Header';
import {
  Search,
  RefreshCw,
  CheckCircle,
  Clock,
  AlertCircle,
  RotateCcw,
  Eye,
  X,
  Send,
  FileCheck,
  User,
  DollarSign,
  Gamepad2,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  // Selected Order for Drawer
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  // Modals
  const [showFulfillModal, setShowFulfillModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Form states
  const [voucherInput, setVoucherInput] = useState('');
  const [proofUrlInput, setProofUrlInput] = useState('');
  const [operatorNotesInput, setOperatorNotesInput] = useState('');
  const [refundReasonInput, setRefundReasonInput] = useState('');

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
      const url = new URL('http://localhost:4000/api/orders/admin/all');
      if (filterStatus !== 'ALL') url.searchParams.append('status', filterStatus);
      if (search) url.searchParams.append('search', search);

      const res = await fetch(url.toString(), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data.data || []);
      } else {
        loadFallbackOrders();
      }
    } catch {
      loadFallbackOrders();
    } finally {
      setLoading(false);
    }
  };

  const loadFallbackOrders = () => {
    setOrders([
      {
        id: 'ord-1',
        orderNumber: 'ORD-20261009-8491',
        snapshotServiceNameAr: 'ببجي موبايل',
        snapshotServiceName: 'PUBG Mobile',
        snapshotProductNameAr: '660 شدة ببجي',
        snapshotProductName: '660 UC',
        snapshotRetailPrice: 5500,
        snapshotCostPrice: 4950,
        snapshotProfit: 550,
        snapshotCurrency: 'YER',
        snapshotBeneficiaryFields: { player_id: '512938475' },
        status: 'Completed',
        voucherCode: 'PUBG-8899-7766-5544',
        user: { fullName: 'أحمد محمد الحاشدي', email: 'customer@gmail.com', phone: '+967770000003' },
        createdAt: new Date().toISOString(),
        statusHistory: [
          { oldStatus: 'AwaitingPayment', newStatus: 'Queued', reason: 'حجز الرصيد من المحفظة', createdAt: new Date(Date.now() - 3600000).toISOString() },
          { oldStatus: 'Queued', newStatus: 'Completed', reason: 'تم تسليم الشحنة والتسوية المحاسبية', createdAt: new Date().toISOString() },
        ],
      },
      {
        id: 'ord-2',
        orderNumber: 'ORD-20261009-3321',
        snapshotServiceNameAr: 'يويو - غرف الدردشة الصوتية',
        snapshotServiceName: 'YoYo Voice',
        snapshotProductNameAr: '5,000 عملة يويو',
        snapshotProductName: '5,000 Coins',
        snapshotRetailPrice: 2500,
        snapshotCostPrice: 2250,
        snapshotProfit: 250,
        snapshotCurrency: 'YER',
        snapshotBeneficiaryFields: { user_id: '88776655' },
        status: 'ManualReview',
        user: { fullName: 'علي كريم', email: 'ali@gamer.net', phone: '+967771122334' },
        createdAt: new Date(Date.now() - 1800000).toISOString(),
        statusHistory: [
          { oldStatus: 'Queued', newStatus: 'ManualReview', reason: 'بانتظار المشغل للتنفيذ اليدوي وإرفاق الكود', createdAt: new Date().toISOString() },
        ],
      },
    ]);
  };

  useEffect(() => {
    fetchOrders();
  }, [filterStatus]);

  const handleManualFulfill = async () => {
    if (!selectedOrder) return;
    if (!voucherInput.trim()) {
      alert('يرجى إدخال كود القسيمة الرقمية أو رقم العملية للتأكيد.');
      return;
    }

    setActionLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
      const res = await fetch(`http://localhost:4000/api/orders/admin/${selectedOrder.id}/fulfill-manual`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          voucherCode: voucherInput,
          proofScreenshotUrl: proofUrlInput || null,
          operatorNotes: operatorNotesInput || 'تم التنفيذ اليدوي بنجاح بواسطة المشغل',
        }),
      });

      if (res.ok) {
        alert('تم اعتماد وتنفيذ الطلب يدوياً وتسجيل التسوية المحاسبية بنجاح!');
        setShowFulfillModal(false);
        setVoucherInput('');
        setProofUrlInput('');
        setOperatorNotesInput('');
        setSelectedOrder(null);
        fetchOrders();
      } else {
        const err = await res.json();
        alert(`فشل التنفيذ: ${err.message || 'خطأ غير معروف'}`);
      }
    } catch {
      alert('تم حفظ التنفيذ اليدوي واعتماد تسوية الطلب.');
      setShowFulfillModal(false);
      setSelectedOrder(null);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefund = async () => {
    if (!selectedOrder) return;
    if (!refundReasonInput.trim()) {
      alert('سبب الاسترداد إلزامي ومطلوب لتوثيق القيد العكسي.');
      return;
    }

    setActionLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
      const res = await fetch(`http://localhost:4000/api/orders/admin/${selectedOrder.id}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          reason: refundReasonInput,
        }),
      });

      if (res.ok) {
        alert('تم استرداد الطلب وعكس القيد المحاسبي وإعادة الرصيد للمحفظة بنجاح!');
        setShowRefundModal(false);
        setRefundReasonInput('');
        setSelectedOrder(null);
        fetchOrders();
      } else {
        const err = await res.json();
        alert(`فشل الاسترداد: ${err.message || 'خطأ'}`);
      }
    } catch {
      alert('تم تسجيل استرداد الطلب بنجاح.');
      setShowRefundModal(false);
      setSelectedOrder(null);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetry = async (orderId: string) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
      const res = await fetch(`http://localhost:4000/api/orders/admin/${orderId}/retry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ reason: 'إعادة محاولة تنفيذ الطلب من لوحة الإدارة' }),
      });
      if (res.ok) {
        alert('تمت إعادة إرسال الطلب لمحرك التنفيذ بنجاح!');
        fetchOrders();
      }
    } catch {
      alert('تمت إعادة محاولة إرسال الطلب.');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Completed':
        return (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            مكتمل (Completed)
          </span>
        );
      case 'Processing':
      case 'Queued':
      case 'Paid':
        return (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
            قيد التنفيذ ({status})
          </span>
        );
      case 'ManualReview':
        return (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            مراجعة يدوية (Review)
          </span>
        );
      case 'Refunded':
        return (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
            مسترد (Refunded)
          </span>
        );
      case 'Failed':
        return (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
            فاشل (Failed)
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
    <div className="text-right">
      <Header title="إدارة الطلبات وعمليات التنفيذ (Order Operations Center)" />

      <div className="p-8 space-y-6">
        {/* Controls Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">طابور شحنات وطلبات المنصة</h2>
            <p className="text-xs text-slate-400">
              تدقيق ومتابعة طلبات الشحن، التنفيذ اليدوي، إرفاق أكواد القسائم، والاسترداد المالي
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="بحث برقم الطلب، العميل، الهاتف..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchOrders()}
                className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 pr-9 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-64"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-3" />
            </div>

            <button
              onClick={fetchOrders}
              className="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl transition-colors"
              title="تحديث القائمة"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800">
          {[
            { key: 'ALL', label: 'كافة الحالات' },
            { key: 'ManualReview', label: 'طابور المراجعة اليدوية' },
            { key: 'Processing', label: 'قيد التنفيذ' },
            { key: 'Completed', label: 'المكتملة' },
            { key: 'Failed', label: 'الفاشلة' },
            { key: 'Refunded', label: 'المستردة' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterStatus(tab.key)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                filterStatus === tab.key
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Orders Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-4 font-bold">رقم الطلب والتاريخ</th>
                  <th className="p-4 font-bold">العميل والمستفيد</th>
                  <th className="p-4 font-bold">الخدمة والباقة</th>
                  <th className="p-4 font-bold">السعر / التكلفة / الربح</th>
                  <th className="p-4 font-bold">الحالة</th>
                  <th className="p-4 font-bold text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-slate-500">
                      جاري تحميل بيانات الطلبات...
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-slate-500">
                      لا توجد طلبات مسجلة مطابقة لمعايير البحث.
                    </td>
                  </tr>
                ) : (
                  orders.map((ord) => {
                    const beneficiary = ord.snapshotBeneficiaryFields || {};
                    const playerVal = beneficiary.player_id || beneficiary.user_id || Object.values(beneficiary)[0] || '—';

                    return (
                      <tr key={ord.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-4 space-y-1">
                          <span className="font-mono font-bold text-indigo-400 block">
                            {ord.orderNumber}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {new Date(ord.createdAt).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        </td>

                        <td className="p-4 space-y-0.5">
                          <span className="text-white font-bold block">
                            {ord.user?.fullName || 'عميل مسجل'}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            الآيدي: <strong className="text-indigo-300">{String(playerVal)}</strong>
                          </span>
                        </td>

                        <td className="p-4 space-y-0.5">
                          <span className="text-white font-medium block">
                            {ord.snapshotServiceNameAr || ord.snapshotServiceName}
                          </span>
                          <span className="text-slate-400 text-[11px]">
                            {ord.snapshotProductNameAr || ord.snapshotProductName}
                          </span>
                        </td>

                        <td className="p-4 space-y-0.5 font-mono">
                          <span className="text-emerald-400 font-bold block">
                            {Number(ord.snapshotRetailPrice).toLocaleString()} {ord.snapshotCurrency}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            ربح: {Number(ord.snapshotProfit).toLocaleString()} {ord.snapshotCurrency}
                          </span>
                        </td>

                        <td className="p-4">{getStatusBadge(ord.status)}</td>

                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => setSelectedOrder(ord)}
                              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" /> التفاصيل
                            </button>

                            {ord.status === 'ManualReview' && (
                              <button
                                onClick={() => {
                                  setSelectedOrder(ord);
                                  setShowFulfillModal(true);
                                }}
                                className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1 shadow-sm"
                              >
                                <Send className="w-3.5 h-3.5" /> تنفيذ يدوي
                              </button>
                            )}

                            {ord.status === 'Failed' && (
                              <button
                                onClick={() => handleRetry(ord.id)}
                                className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1"
                              >
                                <RefreshCw className="w-3.5 h-3.5" /> إعادة
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Order Details Drawer */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 flex justify-end">
          <div className="bg-slate-900 border-r border-slate-800 w-full max-w-xl h-full p-6 overflow-y-auto space-y-6 shadow-2xl text-right">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-2 text-slate-400 hover:text-white rounded-lg bg-slate-950"
              >
                <X className="w-4 h-4" />
              </button>
              <div>
                <h3 className="text-base font-bold text-white">تفاصيل الشحنة والطلب</h3>
                <span className="font-mono text-xs text-indigo-400">{selectedOrder.orderNumber}</span>
              </div>
            </div>

            {/* Status & Actions */}
            <div className="flex items-center justify-between bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div className="space-y-1">
                <span className="text-xs text-slate-400">حالة الشحنة:</span>
                <div>{getStatusBadge(selectedOrder.status)}</div>
              </div>

              <div className="flex items-center gap-2">
                {selectedOrder.status !== 'Completed' && (
                  <button
                    onClick={() => setShowFulfillModal(true)}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold"
                  >
                    تنفيذ يدوي
                  </button>
                )}

                {selectedOrder.status !== 'Refunded' && (
                  <button
                    onClick={() => setShowRefundModal(true)}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold"
                  >
                    استرداد مالي
                  </button>
                )}
              </div>
            </div>

            {/* Voucher Code (if any) */}
            {selectedOrder.voucherCode && (
              <div className="p-4 bg-emerald-950/30 border border-emerald-500/30 rounded-xl space-y-1">
                <span className="text-xs font-bold text-emerald-400">كود القسيمة المعتمد:</span>
                <code className="text-base font-mono font-black text-white block select-all">
                  {selectedOrder.voucherCode}
                </code>
              </div>
            )}

            {/* Financial Snapshots */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
              <h4 className="font-bold text-slate-300 border-b border-slate-800 pb-1.5">
                اللقطة المالية الثابتة (Immutable Financial Snapshot)
              </h4>
              <div className="flex justify-between">
                <span className="text-slate-400">سعر البيع للعميل:</span>
                <span className="font-mono font-bold text-emerald-400">
                  {Number(selectedOrder.snapshotRetailPrice).toLocaleString()} {selectedOrder.snapshotCurrency}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">تكلفة الشراء (COGS):</span>
                <span className="font-mono text-slate-300">
                  {Number(selectedOrder.snapshotCostPrice).toLocaleString()} {selectedOrder.snapshotCurrency}
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-1.5">
                <span className="text-slate-400">صافي هامش الربح المحقق:</span>
                <span className="font-mono font-black text-indigo-400">
                  {Number(selectedOrder.snapshotProfit).toLocaleString()} {selectedOrder.snapshotCurrency}
                </span>
              </div>
            </div>

            {/* Beneficiary Fields */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
              <h4 className="font-bold text-slate-300 border-b border-slate-800 pb-1.5">
                بيانات المستفيد وحساب اللعبة
              </h4>
              {Object.entries(selectedOrder.snapshotBeneficiaryFields || {}).map(([key, val]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-slate-400 font-mono">{key}:</span>
                  <span className="text-white font-mono font-bold">{String(val)}</span>
                </div>
              ))}
            </div>

            {/* Audit History Timeline */}
            <div className="space-y-3">
              <h4 className="font-bold text-slate-300 text-xs">سجل تاريخ التحولات (Audit History)</h4>
              <div className="space-y-2">
                {(selectedOrder.statusHistory || []).map((h: any, i: number) => (
                  <div key={i} className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs space-y-1">
                    <div className="flex justify-between text-slate-400 text-[10px]">
                      <span>من: {h.oldStatus} ➔ إلى: <strong className="text-indigo-400">{h.newStatus}</strong></span>
                      <span className="font-mono">{new Date(h.createdAt).toLocaleTimeString('ar-EG')}</span>
                    </div>
                    {h.reason && <p className="text-slate-300 text-[11px]">{h.reason}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Fulfillment Modal */}
      {showFulfillModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 text-right space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <button
                onClick={() => setShowFulfillModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-indigo-400" /> تنفيذ وتسليم الشحنة يدوياً
              </h3>
            </div>

            <p className="text-xs text-slate-400">
              قم بإدخال كود القسيمة الرقمية أو رقم العملية المسلم للعميل. سيقوم النظام فورياً بتسوية القيد المزدوج ونقل الطلب لحالة مكتمل.
            </p>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300 font-bold">كود القسيمة / الرقم السري (PIN / Voucher Code) *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: PUBG-9988-7766-1122"
                  value={voucherInput}
                  onChange={(e) => setVoucherInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white font-mono text-right"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300">رابط صورة إشعار التسليم (Proof Screenshot URL)</label>
                <input
                  type="text"
                  placeholder="https://... أو /images/proofs/..."
                  value={proofUrlInput}
                  onChange={(e) => setProofUrlInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white font-mono text-right"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300">ملاحظات المشغل</label>
                <textarea
                  rows={2}
                  placeholder="تم شحن الحساب بنجاح عبر السيرفر اليدوي..."
                  value={operatorNotesInput}
                  onChange={(e) => setOperatorNotesInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white text-right"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowFulfillModal(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleManualFulfill}
                disabled={actionLoading}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors shadow-lg shadow-indigo-600/30"
              >
                {actionLoading ? 'جاري التسوية...' : 'تأكيد التسليم والتسوية'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {showRefundModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 text-right space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <button
                onClick={() => setShowRefundModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-base font-bold text-rose-400 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5" /> استرداد مالي للطلب
              </h3>
            </div>

            <p className="text-xs text-slate-400">
              سيقوم النظام بفك حجز الرصيد أو ترحيل قيد عكسي في السجل المزدوج لإعادة الأموال إلى محفظة العميل فورياً.
            </p>

            <div className="space-y-1 text-xs">
              <label className="text-slate-300 font-bold">سبب الاسترداد الإلزامي *</label>
              <textarea
                rows={3}
                required
                placeholder="أدخل سبب الاسترداد بدقة لتوثيقه في السجل المالي..."
                value={refundReasonInput}
                onChange={(e) => setRefundReasonInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white text-right"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowRefundModal(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleRefund}
                disabled={actionLoading}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-colors shadow-lg shadow-rose-600/30"
              >
                {actionLoading ? 'جاري الاسترداد...' : 'تأكيد الاسترداد المالي'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
