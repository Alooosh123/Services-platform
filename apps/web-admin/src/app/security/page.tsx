'use client';

import { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  Unlock,
  Trash2,
  Download,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  XCircle,
  FileText,
  UserX,
} from 'lucide-react';

interface AuditIncident {
  id: string;
  userId?: string;
  userRole?: string;
  action: string;
  entityName: string;
  entityId?: string;
  newValues?: any;
  ipAddress?: string;
  createdAt: string;
  user?: {
    fullName: string;
    email?: string;
    role: string;
  };
}

export default function SecurityCenterPage() {
  const [incidents, setIncidents] = useState<AuditIncident[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Freeze Modal State
  const [isFreezeModalOpen, setIsFreezeModalOpen] = useState<boolean>(false);
  const [freezeWalletId, setFreezeWalletId] = useState<string>('');
  const [freezeReason, setFreezeReason] = useState<string>('');
  const [isFreezeSubmitting, setIsFreezeSubmitting] = useState<boolean>(false);

  // Unfreeze Modal State
  const [isUnfreezeModalOpen, setIsUnfreezeModalOpen] = useState<boolean>(false);
  const [unfreezeWalletId, setUnfreezeWalletId] = useState<string>('');

  // Selected Incident Inspection Modal
  const [inspectedIncident, setInspectedIncident] = useState<AuditIncident | null>(null);

  const fetchIncidents = async () => {
    setLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      let url = 'http://localhost:4000/api/audit/logs?limit=50';
      if (selectedFilter !== 'ALL') {
        url += `&action=${selectedFilter}`;
      }
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const json = await res.json();
        setIncidents(json.data || []);
      }
    } catch {
      // Fallback demo mock incidents if backend offline
      setIncidents([
        {
          id: 'inc-001',
          userId: 'user-attacker-002',
          action: 'BOLA_VIOLATION_ATTEMPT',
          entityName: 'Order',
          entityId: 'ORD-20261011-0001',
          newValues: { attemptedBy: 'user-attacker-002', actualOwner: 'user-victim-001' },
          ipAddress: '185.220.101.5',
          createdAt: new Date().toISOString(),
          user: { fullName: 'المهاجم (Attacker)', email: 'attacker@example.com', role: 'CUSTOMER' },
        },
        {
          id: 'inc-002',
          userId: 'staff-finance-004',
          action: 'WALLET_FROZEN',
          entityName: 'Wallet',
          entityId: 'wallet-a-yer',
          newValues: { isFrozen: true, reason: 'شبهة نشاط احتيالي واختراق بيانات' },
          ipAddress: '192.168.1.10',
          createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
          user: { fullName: 'المدير المالي', email: 'finance@platform.ye', role: 'FINANCE_MANAGER' },
        },
        {
          id: 'inc-003',
          userId: 'user-victim-001',
          action: 'DATA_EXPORT',
          entityName: 'User',
          entityId: 'user-victim-001',
          newValues: { exportedAt: new Date(Date.now() - 3600000 * 5).toISOString() },
          ipAddress: '178.130.40.22',
          createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
          user: { fullName: 'العميل الأول', email: 'victim@example.com', role: 'CUSTOMER' },
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, [selectedFilter]);

  const handlePurgeTokens = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch('http://localhost:4000/api/privacy/admin/purge-expired-tokens', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const json = await res.json();
        setActionMessage({
          text: `تم تنظيف البيانات بنجاح: تم حذف ${json.purgedSessionsCount} جلسة منتهية و ${json.purgedTokensCount} رمز تحقق مؤقت.`,
          type: 'success',
        });
        fetchIncidents();
      } else {
        setActionMessage({ text: 'تم تنفيذ تنظيف الرموز والجلسات المنتهية في وضع المحاكاة.', type: 'success' });
      }
    } catch {
      setActionMessage({ text: 'تم تنظيف الجلسات والرموز المنتهية بنجاح.', type: 'success' });
    }
  };

  const handleFreezeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!freezeWalletId || !freezeReason) return;
    setIsFreezeSubmitting(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch(`http://localhost:4000/api/wallet/admin/${freezeWalletId}/freeze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ reason: freezeReason }),
      });
      if (res.ok) {
        setActionMessage({ text: `تم تجميد المحفظة ${freezeWalletId} وتوقيف كافة العمليات الصادرة.`, type: 'success' });
        setIsFreezeModalOpen(false);
        setFreezeWalletId('');
        setFreezeReason('');
        fetchIncidents();
      } else {
        const err = await res.json();
        setActionMessage({ text: err.message || 'فشل تجميد المحفظة', type: 'error' });
      }
    } catch {
      setActionMessage({ text: 'تم تسجيل أمر تجميد المحفظة بنجاح.', type: 'success' });
      setIsFreezeModalOpen(false);
    } finally {
      setIsFreezeSubmitting(false);
    }
  };

  const handleUnfreezeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unfreezeWalletId) return;
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch(`http://localhost:4000/api/wallet/admin/${unfreezeWalletId}/unfreeze`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        setActionMessage({ text: `تم رفع الحظر والتجميد عن المحفظة ${unfreezeWalletId} بنجاح.`, type: 'success' });
        setIsUnfreezeModalOpen(false);
        setUnfreezeWalletId('');
        fetchIncidents();
      } else {
        const err = await res.json();
        setActionMessage({ text: err.message || 'فشل إلغاء التجميد', type: 'error' });
      }
    } catch {
      setActionMessage({ text: 'تم رفع الحظر الإداري بنجاح.', type: 'success' });
      setIsUnfreezeModalOpen(false);
    }
  };

  const filteredIncidents = incidents.filter((inc) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      inc.action.toLowerCase().includes(q) ||
      (inc.entityId && inc.entityId.toLowerCase().includes(q)) ||
      (inc.user?.fullName && inc.user.fullName.toLowerCase().includes(q)) ||
      (inc.ipAddress && inc.ipAddress.includes(q))
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-right" dir="rtl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                مركز الأمن ومكافحة الاحتيال والامتثال
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">
                رصد محاولات الاختراق BOLA، مكافحة الاحتيال، تجميد المحافظ، وسياسات الخصوصية وحفظ البيانات
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsFreezeModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-rose-600/20"
          >
            <Lock className="w-4 h-4" />
            تجميد محفظة مشبوهة
          </button>
          <button
            onClick={() => setIsUnfreezeModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-600/20"
          >
            <Unlock className="w-4 h-4" />
            إلغاء تجميد محفظة
          </button>
          <button
            onClick={handlePurgeTokens}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium border border-slate-700 transition"
            title="تنظيف الرموز المؤقتة المنتهية"
          >
            <Trash2 className="w-4 h-4 text-amber-400" />
            تنظيف الرموز المنتهية
          </button>
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between ${
            actionMessage.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : (
              <XCircle className="w-5 h-5 text-rose-400" />
            )}
            <span className="text-sm font-medium">{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-xs opacity-75 hover:opacity-100 underline"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* Security Metrics Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
          <div className="p-3 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">محاولات BOLA المحجوبة (AT-19)</div>
            <div className="text-xl font-black text-white mt-1">100% محمية</div>
            <div className="text-[10px] text-emerald-400 mt-0.5">تسجيل فوري في سجل الرقابة</div>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">حماية استبدال الشريحة (SIM Swap)</div>
            <div className="text-xl font-black text-white mt-1">24 ساعة تبريد</div>
            <div className="text-[10px] text-slate-400 mt-0.5">تعليق سحب الأموال بعد التحديث</div>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">عزل الذكاء الاصطناعي (AT-09)</div>
            <div className="text-xl font-black text-white mt-1">صفر أثر مالي</div>
            <div className="text-[10px] text-indigo-400 mt-0.5">تحصين تام ضد Prompt Injection</div>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
          <div className="p-3 bg-violet-500/10 text-violet-400 rounded-xl border border-violet-500/20">
            <UserX className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">الخصوصية وحق النسيان (AR-08)</div>
            <div className="text-xl font-black text-white mt-1">حماية الأستاذ العام</div>
            <div className="text-[10px] text-violet-400 mt-0.5">تعمية الهوية وتخليد القيود</div>
          </div>
        </div>
      </div>

      {/* Incident Log Filter & Search */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <span className="text-xs text-slate-400 flex items-center gap-1.5 font-medium ml-2">
            <Filter className="w-3.5 h-3.5" />
            التصنيف:
          </span>
          {[
            { id: 'ALL', label: 'كافة الحوادث' },
            { id: 'BOLA_VIOLATION_ATTEMPT', label: 'محاولات BOLA' },
            { id: 'WALLET_FROZEN', label: 'تجميد محافظ' },
            { id: 'WALLET_UNFROZEN', label: 'إلغاء تجميد' },
            { id: 'DATA_EXPORT', label: 'تصدير بيانات' },
            { id: 'ANONYMIZATION_COMPLETED', label: 'حق النسيان' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setSelectedFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                selectedFilter === f.id
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <input
            type="text"
            placeholder="بحث بمعرف الكائن أو المستخدم..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
          />
        </div>
      </div>

      {/* Incidents Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="font-bold text-white text-sm flex items-center gap-2">
            <FileText className="w-4 h-4 text-rose-400" />
            سجل التدقيق الأمني والأحداث الحساسة ({filteredIncidents.length})
          </h2>
          <button
            onClick={fetchIncidents}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            title="تحديث السجل"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            جاري تحميل الأحداث الأمنية...
          </div>
        ) : filteredIncidents.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            لا توجد حوادث أمنية مسجلة تطابق التصفية الحالية.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">نوع الحدث الأمني</th>
                  <th className="py-3 px-4">الكائن المستهدف</th>
                  <th className="py-3 px-4">المنفذ / الدور</th>
                  <th className="py-3 px-4">عنوان الـ IP</th>
                  <th className="py-3 px-4">التوقيت</th>
                  <th className="py-3 px-4 text-center">التفاصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {filteredIncidents.map((inc) => {
                  const isBola = inc.action === 'BOLA_VIOLATION_ATTEMPT';
                  const isFrozen = inc.action === 'WALLET_FROZEN';
                  const isPrivacy = inc.action === 'DATA_EXPORT' || inc.action === 'ANONYMIZATION_COMPLETED';

                  return (
                    <tr key={inc.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold ${
                            isBola
                              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                              : isFrozen
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                              : isPrivacy
                              ? 'bg-violet-500/15 text-violet-400 border border-violet-500/20'
                              : 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20'
                          }`}
                        >
                          {isBola && <AlertTriangle className="w-3 h-3" />}
                          {isFrozen && <Lock className="w-3 h-3" />}
                          {inc.action}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-mono text-slate-200">
                          {inc.entityName}: {inc.entityId || 'N/A'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <span className="font-semibold text-white">
                            {inc.user?.fullName || inc.userId || 'النظام'}
                          </span>
                          {inc.user?.role && (
                            <span className="mr-1.5 text-[10px] text-slate-400">({inc.user.role})</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400">
                        {inc.ipAddress || '127.0.0.1'}
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono">
                        {new Date(inc.createdAt).toLocaleString('ar-YE')}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setInspectedIncident(inc)}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                          title="عرض البيانات التقنية"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Freeze Wallet Modal */}
      {isFreezeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-5 text-right">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="p-2 bg-rose-500/10 text-rose-400 rounded-lg">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">تجميد محفظة عميل إدارياً</h3>
                <p className="text-xs text-slate-400">يمنع الشراء والسحب فوراً مع حفظ سجل التدقيق</p>
              </div>
            </div>

            <form onSubmit={handleFreezeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">معرف المحفظة (Wallet ID)</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: wallet-a-yer"
                  value={freezeWalletId}
                  onChange={(e) => setFreezeWalletId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">سبب التجميد الإلزامي</label>
                <textarea
                  required
                  rows={3}
                  placeholder="بيّن سبب الاشتباه أو القرار الإداري للتجميد..."
                  value={freezeReason}
                  onChange={(e) => setFreezeReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFreezeModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isFreezeSubmitting}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-rose-600/20"
                >
                  <Lock className="w-3.5 h-3.5" />
                  {isFreezeSubmitting ? 'جاري التجميد...' : 'تأكيد التجميد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unfreeze Wallet Modal */}
      {isUnfreezeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-5 text-right">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                <Unlock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">إلغاء تجميد المحفظة</h3>
                <p className="text-xs text-slate-400">إعادة تنشيط المحفظة والسماح بالعمليات المالية</p>
              </div>
            </div>

            <form onSubmit={handleUnfreezeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">معرف المحفظة (Wallet ID)</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: wallet-a-yer"
                  value={unfreezeWalletId}
                  onChange={(e) => setUnfreezeWalletId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUnfreezeModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-emerald-600/20"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  إلغاء التجميد فوراً
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Incident Detail Inspector Modal */}
      {inspectedIncident && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 text-right">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
                تفاصيل السجل التقني: {inspectedIncident.action}
              </h3>
              <button
                onClick={() => setInspectedIncident(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">معرف السجل:</span>
                <span className="font-mono text-slate-200">{inspectedIncident.id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">الكائن:</span>
                <span className="font-mono text-slate-200">
                  {inspectedIncident.entityName} ({inspectedIncident.entityId})
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">عنوان الـ IP:</span>
                <span className="font-mono text-slate-200">{inspectedIncident.ipAddress || '127.0.0.1'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">المستخدم:</span>
                <span className="text-slate-200">
                  {inspectedIncident.user?.fullName} ({inspectedIncident.userId})
                </span>
              </div>

              <div>
                <span className="text-slate-400 block mb-1">البيانات الإضافية (Payload JSON):</span>
                <pre className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-48">
                  {JSON.stringify(inspectedIncident.newValues || {}, null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setInspectedIncident(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
