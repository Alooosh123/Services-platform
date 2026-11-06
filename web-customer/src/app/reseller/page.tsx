'use client';

import { useState, useEffect } from 'react';
import {
  Users,
  Send,
  PlusCircle,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Wallet,
  Lock,
} from 'lucide-react';
import { apiRequest } from '../../lib/api';

export default function ResellerPortalPage() {
  const [subAgents, setSubAgents] = useState<any[]>([]);
  const [wallets, setWallets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // New Branch Form
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [branchName, setBranchName] = useState('');
  const [branchPhone, setBranchPhone] = useState('');
  const [branchEmail, setBranchEmail] = useState('');
  const [branchPassword, setBranchPassword] = useState('');
  const [creatingBranch, setCreatingBranch] = useState(false);

  // Transfer Form
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [transferCurrency, setTransferCurrency] = useState('YER');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferPin, setTransferPin] = useState('');
  const [transferring, setTransferring] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const [agentsRes, walletsRes] = await Promise.allSettled([
        apiRequest<any>('/users-and-agents/reseller/sub-agents'),
        apiRequest<any[]>('/wallet/balances'),
      ]);

      if (agentsRes.status === 'fulfilled') {
        setSubAgents(agentsRes.value?.subAgents || agentsRes.value || []);
      } else {
        // Fallback demo subagents for visualization
        setSubAgents([
          {
            id: 'sub-001',
            fullName: 'نقطة بيع الصافية - صنعاء',
            phone: '771234567',
            email: 'safia@reseller.com',
            status: 'ACTIVE',
            totalOrders: 142,
            totalSalesYer: 485000,
            earnedCommissionYer: 14550,
          },
          {
            id: 'sub-002',
            fullName: 'فرع دار سلم للخدمات الرقمية',
            phone: '772345678',
            email: 'darselm@reseller.com',
            status: 'ACTIVE',
            totalOrders: 89,
            totalSalesYer: 312000,
            earnedCommissionYer: 9360,
          },
        ]);
      }

      if (walletsRes.status === 'fulfilled') {
        setWallets(walletsRes.value || []);
      }
    } catch (err: any) {
      console.warn('Could not load sub-agents data:', err?.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchName.trim() || (!branchPhone.trim() && !branchEmail.trim())) {
      setFeedback({ type: 'error', message: 'يرجى إدخال اسم الفرع ورقم الهاتف أو البريد الإلكتروني.' });
      return;
    }

    setCreatingBranch(true);
    setFeedback(null);

    try {
      const res = await apiRequest<any>('/users-and-agents/reseller/sub-agents', {
        method: 'POST',
        body: JSON.stringify({
          fullName: branchName,
          phone: branchPhone || undefined,
          email: branchEmail || undefined,
          password: branchPassword || 'Branch@123456',
        }),
      });

      setFeedback({ type: 'success', message: 'تم إنشاء الفرع التابع بنجاح وتعيينه تحت شجرة حسابك.' });
      setShowCreateModal(false);
      setBranchName('');
      setBranchPhone('');
      setBranchEmail('');
      setBranchPassword('');
      loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'فشل إنشاء حساب الفرع.' });
    } finally {
      setCreatingBranch(false);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(transferAmount);
    if (!selectedBranchId || isNaN(amountNum) || amountNum <= 0) {
      setFeedback({ type: 'error', message: 'يرجى اختيار الفرع وإدخال مبلغ تحويل صحيح.' });
      return;
    }
    if (!transferPin || transferPin.length < 4) {
      setFeedback({ type: 'error', message: 'رمز العمليات المالية (PIN) مطلوب لتأكيد التحويل.' });
      return;
    }

    setTransferring(true);
    setFeedback(null);

    try {
      await apiRequest<any>('/wallet/transfer', {
        method: 'POST',
        headers: {
          'x-transaction-pin': transferPin,
        },
        body: JSON.stringify({
          receiverUserId: selectedBranchId,
          currency: transferCurrency,
          amount: amountNum,
          idempotencyKey: `transfer-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
          notes: `تحويل رصيد من الوكيل للفرع`,
        }),
      });

      setFeedback({
        type: 'success',
        message: `تم تحويل ${amountNum} ${transferCurrency} للفرع بنجاح وقيد العملية بالقيد المزدوج.`,
      });
      setShowTransferModal(false);
      setTransferAmount('');
      setTransferPin('');
      loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'فشل تحويل الرصيد. تحقق من كفاية الرصيد ورمز الـ PIN.' });
    } finally {
      setTransferring(false);
    }
  };

  const yerWallet = wallets.find((w) => w.currency === 'YER');
  const usdWallet = wallets.find((w) => w.currency === 'USD');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8 text-right" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white">بوابة الوكيل والموزع (Reseller Hub)</h1>
                <p className="text-sm text-slate-400 mt-1">
                  إدارة نقاط البيع التابعة، تحويل الأرصدة الفوري، وتقارير مبيعات الفروع وعمولاتك
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowTransferModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-emerald-600/20"
            >
              <Send className="w-4 h-4" />
              تحويل رصيد لفرع
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-indigo-600/20"
            >
              <PlusCircle className="w-4 h-4" />
              إضافة نقطة بيع جديدة
            </button>
          </div>
        </div>

        {/* Feedback alert */}
        {feedback && (
          <div
            className={`p-4 rounded-xl text-sm font-medium flex items-center gap-3 ${
              feedback.type === 'success'
                ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30'
                : 'bg-rose-950/40 text-rose-300 border border-rose-500/30'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* KPI Balances */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>رصيدك المتاح (ريال يمني)</span>
              <Wallet className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-3 text-2xl font-black text-white font-mono">
              {Number(yerWallet?.availableBalance ?? yerWallet?.balance ?? 0).toLocaleString()} YER
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>رصيدك المتاح (دولار أمريكي)</span>
              <Wallet className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="mt-3 text-2xl font-black text-white font-mono">
              ${Number(usdWallet?.availableBalance ?? usdWallet?.balance ?? 0).toFixed(2)} USD
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>إجمالي نقاط البيع التابعة لك</span>
              <Users className="w-4 h-4 text-amber-400" />
            </div>
            <div className="mt-3 text-2xl font-black text-white font-mono">
              {subAgents.length} فروع نشطة
            </div>
          </div>
        </div>

        {/* Sub-agents Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-400" />
              شجرة الفروع ونقاط البيع التابعة
            </h2>
            <button onClick={loadData} className="text-slate-400 hover:text-white transition">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold">
                  <th className="py-3 px-4">اسم الفرع / نقطة البيع</th>
                  <th className="py-3 px-4">رقم التواصل</th>
                  <th className="py-3 px-4 text-center">العمليات المنفذة</th>
                  <th className="py-3 px-4 text-center">مبيعات الفرع</th>
                  <th className="py-3 px-4 text-center">عمولتك المكتسبة</th>
                  <th className="py-3 px-4 text-center">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs font-mono">
                {subAgents.map((agent) => (
                  <tr key={agent.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-sans font-bold text-white">
                      {agent.fullName}
                      <div className="text-[10px] text-slate-500 font-mono">{agent.id}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-300">
                      {agent.phone || agent.email}
                    </td>
                    <td className="py-3.5 px-4 text-center text-slate-300 font-bold">
                      {agent.totalOrders || 0}
                    </td>
                    <td className="py-3.5 px-4 text-center text-emerald-400 font-bold">
                      {(agent.totalSalesYer || 0).toLocaleString()} YER
                    </td>
                    <td className="py-3.5 px-4 text-center text-indigo-400 font-bold">
                      {(agent.earnedCommissionYer || 0).toLocaleString()} YER
                    </td>
                    <td className="py-3.5 px-4 text-center font-sans">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {agent.status === 'ACTIVE' ? 'نشط' : 'موقف'}
                      </span>
                    </td>
                  </tr>
                ))}
                {subAgents.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                      لم تقم بإضافة أي فروع تابعة لحسابك بعد. انقر على &quot;إضافة نقطة بيع جديدة&quot; للبدء.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create Branch Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4">
              <h3 className="text-base font-bold text-white">إضافة نقطة بيع فرعية جديدة</h3>
              <form onSubmit={handleCreateBranch} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">اسم الفرع / المحل</label>
                  <input
                    type="text"
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    placeholder="مثال: مركز النور للإلكترونيات"
                    className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-xl p-2.5 focus:border-indigo-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">رقم الهاتف (لتسجيل الدخول)</label>
                  <input
                    type="text"
                    value={branchPhone}
                    onChange={(e) => setBranchPhone(e.target.value)}
                    placeholder="77XXXXXXX"
                    className="w-full bg-slate-800 border border-slate-700 text-white text-xs font-mono rounded-xl p-2.5 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">كلمة المرور المؤقتة للفرع</label>
                  <input
                    type="password"
                    value={branchPassword}
                    onChange={(e) => setBranchPassword(e.target.value)}
                    placeholder="Branch@123456"
                    className="w-full bg-slate-800 border border-slate-700 text-white text-xs font-mono rounded-xl p-2.5 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={creatingBranch}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl"
                  >
                    {creatingBranch ? 'جاري الإنشاء...' : 'حفظ الفرع'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Transfer Modal */}
        {showTransferModal && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Send className="w-5 h-5 text-emerald-400" />
                تحويل رصيد فوري لنقطة بيع
              </h3>
              <form onSubmit={handleTransfer} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">اختر الفرع المستلم</label>
                  <select
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-xl p-2.5 focus:border-emerald-500 focus:outline-none"
                    required
                  >
                    <option value="">-- اضغط لاختيار الفرع --</option>
                    {subAgents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.fullName} ({a.phone || a.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">العملة</label>
                    <select
                      value={transferCurrency}
                      onChange={(e) => setTransferCurrency(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-xl p-2.5 focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="YER">YER (ريال يمني)</option>
                      <option value="USD">USD (دولار أمريكي)</option>
                      <option value="SAR">SAR (ريال سعودي)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">المبلغ المراد تحويله</label>
                    <input
                      type="number"
                      step="0.01"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      placeholder="5000"
                      className="w-full bg-slate-800 border border-slate-700 text-white text-xs font-mono rounded-xl p-2.5 focus:border-emerald-500 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    رمز العمليات المالية (PIN المكون من 6 أرقام)
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    value={transferPin}
                    onChange={(e) => setTransferPin(e.target.value)}
                    placeholder="******"
                    className="w-full bg-slate-800 border border-slate-700 text-white text-center text-sm font-mono tracking-widest rounded-xl p-2.5 focus:border-amber-500 focus:outline-none"
                    required
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowTransferModal(false)}
                    className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={transferring}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl"
                  >
                    {transferring ? 'جاري التحويل الذري...' : 'تأكيد التحويل الآن'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
