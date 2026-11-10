'use client';

import { useState, useEffect } from 'react';
import {
  Wallet,
  PlusCircle,
  ShieldCheck,
  Lock,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  Copy,
  ExternalLink,
  RefreshCw,
  Eye,
  Building2,
  Phone,
  FileText,
} from 'lucide-react';
import { apiUrl } from '../../lib/api';

interface WalletData {
  id: string;
  currency: 'YER' | 'USD' | 'SAR';
  balance: number;
  lockedBalance: number;
  availableBalance: number;
  isFrozen: boolean;
  frozenReason?: string | null;
}

interface PaymentChannel {
  code: string;
  name: string;
  nameAr: string;
  accountNumber: string;
  accountHolderName: string;
  instructionsAr: string;
  supportedCurrencies: string[];
  minAmount: number;
  maxAmount: number;
  mode?: string;
  senderIdentifierType?: string;
}

interface SavedSenderAccount {
  id: string;
  channelCode: string;
  identifierType: string;
  maskedIdentifier: string;
  status: string;
}

interface DepositRequest {
  id: string;
  depositNumber: string;
  currency: string;
  amount: number;
  paymentMethodCode: string;
  referenceNumber: string;
  proofImageUrl?: string;
  senderName?: string;
  status: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'CREDITED' | 'REJECTED';
  rejectionReason?: string;
  reviewNotes?: string;
  createdAt: string;
}

export default function CustomerWalletPage() {
  const [selectedCurrency, setSelectedCurrency] = useState<'YER' | 'USD' | 'SAR'>('YER');
  const [activeTab, setActiveTab] = useState<'overview' | 'deposit' | 'requests'>('overview');
  const [wallets, setWallets] = useState<Record<string, WalletData>>({});
  const [channels, setChannels] = useState<PaymentChannel[]>([]);
  const [depositRequests, setDepositRequests] = useState<DepositRequest[]>([]);
  const [senderAccounts, setSenderAccounts] = useState<SavedSenderAccount[]>([]);

  // Form states for deposit request
  const [depositChannel, setDepositChannel] = useState('JAIB');
  const [depositAmount, setDepositAmount] = useState('25000');
  const [depositRefNumber, setDepositRefNumber] = useState('');
  const [senderName, setSenderName] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [senderIdentifier, setSenderIdentifier] = useState('');
  const [senderIdentifierConsent, setSenderIdentifierConsent] = useState(false);
  const [proofUrl, setProofUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [copiedAccount, setCopiedAccount] = useState<string | null>(null);

  // Fetch real data on mount
  useEffect(() => {
    setWallets({});
    setChannels([]);
    setDepositRequests([]);
    fetchBalances();
    fetchChannels();
    fetchMyDeposits();
    fetchMySenderAccounts();
  }, []);

  const fetchBalances = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('customer_token') : null;
      const res = await fetch(apiUrl('/wallet/balances'), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        const map: Record<string, WalletData> = {};
        for (const w of data) {
          map[w.currency] = w;
        }
        setWallets(map);
      }
    } catch {
      setWallets({});
    }
  };

  const fetchChannels = async () => {
    try {
      const res = await fetch(apiUrl('/deposits/channels'));
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setChannels(data);
          setDepositChannel((current) =>
            data.some((channel: PaymentChannel) => channel.code === current)
              ? current
              : data[0]?.code || '',
          );
        }
      }
    } catch {
      setChannels([]);
    }
  };

  const fetchMyDeposits = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('customer_token') : null;
      const res = await fetch(apiUrl('/deposits/my-deposits'), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setDepositRequests(data);
        }
      }
    } catch {
      setDepositRequests([]);
    }
  };

  const fetchMySenderAccounts = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('customer_token') : null;
      if (!token) return setSenderAccounts([]);
      const res = await fetch(apiUrl('/deposits/sender-accounts'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSenderAccounts(Array.isArray(data) ? data : []);
      }
    } catch {
      setSenderAccounts([]);
    }
  };

  const handleCopy = (acc: string) => {
    navigator.clipboard.writeText(acc);
    setCopiedAccount(acc);
    setTimeout(() => setCopiedAccount(null), 2000);
  };

  const handleCreateDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChannelInfo) {
      setDepositError('لا توجد قناة إيداع متاحة حالياً');
      return;
    }
    const isManualChannel = selectedChannelInfo.mode === 'MANUAL';
    if (!isManualChannel && selectedChannelInfo.mode !== 'API') {
      setDepositError('نمط قناة الدفع غير معروف أو غير متاح حالياً.');
      return;
    }
    if (selectedChannelInfo.mode === 'API' && !depositRefNumber.trim()) {
      setDepositError('قناة API تتطلب مرجع العملية الصادر من المزود بعد إتمام الدفع.');
      return;
    }

    setIsSubmitting(true);
    setDepositError(null);
    const amountVal = parseFloat(depositAmount);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('customer_token') : null;
      let senderAccountId: string | undefined;
      if (isManualChannel) {
        const existingSender = senderAccounts.find((account) => account.channelCode === depositChannel);
        if (senderIdentifier.trim()) {
          if (!senderIdentifierConsent) {
            throw new Error('وافق على حفظ معرّف حساب الإرسال مشفّراً حتى يستخدمه الوكيل في المطابقة.');
          }
          const saveResponse = await fetch(apiUrl('/deposits/sender-accounts'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              channelCode: depositChannel,
              identifierType: selectedChannelInfo.senderIdentifierType || 'PHONE',
              identifier: senderIdentifier.trim(),
              consentAccepted: true,
            }),
          });
          const saved = await saveResponse.json();
          if (!saveResponse.ok) {
            throw new Error(saved.message || 'تعذر حفظ معرّف حساب الإرسال.');
          }
          senderAccountId = saved.id;
          setSenderAccounts((current) => [
            ...current.filter((account) => account.channelCode !== depositChannel),
            saved,
          ]);
          setSenderIdentifier('');
          setSenderIdentifierConsent(false);
        } else if (existingSender) {
          senderAccountId = existingSender.id;
        } else {
          throw new Error('أدخل رقم البديل أو رقم الهاتف المرتبط بمحفظتك واحفظه أولاً.');
        }
      }

      const res = await fetch(apiUrl('/deposits/request'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          currency: selectedCurrency,
          amount: amountVal,
          paymentMethodCode: depositChannel,
          ...(depositRefNumber.trim() ? { referenceNumber: depositRefNumber.trim() } : {}),
          ...(senderAccountId ? { senderAccountId } : {}),
          senderName,
          senderPhone,
          proofImageUrl: proofUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'فشل في إرسال طلب الإيداع');
      }

      setDepositRequests([data.deposit, ...depositRequests]);
      setSubmitSuccess(true);
      setDepositRefNumber('');
      await fetchMySenderAccounts();
      setTimeout(() => {
        setSubmitSuccess(false);
        setActiveTab('requests');
      }, 2000);
    } catch (err) {
      setDepositError(err instanceof Error ? err.message : 'تعذر إرسال طلب الإيداع');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentWallet = wallets[selectedCurrency] || {
    id: 'w-default',
    currency: selectedCurrency,
    balance: 0,
    lockedBalance: 0,
    availableBalance: 0,
    isFrozen: false,
  };

  const currencyChannels = channels.filter((channel) =>
    channel.supportedCurrencies.includes(selectedCurrency),
  );
  const selectedChannelInfo =
    currencyChannels.find((channel) => channel.code === depositChannel) || currencyChannels[0];

  const getStatusBadge = (status: DepositRequest['status']) => {
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
            <CheckCircle className="w-3.5 h-3.5" /> تمت الموافقة المبدئية
          </span>
        );
      case 'CREDITED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle className="w-3.5 h-3.5" /> تم الإيداع في المحفظة
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 text-right" dir="rtl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3">
            <Wallet className="w-8 h-8 text-indigo-400" />
            محفظتي الرقمية والنظام المالي
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            إدارة أرصدتك بالريال اليمني والدولار والسعودي، مع نظام الإيداع المباشر عبر المحافظ
            اليمنية.
          </p>
        </div>

        {/* Currency Switcher */}
        <div className="inline-flex bg-slate-900 border border-slate-800 p-1.5 rounded-2xl shadow-inner">
          {(['YER', 'USD', 'SAR'] as const).map((curr) => (
            <button
              key={curr}
              onClick={() => setSelectedCurrency(curr)}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                selectedCurrency === curr
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {curr === 'YER' && 'ريال يمني (YER)'}
              {curr === 'USD' && 'دولار أمريكي (USD)'}
              {curr === 'SAR' && 'ريال سعودي (SAR)'}
            </button>
          ))}
        </div>
      </div>

      {/* Frozen Alert Banner */}
      {currentWallet.isFrozen && (
        <div className="bg-rose-950/40 border border-rose-500/50 rounded-2xl p-5 flex items-start gap-4 text-rose-200">
          <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-black text-rose-300">
              تم تجميد محفظة {selectedCurrency} من قبل الإدارة المالية
            </h4>
            <p className="text-xs text-rose-200/80">
              السبب: {currentWallet.frozenReason || 'مراجعة أمنية وإدارية'}. العمليات الصادرة
              (الشراء والتحويل) موقوفة مؤقتاً حتى رفع التجميد.
            </p>
          </div>
        </div>
      )}

      {/* Main Wallet Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Available Balance Card */}
        <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 border border-indigo-500/30 rounded-3xl p-6 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between text-indigo-300 text-xs font-bold mb-3">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> الرصيد المتاح للاستخدام
            </span>
            <span className="font-mono bg-indigo-900/60 px-2 py-0.5 rounded text-[10px]">
              {selectedCurrency}
            </span>
          </div>
          <div className="text-3xl sm:text-4xl font-black font-mono text-emerald-400 mb-2">
            {currentWallet.availableBalance.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <p className="text-[11px] text-slate-400">
            يمكنك استخدامه فوراً لشحن شدات الألعاب والتطبيقات
          </p>
        </div>

        {/* Locked Balance Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold mb-3">
            <span className="flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-amber-400" /> الرصيد المحجوز (Held)
            </span>
            <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-[10px]">
              {selectedCurrency}
            </span>
          </div>
          <div className="text-3xl sm:text-4xl font-black font-mono text-amber-400 mb-2">
            {currentWallet.lockedBalance.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <p className="text-[11px] text-slate-400">
            مبالغ محجوزة لطلبات شحن قيد المعالجة والانتظار
          </p>
        </div>

        {/* Total Ledger Balance Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold mb-3">
            <span>الرصيد الإجمالي في دفتر الأستاذ</span>
            <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-[10px]">
              {selectedCurrency}
            </span>
          </div>
          <div className="text-3xl sm:text-4xl font-black font-mono text-white mb-2">
            {currentWallet.balance.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <p className="text-[11px] text-slate-400">
            موثق بالقيد المحاسبي المزدوج ولا يقبل التغيير المباشر
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800 gap-6">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-4 text-sm font-bold border-b-2 transition-colors ${
            activeTab === 'overview'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          نظرة عامة والتعليمات
        </button>
        <button
          onClick={() => setActiveTab('deposit')}
          className={`pb-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'deposit'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <PlusCircle className="w-4 h-4" /> طلب إيداع جديد (المحافظ اليمنية)
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={`pb-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'requests'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Clock className="w-4 h-4" /> متابعة طلبات الإيداع ({depositRequests.length})
        </button>
      </div>

      {/* TAB 1: OVERVIEW & CHANNELS */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-400" />
              قنوات الإيداع اليمنية الرسمية المعتمدة
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              تتم عملية الإيداع بالتحويل إلى أحد حسابات المنصة المعتمدة أدناه، ثم تسجيل طلب الإيداع
              برقم الحوالة وصورة الإشعار. يقوم ضابط المالية بمطابقة الحوالة وقيد الرصيد فوراً عبر
              القيد المزدوج.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {channels.map((ch) => (
                <div
                  key={ch.code}
                  className="bg-slate-950 border border-slate-800/80 rounded-2xl p-5 space-y-3 relative group hover:border-indigo-500/50 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-indigo-300">{ch.nameAr}</span>
                    <span className="text-[10px] font-mono bg-indigo-950 text-indigo-400 px-2 py-0.5 rounded">
                      {ch.code}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-400 block">رقم الحساب / المحفظة:</span>
                    <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                      <span className="font-mono font-bold text-white text-base">
                        {ch.accountNumber}
                      </span>
                      <button
                        onClick={() => handleCopy(ch.accountNumber)}
                        className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 bg-slate-800 px-2 py-1 rounded-lg"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        {copiedAccount === ch.accountNumber ? 'تم النسخ' : 'نسخ'}
                      </button>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400">
                    الاسم: <strong className="text-slate-200">{ch.accountHolderName}</strong>
                  </div>

                  <p className="text-[11px] text-slate-400/80 line-clamp-2 leading-relaxed">
                    {ch.instructionsAr}
                  </p>

                  <button
                    onClick={() => {
                      setDepositChannel(ch.code);
                      setActiveTab('deposit');
                    }}
                    className="w-full mt-2 bg-slate-800 hover:bg-indigo-600 text-white font-bold py-2 rounded-xl text-xs transition-colors"
                  >
                    إيداع عبر هذه القناة
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DEPOSIT REQUEST FORM */}
      {activeTab === 'deposit' && (
        <div className="max-w-2xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="space-y-1">
            <h3 className="text-lg font-black text-white">تقديم طلب إيداع جديد</h3>
            <p className="text-xs text-slate-400">
              قم بالتحويل إلى حساب الاستقبال الرسمي. احفظ رقم البديل أو رقم الهاتف المرتبط بمحفظتك مرة واحدة؛ يطابق الوكيل الحركة في السجل الرسمي، ويُضاف الرصيد آلياً عند اكتمال المطابقة وتفعيل السياسة.
            </p>
          </div>

          {submitSuccess && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-3 text-emerald-400 text-xs font-bold">
              <CheckCircle className="w-5 h-5 shrink-0" />
              <span>
                تم تسجيل طلب الإيداع. ستتم مطابقة التحويل، وقد يضاف الرصيد آلياً عند تطابق بيانات الحساب والحركة وفق سياسة القناة.
              </span>
            </div>
          )}

          {depositError && <p role="alert" className="text-sm text-rose-400">{depositError}</p>}

          {/* Selected Channel Info Box */}
          {selectedChannelInfo ? (
          <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-indigo-300">
                الحساب الرسمي المستلم ({selectedChannelInfo.nameAr}):
              </span>
              <button
                onClick={() => handleCopy(selectedChannelInfo.accountNumber)}
                className="text-[11px] text-indigo-400 hover:underline flex items-center gap-1"
              >
                <Copy className="w-3 h-3" /> نسخ الرقم
              </button>
            </div>
            <div className="text-lg font-mono font-black text-emerald-400">
              {selectedChannelInfo.accountNumber}
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {selectedChannelInfo.instructionsAr}
            </p>
          </div>
          ) : (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
              لا توجد قنوات إيداع متاحة حالياً. يرجى المحاولة لاحقاً.
            </p>
          )}

          <form onSubmit={handleCreateDeposit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  قناة التحويل اليمنية
                </label>
                <select
                  value={depositChannel}
                  onChange={(e) => { setDepositChannel(e.target.value); setSenderIdentifier(''); setSenderIdentifierConsent(false); }}
                  disabled={currencyChannels.length === 0}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 text-right disabled:opacity-50"
                >
                  {currencyChannels.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.nameAr}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  عملة الإيداع
                </label>
                <select
                  value={selectedCurrency}
                  onChange={(e) => {
                    const nextCurrency = e.target.value as any;
                    setSelectedCurrency(nextCurrency);
                    const available = channels.filter((channel) =>
                      channel.supportedCurrencies.includes(nextCurrency),
                    );
                    setDepositChannel(available[0]?.code || '');
                    setSenderIdentifier('');
                    setSenderIdentifierConsent(false);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 text-right font-bold"
                >
                  <option value="YER">ريال يمني (YER)</option>
                  <option value="USD">دولار أمريكي (USD)</option>
                  <option value="SAR">ريال سعودي (SAR)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                المبلغ المحول ({selectedCurrency})
              </label>
              <input
                type="number"
                required
                min={1}
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="25000"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white font-mono text-right focus:outline-none focus:border-indigo-500"
              />
            </div>

            {selectedChannelInfo?.mode === 'MANUAL' && (
              <div className="space-y-3 rounded-2xl border border-indigo-500/30 bg-indigo-950/20 p-4">
                <div>
                  <h4 className="text-sm font-black text-indigo-200">حساب الإرسال الخاص بك على هذه المحفظة</h4>
                  <p className="mt-1 text-xs leading-6 text-slate-400">
                    احفظه مرة واحدة فقط. سيستخدمه الوكيل لمطابقة اسم/معرّف المرسل مع الحركة الواردة في سجل المحفظة الرسمي.
                  </p>
                </div>
                {senderAccounts.find((account) => account.channelCode === depositChannel) && !senderIdentifier.trim() && (
                  <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-200">
                    الحساب المحفوظ: <strong>{senderAccounts.find((account) => account.channelCode === depositChannel)?.maskedIdentifier}</strong>
                    {' · '}الحالة: {senderAccounts.find((account) => account.channelCode === depositChannel)?.status === 'VERIFIED' ? 'تم التحقق' : 'بانتظار أول مطابقة'}
                    . اترك الحقل فارغاً لاستخدام الحساب المحفوظ، أو أدخل معرّفاً جديداً لتحديثه.
                  </p>
                )}
                <label className="block space-y-1.5">
                  <span className="text-xs font-bold text-slate-300">
                    {selectedChannelInfo.senderIdentifierType === 'ALIAS'
                      ? 'رقم البديل لمحفظتك'
                      : selectedChannelInfo.senderIdentifierType === 'WALLET_ID'
                        ? 'معرّف محفظتك'
                        : selectedChannelInfo.senderIdentifierType === 'ACCOUNT_NUMBER'
                          ? 'رقم حساب الإرسال'
                          : 'رقم الهاتف المرتبط بمحفظتك'}
                  </span>
                  <input
                    value={senderIdentifier}
                    onChange={(e) => setSenderIdentifier(e.target.value)}
                    maxLength={80}
                    placeholder="اكتبه كما يظهر في تطبيق المحفظة"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white font-mono text-right focus:outline-none focus:border-indigo-500"
                  />
                </label>
                {senderIdentifier.trim() && (
                  <label className="flex items-start gap-2 text-xs leading-6 text-slate-300">
                    <input
                      type="checkbox"
                      checked={senderIdentifierConsent}
                      onChange={(e) => setSenderIdentifierConsent(e.target.checked)}
                      className="mt-1"
                    />
                    <span>أوافق على حفظ هذا المعرّف مشفّراً وربطه بحسابي لهذه المحفظة لغرض مطابقة الإيداعات. لن يظهر كاملاً في واجهتي أو في السجل العام.</span>
                  </label>
                )}
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                رقم الحوالة المرجعي {selectedChannelInfo?.mode === 'API' ? '(مطلوب من المزود)' : '(اختياري للقنوات اليدوية)'}
              </label>
              <input
                type="text"
                required={selectedChannelInfo?.mode === 'API'}
                value={depositRefNumber}
                onChange={(e) => setDepositRefNumber(e.target.value)}
                placeholder="اتركه فارغاً إن لم يظهر لك رقم مرجعي"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white font-mono text-right focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                يستطيع الوكيل مطابقة الرقم من سجل المحفظة إذا لم يكن متاحاً عند إنشاء الطلب.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  اسم صاحب الحساب المحول
                </label>
                <input
                  type="text"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="اسم صاحب الحساب المحول"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white text-right focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  رقم هاتف المحول
                </label>
                <input
                  type="tel"
                  value={senderPhone}
                  onChange={(e) => setSenderPhone(e.target.value)}
                  placeholder="+967 77..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white font-mono text-right focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                صورة الإشعار أو السند (رابط أو ملف)
              </label>
              <input
                type="text"
                value={proofUrl}
                onChange={(e) => setProofUrl(e.target.value)}
                placeholder="رابط مستند الإثبات إن توفر"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white font-mono text-right focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || !selectedChannelInfo}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-4 rounded-xl text-sm transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
              >
                {isSubmitting ? 'جاري إرسال الطلب...' : 'إرسال طلب الإيداع للتحقق'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: DEPOSITS TRACKING & TIMELINE */}
      {activeTab === 'requests' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-sm space-y-4">
          <div className="p-6 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">سجل طلبات الإيداع وحالات التدقيق</h3>
              <p className="text-xs text-slate-400 mt-1">
                تتبع حالة إيداعاتك مباشرة من الانتظار وحتى القيد المالي في المحفظة
              </p>
            </div>
            <button
              onClick={fetchMyDeposits}
              className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700/60"
            >
              <RefreshCw className="w-3.5 h-3.5" /> تحديث الحالات
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950 border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="py-3 px-4 font-bold">رقم الطلب</th>
                  <th className="py-3 px-4 font-bold">القناة</th>
                  <th className="py-3 px-4 font-bold">المبلغ</th>
                  <th className="py-3 px-4 font-bold">الرقم المرجعي</th>
                  <th className="py-3 px-4 font-bold">حالة الطلب</th>
                  <th className="py-3 px-4 font-bold">التاريخ</th>
                  <th className="py-3 px-4 font-bold">ملاحظات الإدارة المالية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {depositRequests.map((dep) => (
                  <tr key={dep.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-4 px-4 font-mono font-bold text-indigo-300">
                      {dep.depositNumber}
                    </td>
                    <td className="py-4 px-4">
                      <span className="bg-slate-800 px-2 py-1 rounded text-[11px] font-bold text-slate-200">
                        {dep.paymentMethodCode}
                      </span>
                    </td>
                    <td className="py-4 px-4 font-mono font-black text-sm text-emerald-400">
                      {dep.amount.toLocaleString('en-US')} {dep.currency}
                    </td>
                    <td className="py-4 px-4 font-mono text-slate-300">{dep.referenceNumber?.startsWith('PENDING-') ? 'بانتظار مرجع الحركة' : dep.referenceNumber}</td>
                    <td className="py-4 px-4">{getStatusBadge(dep.status)}</td>
                    <td className="py-4 px-4 text-slate-400 font-mono text-[11px]">
                      {new Date(dep.createdAt).toLocaleDateString('ar-EG', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-4 px-4 text-slate-300 text-[11px] max-w-xs">
                      {dep.status === 'REJECTED' && (
                        <span className="text-rose-400 font-bold block">
                          سبب الرفض: {dep.rejectionReason}
                        </span>
                      )}
                      {dep.reviewNotes && <span>{dep.reviewNotes}</span>}
                      {!dep.reviewNotes && !dep.rejectionReason && (
                        <span className="text-slate-500">بانتظار المراجعة</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
