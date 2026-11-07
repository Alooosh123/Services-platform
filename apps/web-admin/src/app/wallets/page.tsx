'use client';

import { useState } from 'react';

import {
  Wallet,
  ShieldCheck,
  Lock,
  Unlock,
  AlertTriangle,
  Search,
  User,
  RefreshCw,
  Building2,
  CheckCircle,
} from 'lucide-react';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/+$/, '');

interface CustomerWalletItem {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  userEmail?: string;
  currency: 'YER' | 'USD' | 'SAR';
  balance: number;
  lockedBalance: number;
  availableBalance: number;
  isFrozen: boolean;
  frozenReason?: string | null;
  frozenAt?: string | null;
}

export default function AdminWalletsPage() {
  const [wallets, setWallets] = useState<CustomerWalletItem[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedWalletForFreeze, setSelectedWalletForFreeze] = useState<CustomerWalletItem | null>(null);
  const [freezeReason, setFreezeReason] = useState('');
  const [loadingAction, setLoadingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchCustomerWallets = async () => {
    const id = customerId.trim();
    if (!id) {
      setListError('أدخل معرف العميل أولاً لتحميل محافظه من الخادم.');
      return;
    }
    setListLoading(true);
    setListError(null);
    try {
      const token = typeof window !== 'undefined'
        ? localStorage.getItem('admin_token') || localStorage.getItem('token')
        : null;
      if (!token) throw new Error('جلسة الإدارة غير متوفرة. سجّل الدخول مجدداً.');
      const res = await fetch(`${API_BASE_URL}/wallet/admin/customer/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.message || 'تعذر تحميل محافظ العميل.');
      const rows = Array.isArray(payload) ? payload : payload.data;
      if (!Array.isArray(rows)) throw new Error('استجابة الخادم لمحافظ العميل غير صحيحة.');
      setWallets(rows.map((wallet: any) => ({
        ...wallet,
        userId: wallet.userId || id,
        userName: wallet.user?.fullName || wallet.userName || id,
        userPhone: wallet.user?.phone || wallet.userPhone || '',
        userEmail: wallet.user?.email || wallet.userEmail || '',
      })));
    } catch (err) {
      setWallets([]);
      setListError(err instanceof Error ? err.message : 'تعذر تحميل محافظ العميل.');
    } finally {
      setListLoading(false);
    }
  };

  const handleFreeze = async (walletId: string) => {
    if (!freezeReason.trim()) {
      setActionError('سبب تجميد المحفظة إجباري');
      return;
    }

    setLoadingAction(true);
    setActionError(null);
    try {
      const token = typeof window !== 'undefined'
        ? localStorage.getItem('admin_token') || localStorage.getItem('token')
        : null;
      if (!token) throw new Error('جلسة الإدارة غير متوفرة. سجّل الدخول مجدداً.');
      const res = await fetch(`${API_BASE_URL}/wallet/admin/${encodeURIComponent(walletId)}/freeze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: freezeReason }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.message || 'فشل تجميد المحفظة.');
      const updated = payload.wallet;
      setWallets((prev) => prev.map((wallet) =>
        wallet.id === walletId
          ? { ...wallet, ...(updated || {}), isFrozen: true, frozenReason: updated?.frozenReason ?? freezeReason }
          : wallet,
      ));
      setSelectedWalletForFreeze(null);
      setFreezeReason('');
      setActionSuccess('تم تجميد المحفظة واعتماد سجل التدقيق من الخادم.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'تعذر تأكيد تجميد المحفظة.');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleUnfreeze = async (walletId: string) => {
    setLoadingAction(true);
    setActionError(null);
    try {
      const token = typeof window !== 'undefined'
        ? localStorage.getItem('admin_token') || localStorage.getItem('token')
        : null;
      if (!token) throw new Error('جلسة الإدارة غير متوفرة. سجّل الدخول مجدداً.');
      const res = await fetch(`${API_BASE_URL}/wallet/admin/${encodeURIComponent(walletId)}/unfreeze`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.message || 'فشل رفع تجميد المحفظة.');
      const updated = payload.wallet;
      setWallets((prev) => prev.map((wallet) =>
        wallet.id === walletId
          ? { ...wallet, ...(updated || {}), isFrozen: false, frozenReason: null, frozenAt: null }
          : wallet,
      ));
      setActionSuccess('تم رفع التجميد وتسجيل العملية لدى الخادم.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'تعذر تأكيد رفع التجميد.');
    } finally {
      setLoadingAction(false);
    }
  };

  const filteredWallets = wallets.filter(
    (w) =>
      !searchTerm ||
      (w.userName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (w.userId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (w.userPhone || '').includes(searchTerm) ||
      (w.userEmail && w.userEmail.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <Wallet className="w-7 h-7 text-indigo-400" />
            محافظ العملاء والرقابة المالية
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            متابعة أرصدة العملاء بالعملات الثلاث (YER, USD, SAR)، والتحكم في تجميد المحافظ المشبوهة.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <input
            type="text"
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && fetchCustomerWallets()}
            placeholder="معرف العميل"
            className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="button"
            onClick={fetchCustomerWallets}
            disabled={listLoading || !customerId.trim()}
            className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-xs font-bold"
          >
            <RefreshCw className={`w-4 h-4 ${listLoading ? 'animate-spin' : ''}`} />
            تحميل المحافظ
          </button>
        </div>
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث باسم العميل أو رقم الهاتف..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-right pr-9"
          />
          <Search className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
        </div>
      </div>

      {listError && <div role="alert" className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs">{listError}</div>}
      {actionError && <div role="alert" className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs">{actionError}</div>}
      {actionSuccess && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-3 text-emerald-400 text-xs font-bold">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Wallets Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-bold">
              <tr>
                <th className="py-3 px-4">العميل</th>
                <th className="py-3 px-4">العملة</th>
                <th className="py-3 px-4">الرصيد المتاح</th>
                <th className="py-3 px-4">الرصيد المحجوز</th>
                <th className="py-3 px-4">إجمالي دفتر الأستاذ</th>
                <th className="py-3 px-4">حالة المحفظة</th>
                <th className="py-3 px-4 text-center">الإجراء الإداري</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {listLoading ? (
                <tr><td colSpan={7} className="p-10 text-center text-slate-400">جاري تحميل المحافظ من الخادم...</td></tr>
              ) : filteredWallets.length === 0 ? (
                <tr><td colSpan={7} className="p-10 text-center text-slate-400">لا توجد محافظ محملة. أدخل معرف العميل لتحميل بياناته الحقيقية.</td></tr>
              ) : filteredWallets.map((w) => (
                <tr key={w.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-4 px-4">
                    <span className="font-bold text-white block">{w.userName || w.userId}</span>
                    <span className="text-[10px] text-slate-400 font-mono block">
                      {w.userId} {w.userPhone ? `| ${w.userPhone}` : ''} {w.userEmail ? `| ${w.userEmail}` : ''}
                    </span>
                  </td>
                  <td className="py-4 px-4 font-bold font-mono text-indigo-300">
                    <span className="bg-slate-800 px-2.5 py-1 rounded-lg">{w.currency}</span>
                  </td>
                  <td className="py-4 px-4 font-mono font-black text-sm text-emerald-400">
                    {w.availableBalance.toLocaleString('en-US')} {w.currency}
                  </td>
                  <td className="py-4 px-4 font-mono font-bold text-amber-400">
                    {w.lockedBalance.toLocaleString('en-US')} {w.currency}
                  </td>
                  <td className="py-4 px-4 font-mono font-bold text-white">
                    {w.balance.toLocaleString('en-US')} {w.currency}
                  </td>
                  <td className="py-4 px-4">
                    {w.isFrozen ? (
                      <div>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                          <Lock className="w-3 h-3" /> مجمدة
                        </span>
                        {w.frozenReason && (
                          <span className="text-[10px] text-rose-300 block mt-1">
                            {w.frozenReason}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        <CheckCircle className="w-3 h-3" /> نشطة
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-4 text-center">
                    {w.isFrozen ? (
                      <button
                        onClick={() => handleUnfreeze(w.id)}
                        disabled={loadingAction}
                        className="bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 px-3 py-1.5 rounded-xl font-bold text-xs transition-colors inline-flex items-center gap-1"
                      >
                        <Unlock className="w-3.5 h-3.5" /> رفع التجميد
                      </button>
                    ) : (
                      <button
                        onClick={() => setSelectedWalletForFreeze(w)}
                        disabled={loadingAction}
                        className="bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-300 px-3 py-1.5 rounded-xl font-bold text-xs transition-colors inline-flex items-center gap-1"
                      >
                        <Lock className="w-3.5 h-3.5" /> تجميد المحفظة
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Freeze Reason Modal */}
      {selectedWalletForFreeze && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl text-right">
            <h3 className="text-base font-bold text-rose-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              تجميد محفظة العميل: {selectedWalletForFreeze.userName}
            </h3>
            <p className="text-xs text-slate-400">
              تجميد المحفظة يوقف فورياً كل عمليات الشراء والسحب للعملة (
              {selectedWalletForFreeze.currency}). يرجى توثيق السبب الإداري:
            </p>

            <textarea
              required
              rows={3}
              value={freezeReason}
              onChange={(e) => setFreezeReason(e.target.value)}
              placeholder="مثال: مراجعة أمنية لنشاط غير معتاد أو طلب من الإدارة القانونية..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500 text-right"
            />

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedWalletForFreeze(null)}
                className="flex-1 bg-slate-800 text-slate-300 font-bold py-2.5 rounded-xl text-xs"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={loadingAction || !freezeReason.trim()}
                onClick={() => handleFreeze(selectedWalletForFreeze.id)}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 rounded-xl text-xs disabled:opacity-50"
              >
                تأكيد التجميد
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
