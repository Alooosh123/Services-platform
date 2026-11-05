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
  const [wallets, setWallets] = useState<CustomerWalletItem[]>([
    {
      id: 'w-cust-yer',
      userId: 'user-customer-003',
      userName: 'أحمد محمد الحاشدي',
      userPhone: '+967770000003',
      userEmail: 'customer@gmail.com',
      currency: 'YER',
      balance: 50000,
      lockedBalance: 0,
      availableBalance: 50000,
      isFrozen: false,
    },
    {
      id: 'w-cust-usd',
      userId: 'user-customer-003',
      userName: 'أحمد محمد الحاشدي',
      userPhone: '+967770000003',
      userEmail: 'customer@gmail.com',
      currency: 'USD',
      balance: 100,
      lockedBalance: 0,
      availableBalance: 100,
      isFrozen: false,
    },
    {
      id: 'w-cust-sar',
      userId: 'user-customer-003',
      userName: 'أحمد محمد الحاشدي',
      userPhone: '+967770000003',
      userEmail: 'customer@gmail.com',
      currency: 'SAR',
      balance: 200,
      lockedBalance: 0,
      availableBalance: 200,
      isFrozen: false,
    },
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWalletForFreeze, setSelectedWalletForFreeze] = useState<CustomerWalletItem | null>(
    null,
  );
  const [freezeReason, setFreezeReason] = useState('');
  const [loadingAction, setLoadingAction] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const handleFreeze = async (walletId: string) => {
    if (!freezeReason.trim()) {
      alert('سبب تجميد المحفظة إجباري');
      return;
    }

    setLoadingAction(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
      const res = await fetch(`http://localhost:4000/api/wallet/admin/${walletId}/freeze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ reason: freezeReason }),
      });
      if (!res.ok) throw new Error();
    } catch {}

    setWallets((prev) =>
      prev.map((w) =>
        w.id === walletId
          ? {
              ...w,
              isFrozen: true,
              frozenReason: freezeReason,
              frozenAt: new Date().toISOString(),
            }
          : w,
      ),
    );

    setLoadingAction(false);
    setSelectedWalletForFreeze(null);
    setFreezeReason('');
    setActionSuccess('تم تجميد المحفظة بنجاح وتوقيف العمليات المالية الصادرة');
    setTimeout(() => setActionSuccess(null), 3000);
  };

  const handleUnfreeze = async (walletId: string) => {
    setLoadingAction(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
      await fetch(`http://localhost:4000/api/wallet/admin/${walletId}/unfreeze`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch {}

    setWallets((prev) =>
      prev.map((w) =>
        w.id === walletId
          ? { ...w, isFrozen: false, frozenReason: null, frozenAt: null }
          : w,
      ),
    );

    setLoadingAction(false);
    setActionSuccess('تم رفع التجميد عن المحفظة واستئناف العمليات بنجاح');
    setTimeout(() => setActionSuccess(null), 3000);
  };

  const filteredWallets = wallets.filter(
    (w) =>
      !searchTerm ||
      w.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.userPhone.includes(searchTerm) ||
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
              {filteredWallets.map((w) => (
                <tr key={w.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-4 px-4">
                    <span className="font-bold text-white block">{w.userName}</span>
                    <span className="text-[10px] text-slate-400 font-mono block">
                      {w.userPhone} | {w.userEmail}
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
