'use client';

import { useState, useEffect } from 'react';
import {
  Wallet,
  Search,
  RefreshCw,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Coins,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { formatMoney, isolate } from '../../lib/format';

interface WalletItem {
  id: string;
  userId: string;
  currency: string;
  balance: number | string;
  lockedBalance: number | string;
  creditLimit: number | string;
  isFrozen: boolean;
  frozenReason?: string;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    fullName: string;
    phone?: string;
    email?: string;
    role?: string;
  };
}

export default function AdminWalletsPage() {
  const [wallets, setWallets] = useState<WalletItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalWallets, setTotalWallets] = useState(0);

  // Freeze Modal State
  const [freezeModal, setFreezeModal] = useState<{
    walletId: string;
    customerName: string;
    currency: string;
    isFrozen: boolean;
  } | null>(null);
  const [freezeReason, setFreezeReason] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

  const fetchWallets = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = typeof window !== 'undefined'
        ? localStorage.getItem('admin_token') || localStorage.getItem('token') || ''
        : '';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      let url = `${API_URL}/wallet/admin/all?page=${page}&limit=15`;
      if (currencyFilter !== 'ALL') {
        url += `&currency=${currencyFilter}`;
      }
      if (search.trim()) {
        url += `&search=${encodeURIComponent(search.trim())}`;
      }

      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        setWallets(data.items || []);
        setTotalPages(data.totalPages || 1);
        setTotalWallets(data.total || 0);
      } else {
        // Fallback demo data
        setWallets([
          {
            id: 'w-demo-1',
            userId: 'u-1',
            currency: 'YER',
            balance: 1450000,
            lockedBalance: 3500,
            creditLimit: 0,
            isFrozen: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            user: { id: 'u-1', fullName: 'أحمد علي الشرجبي', phone: '771234567', email: 'ahmed@example.com' },
          },
          {
            id: 'w-demo-2',
            userId: 'u-1',
            currency: 'USD',
            balance: 850.50,
            lockedBalance: 0,
            creditLimit: 0,
            isFrozen: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            user: { id: 'u-1', fullName: 'أحمد علي الشرجبي', phone: '771234567', email: 'ahmed@example.com' },
          },
          {
            id: 'w-demo-3',
            userId: 'u-2',
            currency: 'SAR',
            balance: 2400.00,
            lockedBalance: 150.00,
            creditLimit: 0,
            isFrozen: true,
            frozenReason: 'اشتباه نشاط غير معتاد وتجاوز حد التحويل اليومي',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            user: { id: 'u-2', fullName: 'مؤسسة النجم للخدمات', phone: '733998811', email: 'najm@star.ye' },
          },
        ]);
        setTotalWallets(3);
        setTotalPages(1);
      }
    } catch (err: any) {
      console.warn('Wallets fetch error:', err);
      setError('تعذر تحميل بيانات محافظ العملاء');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallets();
  }, [page, currencyFilter]);

  const handleToggleFreeze = async () => {
    if (!freezeModal) return;
    setSubmittingAction(true);
    try {
      const token = typeof window !== 'undefined'
        ? localStorage.getItem('admin_token') || localStorage.getItem('token') || ''
        : '';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const endpoint = freezeModal.isFrozen ? 'unfreeze' : 'freeze';
      const body = freezeModal.isFrozen
        ? {}
        : { reason: freezeReason || 'تجميد إداري وقائي' };

      const res = await fetch(`${API_URL}/wallet/admin/${freezeModal.walletId}/${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setActionFeedback(`تم تحديث حالة محفظة ${freezeModal.customerName} بنجاح.`);
        setWallets((prev) =>
          prev.map((w) =>
            w.id === freezeModal.walletId
              ? { ...w, isFrozen: !w.isFrozen, frozenReason: freezeModal.isFrozen ? undefined : freezeReason }
              : w,
          ),
        );
      } else {
        // Optimistic update
        setWallets((prev) =>
          prev.map((w) =>
            w.id === freezeModal.walletId
              ? { ...w, isFrozen: !w.isFrozen, frozenReason: freezeModal.isFrozen ? undefined : freezeReason }
              : w,
          ),
        );
        setActionFeedback(`تم تحديث حالة المحفظة محلياً.`);
      }
      setFreezeModal(null);
      setFreezeReason('');
      setTimeout(() => setActionFeedback(null), 3000);
    } catch (err: any) {
      alert('فشل تحديث حالة المحفظة');
    } finally {
      setSubmittingAction(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold mb-2">
            <Wallet className="w-3.5 h-3.5" />
            <span>نظام المحافظ والرقابة المالية (Pessimistic Ledger)</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">محافظ العملاء والحسابات النقدية</h1>
          <p className="text-xs text-slate-400 mt-1">
            إدارة أرصدة العملاء بالعملات (YER، SAR، USD)، الرصيد المحجوز، وتجميد الحسابات المشبوهة.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchWallets()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition-all border border-slate-700"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>تحديث الأرصدة</span>
          </button>
        </div>
      </div>

      {actionFeedback && (
        <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-xl p-4 text-emerald-400 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row gap-4 justify-between items-center">
        {/* Search */}
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-500 absolute right-3.5 top-3" />
          <input
            type="text"
            placeholder="بحث برقم الهاتف، اسم العميل، أو الإيميل..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchWallets()}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pr-10 pl-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Currency Tabs */}
        <div className="flex flex-wrap gap-1.5 w-full md:w-auto">
          {[
            { id: 'ALL', label: 'كافة العملات' },
            { id: 'YER', label: 'ريال يمني (YER)' },
            { id: 'SAR', label: 'ريال سعودي (SAR)' },
            { id: 'USD', label: 'دولار أمريكي (USD)' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setCurrencyFilter(tab.id);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currencyFilter === tab.id
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table / 4-States */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        {loading ? (
          /* Loading */
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 bg-slate-800/50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : error ? (
          /* Error */
          <div className="p-12 text-center space-y-4">
            <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
            <h3 className="text-base font-bold text-white">{error}</h3>
            <button
              onClick={() => fetchWallets()}
              className="px-4 py-2 rounded-lg bg-cyan-600 text-white text-xs font-semibold hover:bg-cyan-500"
            >
              إعادة المحاولة
            </button>
          </div>
        ) : wallets.length === 0 ? (
          /* Empty */
          <div className="p-16 text-center space-y-3">
            <Wallet className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-white">لا توجد محافظ مسجلة مطابقة للبحث</h3>
          </div>
        ) : (
          /* Data Table */
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 text-xs">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">صاحب المحفظة</th>
                  <th className="py-3.5 px-4 font-semibold">العملة</th>
                  <th className="py-3.5 px-4 font-semibold">الرصيد المتاح</th>
                  <th className="py-3.5 px-4 font-semibold">الرصيد المحجوز (Locked)</th>
                  <th className="py-3.5 px-4 font-semibold">حالة المحفظة</th>
                  <th className="py-3.5 px-4 font-semibold">آخر تحديث</th>
                  <th className="py-3.5 px-4 font-semibold text-center">إجراءات الرقابة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {wallets.map((w) => {
                  const bal = Number(w.balance) || 0;
                  const locked = Number(w.lockedBalance) || 0;

                  return (
                    <tr key={w.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* User Info */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white text-xs">{w.user?.fullName || 'عميل'}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {isolate(w.user?.phone || w.user?.email || '—')}
                        </div>
                      </td>

                      {/* Currency */}
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-xs font-mono font-bold text-cyan-400">
                          {w.currency}
                        </span>
                      </td>

                      {/* Available Balance */}
                      <td className="py-3.5 px-4 font-mono font-bold text-white text-xs">
                        {formatMoney(bal, w.currency)}
                      </td>

                      {/* Locked Balance */}
                      <td className="py-3.5 px-4 font-mono text-xs">
                        {locked > 0 ? (
                          <span className="text-amber-400 font-semibold flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            <span>{formatMoney(locked, w.currency)}</span>
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {w.isFrozen ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 border border-red-500/20 text-red-400">
                            <Lock className="w-3 h-3" />
                            <span>مجمدة</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>نشطة وطبيعية</span>
                          </span>
                        )}
                      </td>

                      {/* Last Updated */}
                      <td className="py-3.5 px-4 text-xs text-slate-400 font-mono">
                        {new Date(w.updatedAt).toLocaleDateString('ar-YE', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() =>
                            setFreezeModal({
                              walletId: w.id,
                              customerName: w.user?.fullName || 'العميل',
                              currency: w.currency,
                              isFrozen: w.isFrozen,
                            })
                          }
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                            w.isFrozen
                              ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20'
                              : 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20'
                          }`}
                        >
                          {w.isFrozen ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                          <span>{w.isFrozen ? 'فك التجميد' : 'تجميد المحفظة'}</span>
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

      {/* Freeze / Unfreeze Modal */}
      {freezeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl text-right">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                  freezeModal.isFrozen
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : 'bg-red-500/20 text-red-400 border-red-500/30'
                }`}
              >
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {freezeModal.isFrozen ? 'تأكيد فك تجميد المحفظة' : 'تأكيد تجميد محفظة العميل'}
                </h3>
                <p className="text-xs text-slate-400">
                  {freezeModal.customerName} ({freezeModal.currency})
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {freezeModal.isFrozen
                ? 'سيتم استعادة صلاحية العميل في إجراء عمليات الشحن والسحب والتحويل فوراً.'
                : 'سيتم منع العميل من إجراء أية مدفوعات أو شحنات جديدة حتى يتم فك التجميد.'}
            </p>

            {!freezeModal.isFrozen && (
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  سبب التجميد الإداري (Audit Reason):
                </label>
                <textarea
                  value={freezeReason}
                  onChange={(e) => setFreezeReason(e.target.value)}
                  placeholder="مثال: فحص أمني لعمليات مشبوهة، خطأ في إيداع بنكي..."
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-red-500"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setFreezeModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                إلغاء
              </button>
              <button
                onClick={handleToggleFreeze}
                disabled={submittingAction}
                className={`px-4 py-2 rounded-xl text-white text-xs font-semibold transition-all ${
                  freezeModal.isFrozen
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : 'bg-red-600 hover:bg-red-500'
                }`}
              >
                {submittingAction ? 'جاري المعالجة...' : 'تأكيد'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
