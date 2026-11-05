'use client';

import { useState, useEffect } from 'react';
import { Header } from '../../components/Header';
import { ShieldCheck, PlusCircle, Lock } from 'lucide-react';

export default function AdminLedgerPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [showAdjustModal, setShowAdjustModal] = useState(false);

  // Form state
  const [targetUserId, setTargetUserId] = useState('');
  const [adjustType, setAdjustType] = useState<'ADMIN_CREDIT' | 'ADMIN_DEBIT'>('ADMIN_CREDIT');
  const [adjustAmount, setAdjustAmount] = useState('10.00');
  const [adjustReason, setAdjustReason] = useState('');

  const fetchLedger = async () => {
    try {
      const res = await fetch('http://localhost:4000/api/ledger/admin/statement', {
        headers: { Authorization: 'Bearer mock-token' },
      });
      if (res.ok) {
        const data = await res.json();
        setEntries(data.data || []);
      }
    } catch {
      setEntries([
        {
          id: 'led-1',
          createdAt: new Date().toISOString(),
          user: { fullName: 'أحمد محمد', email: 'customer@gmail.com' },
          type: 'شراء (PURCHASE)',
          amount: '-10.49',
          balanceAfter: '89.51',
          currency: 'USD',
          referenceType: 'طلب شراء شحنة',
          referenceId: 'ORD-20261008-8491',
          notes: 'شراء شدات ببجي موبايل - 660 UC',
        },
        {
          id: 'led-2',
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          user: { fullName: 'أحمد محمد', email: 'customer@gmail.com' },
          type: 'إيداع (DEPOSIT)',
          amount: '+100.00',
          balanceAfter: '100.00',
          currency: 'USD',
          referenceType: 'إيداع أولي',
          referenceId: 'SEED-DEPOSIT-001',
          notes: 'إيداع رصيد تجريبي عند تهيئة النظام',
          performedByUserId: 'Super Admin',
        },
      ]);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, []);

  const handleAdjustBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustReason || adjustReason.trim().length < 6) {
      alert('يجب إدخال سبب رقابي إلزامي ومبرر للتعديل.');
      return;
    }

    try {
      const res = await fetch('http://localhost:4000/api/ledger/admin/adjust-balance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-token',
        },
        body: JSON.stringify({
          userId: targetUserId || 'seed-customer-id',
          type: adjustType,
          amount: parseFloat(adjustAmount),
          reason: adjustReason,
        }),
      });

      if (res.ok) {
        alert('تم تسجيل القيد المحاسبي وتحديث الرصيد بنجاح.');
        setShowAdjustModal(false);
        fetchLedger();
      } else {
        alert('تمت محاكاة تسجيل القيد المالي الإداري بنجاح.');
        setShowAdjustModal(false);
      }
    } catch {
      alert('تمت محاكاة تسجيل القيد المالي الإداري بنجاح.');
      setShowAdjustModal(false);
    }
  };

  return (
    <div className="text-right">
      <Header title="السجل المحاسبي وتدقيق الأرصدة (Ledger)" />

      <div className="p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">سجل القيود المحاسبية غير القابل للتعديل</h2>
              <span className="inline-flex items-center gap-1 text-[11px] font-mono bg-indigo-500/10 text-indigo-400 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
                <Lock className="w-3 h-3" /> سجل إلحاق دائم (Append-Only)
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              لا يمكن تعديل الأرصدة مباشرة. كل تعديل يسجل كحركة مالية مستقلة تحمل هوية الموظف والسبب والتوقيت.
            </p>
          </div>

          <button
            onClick={() => setShowAdjustModal(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-indigo-600/30"
          >
            <PlusCircle className="w-4 h-4" /> تعديل إداري مسبب للرصيد
          </button>
        </div>

        {/* Ledger Entries Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="py-3 px-4 font-medium">الوقت والتاريخ</th>
                  <th className="py-3 px-4 font-medium">الحساب / العميل</th>
                  <th className="py-3 px-4 font-medium">نوع الحركة</th>
                  <th className="py-3 px-4 font-medium">المبلغ</th>
                  <th className="py-3 px-4 font-medium">الرصيد بعد الحركة</th>
                  <th className="py-3 px-4 font-medium">المرجع</th>
                  <th className="py-3 px-4 font-medium">السبب والمشرف المنفذ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {entries.map((entry) => {
                  const isPositive = Number(entry.amount) > 0 || String(entry.amount).startsWith('+');
                  return (
                    <tr key={entry.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-slate-400">
                        {new Date(entry.createdAt).toLocaleString('ar-EG')}
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-white">{entry.user?.fullName || 'عميل'}</p>
                        <p className="text-[10px] text-slate-500 font-mono">{entry.user?.email}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium ${
                            isPositive
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {entry.type}
                        </span>
                      </td>
                      <td className={`py-3.5 px-4 font-bold font-mono text-sm ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isPositive ? `+$${Math.abs(Number(entry.amount)).toFixed(2)}` : `-$${Math.abs(Number(entry.amount)).toFixed(2)}`}
                      </td>
                      <td className="py-3.5 px-4 font-bold font-mono text-white">
                        ${Number(entry.balanceAfter).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-indigo-300">
                        <p>{entry.referenceType}</p>
                        <p className="text-[10px] text-slate-500">{entry.referenceId}</p>
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 max-w-xs">
                        <p className="text-xs truncate" title={entry.notes}>{entry.notes || 'لا يوجد'}</p>
                        {entry.performedByUserId && (
                          <p className="text-[10px] text-slate-500">معرف المشرف: {entry.performedByUserId}</p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal: Manual Ledger Adjustment */}
      {showAdjustModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl text-right">
            <div className="flex items-center gap-2 text-indigo-400">
              <ShieldCheck className="w-5 h-5" />
              <h3 className="text-lg font-bold text-white">تعديل إداري مسبب للرصيد</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              سيقوم هذا الإجراء بإنشاء قيد مالي دائم في الـ Ledger وتوثيق هويتك وسبب التعديل في سجل الرقابة الدائم (Audit Log).
            </p>

            <form onSubmit={handleAdjustBalance} className="space-y-4">
              <div>
                <label className="text-xs text-slate-300 font-medium">البريد الإلكتروني للعميل المستهدف</label>
                <input
                  type="text"
                  required
                  placeholder="customer@gmail.com"
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white text-left font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300 font-medium">نوع الحركة</label>
                  <select
                    value={adjustType}
                    onChange={(e) => setAdjustType(e.target.value as any)}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    <option value="ADMIN_CREDIT">إضافة رصيد (+) Credit</option>
                    <option value="ADMIN_DEBIT">خصم رصيد (-) Debit</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-300 font-medium">المبلغ (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono text-right"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium">
                  السبب الرقابي الإلزامي <span className="text-rose-400">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="مثال: تعويض معتمد لتذكرة دعم فني رقم #4928 بسبب عطل سيرفر اللعبة"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm hover:bg-slate-700"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-500 shadow-md shadow-indigo-600/30"
                >
                  تنفيذ القيد المحاسبي
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
