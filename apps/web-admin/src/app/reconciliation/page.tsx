'use client';

import { useState } from 'react';
import {
  Scale,
  CheckCircle,
  AlertTriangle,
  Clock,
  ShieldCheck,
  RefreshCw,
  Search,
  Filter,
  DollarSign,
  ArrowUpRight,
  ArrowDownLeft,
  ServerCog,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Layers,
  FileText,
  Building,
  CheckCircle2,
  XCircle,
  Sliders,
  Wallet,
  Lock,
} from 'lucide-react';

interface ReconciliationBatch {
  id: string;
  batchNumber: string;
  channelCode: string;
  periodStart: string;
  periodEnd: string;
  totalItems: number;
  matchedItems: number;
  discrepanciesCount: number;
  totalBankAmount: number;
  totalInternalAmount: number;
  netDifference: number;
  currency: string;
  status: 'BALANCED' | 'DISCREPANCY_FOUND' | 'RECONCILED_WITH_ADJUSTMENTS';
  reconciledAt: string;
  reconciledBy: string;
}

interface DiscrepancyItem {
  id: string;
  batchNumber: string;
  channelCode: string;
  discrepancyType: 'AMOUNT_MISMATCH' | 'CURRENCY_MISMATCH' | 'MISSING_IN_INTERNAL' | 'MISSING_IN_BANK';
  externalReference: string;
  internalReference?: string;
  bankAmount: number;
  internalAmount: number;
  difference: number;
  currency: string;
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'DISPUTED';
  resolutionNotes?: string;
  resolutionType?: string;
  detectedAt: string;
}

interface PaymentChannel {
  code: string;
  name: string;
  mode: 'API' | 'MANUAL' | 'BLOCKED_EXTERNAL' | 'DISABLED';
  capabilities: {
    depositConfirm: boolean;
    transactionLookup: boolean;
    payout: boolean;
    balance: boolean;
    reconcile: boolean;
  };
  accountNumber: string;
  accountHolder: string;
  isLegalVerified: boolean;
  minAmount: number;
  maxAmount: number;
  feePercentage: number;
  fixedFee: number;
  dailyVolume: number;
  dailyLimit: number;
  currency: string;
}

interface SupplierAccount {
  id: string;
  providerCode: string;
  providerName: string;
  accountType: 'PREPAID' | 'PAY_PER_ORDER';
  currency: string;
  balance: number;
  creditLimit: number;
  lowBalanceThreshold: number;
  status: 'ACTIVE' | 'LOW_BALANCE' | 'SUSPENDED';
  lastFundedAt?: string;
  lastFundedAmount?: number;
  ledgerAccountCode: string;
}

interface PayoutItem {
  id: string;
  payoutNumber: string;
  userId: string;
  userName: string;
  amount: number;
  currency: string;
  channelCode: string;
  beneficiaryAccount: string;
  beneficiaryName: string;
  status: 'REQUESTED' | 'APPROVED' | 'PROCESSING' | 'CONFIRMED' | 'FAILED' | 'UNKNOWN';
  mode: 'API' | 'MANUAL';
  externalReference?: string;
  ledgerTxId?: string;
  createdAt: string;
  notes?: string;
}

export default function ReconciliationPage() {
  const [activeTab, setActiveTab] = useState<'batches' | 'discrepancies' | 'channels' | 'suppliers' | 'payouts'>('batches');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('ALL');

  // Modal States
  const [isRunBatchModalOpen, setIsRunBatchModalOpen] = useState(false);
  const [isFundSupplierModalOpen, setIsFundSupplierModalOpen] = useState(false);
  const [isSwitchModeModalOpen, setIsSwitchModeModalOpen] = useState(false);
  const [isResolveDiscrepancyModalOpen, setIsResolveDiscrepancyModalOpen] = useState(false);

  // Selected Items for Actions
  const [activeChannelToEdit, setActiveChannelToEdit] = useState<PaymentChannel | null>(null);
  const [activeDiscrepancyToResolve, setActiveDiscrepancyToResolve] = useState<DiscrepancyItem | null>(null);
  const [activeSupplierToFund, setActiveSupplierToFund] = useState<SupplierAccount | null>(null);

  // Form State
  const [newChannelMode, setNewChannelMode] = useState<'API' | 'MANUAL' | 'BLOCKED_EXTERNAL' | 'DISABLED'>('MANUAL');
  const [resolutionType, setResolutionType] = useState('ADJUST_LEDGER');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [fundingAmount, setFundingAmount] = useState('1000');
  const [fundingBankRef, setFundingBankRef] = useState('BANK-TR-FUND-9921');

  // Notification Banner
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  // Initial State: Batches
  const [batches, setBatches] = useState<ReconciliationBatch[]>([
    {
      id: 'rb-20261010-01',
      batchNumber: 'REC-20261010-001',
      channelCode: 'JAIB',
      periodStart: '2026-10-09T00:00:00Z',
      periodEnd: '2026-10-09T23:59:59Z',
      totalItems: 48,
      matchedItems: 48,
      discrepanciesCount: 0,
      totalBankAmount: 2450000,
      totalInternalAmount: 2450000,
      netDifference: 0,
      currency: 'YER',
      status: 'BALANCED',
      reconciledAt: '2026-10-10T02:00:00Z',
      reconciledBy: 'نظام التسوية الآلي (Batch Job)',
    },
    {
      id: 'rb-20261010-02',
      batchNumber: 'REC-20261010-002',
      channelCode: 'JAWALI',
      periodStart: '2026-10-09T00:00:00Z',
      periodEnd: '2026-10-09T23:59:59Z',
      totalItems: 32,
      matchedItems: 31,
      discrepanciesCount: 1,
      totalBankAmount: 1850000,
      totalInternalAmount: 1845000,
      netDifference: 5000,
      currency: 'YER',
      status: 'DISCREPANCY_FOUND',
      reconciledAt: '2026-10-10T02:15:00Z',
      reconciledBy: 'نظام التسوية الآلي (Batch Job)',
    },
    {
      id: 'rb-20261010-03',
      batchNumber: 'REC-20261010-003',
      channelCode: 'ONE_CASH',
      periodStart: '2026-10-09T00:00:00Z',
      periodEnd: '2026-10-09T23:59:59Z',
      totalItems: 19,
      matchedItems: 19,
      discrepanciesCount: 0,
      totalBankAmount: 980000,
      totalInternalAmount: 980000,
      netDifference: 0,
      currency: 'YER',
      status: 'BALANCED',
      reconciledAt: '2026-10-10T02:30:00Z',
      reconciledBy: 'نظام التسوية الآلي (Batch Job)',
    },
  ]);

  // Initial State: Discrepancies
  const [discrepancies, setDiscrepancies] = useState<DiscrepancyItem[]>([
    {
      id: 'disc-001',
      batchNumber: 'REC-20261010-002',
      channelCode: 'JAWALI',
      discrepancyType: 'AMOUNT_MISMATCH',
      externalReference: 'JW-TX-998811',
      internalReference: 'DEP-20261009-082',
      bankAmount: 30000,
      internalAmount: 25000,
      difference: 5000,
      currency: 'YER',
      status: 'OPEN',
      detectedAt: '2026-10-10T02:15:00Z',
    },
    {
      id: 'disc-002',
      batchNumber: 'REC-20261008-001',
      channelCode: 'JAIB',
      discrepancyType: 'MISSING_IN_INTERNAL',
      externalReference: 'JB-UNKN-44331',
      bankAmount: 10000,
      internalAmount: 0,
      difference: 10000,
      currency: 'YER',
      status: 'RESOLVED',
      resolutionNotes: 'تم تحديد العميل بموجب رقم الهاتف وقيد السند المحاسبي التسويوي.',
      resolutionType: 'ADJUST_LEDGER',
      detectedAt: '2026-10-08T02:00:00Z',
    },
  ]);

  // Initial State: Channels with Capability Flags
  const [channels, setChannels] = useState<PaymentChannel[]>([
    {
      code: 'JAIB',
      name: 'محفظة جيب (بنك التضامن)',
      mode: 'API',
      capabilities: {
        depositConfirm: true,
        transactionLookup: true,
        payout: false,
        balance: true,
        reconcile: true,
      },
      accountNumber: '770123456',
      accountHolder: 'مؤسسة الشحن الرقمي لتقنية المعلومات',
      isLegalVerified: true,
      minAmount: 1000,
      maxAmount: 2000000,
      feePercentage: 0,
      fixedFee: 0,
      dailyVolume: 2450000,
      dailyLimit: 20000000,
      currency: 'YER',
    },
    {
      code: 'JAWALI',
      name: 'محفظة جوالي (بنك اليمن والكويت)',
      mode: 'API',
      capabilities: {
        depositConfirm: true,
        transactionLookup: true,
        payout: false,
        balance: false,
        reconcile: true,
      },
      accountNumber: '771234567',
      accountHolder: 'مؤسسة الشحن الرقمي لتقنية المعلومات',
      isLegalVerified: true,
      minAmount: 1000,
      maxAmount: 1500000,
      feePercentage: 0,
      fixedFee: 0,
      dailyVolume: 1850000,
      dailyLimit: 15000000,
      currency: 'YER',
    },
    {
      code: 'ONE_CASH',
      name: 'ون كاش (OneCash)',
      mode: 'MANUAL',
      capabilities: {
        depositConfirm: false,
        transactionLookup: false,
        payout: false,
        balance: false,
        reconcile: true,
      },
      accountNumber: '772345678',
      accountHolder: 'مؤسسة الشحن الرقمي لتقنية المعلومات',
      isLegalVerified: true,
      minAmount: 1000,
      maxAmount: 1000000,
      feePercentage: 0,
      fixedFee: 0,
      dailyVolume: 980000,
      dailyLimit: 10000000,
      currency: 'YER',
    },
    {
      code: 'EASY',
      name: 'إيزي (بنك اليمن الدولي)',
      mode: 'MANUAL',
      capabilities: {
        depositConfirm: false,
        transactionLookup: false,
        payout: false,
        balance: false,
        reconcile: true,
      },
      accountNumber: '773456789',
      accountHolder: 'مؤسسة الشحن الرقمي لتقنية المعلومات',
      isLegalVerified: true,
      minAmount: 2000,
      maxAmount: 3000000,
      feePercentage: 0,
      fixedFee: 0,
      dailyVolume: 450000,
      dailyLimit: 15000000,
      currency: 'YER',
    },
    {
      code: 'CASH',
      name: 'سند إيداع نقدي / حوالة صرافة',
      mode: 'MANUAL',
      capabilities: {
        depositConfirm: false,
        transactionLookup: false,
        payout: false,
        balance: false,
        reconcile: true,
      },
      accountNumber: 'SANAD-OFFICE-01',
      accountHolder: 'مكتب الخزينة الرئيسي - صنعاء',
      isLegalVerified: true,
      minAmount: 5000,
      maxAmount: 10000000,
      feePercentage: 0,
      fixedFee: 0,
      dailyVolume: 320000,
      dailyLimit: 30000000,
      currency: 'YER',
    },
  ]);

  // Initial State: Supplier Balances
  const [suppliers, setSuppliers] = useState<SupplierAccount[]>([
    {
      id: 'sup-001',
      providerCode: 'SMILE_ONE',
      providerName: 'Smile One API (شحن ألعاب)',
      accountType: 'PREPAID',
      currency: 'USD',
      balance: 4850.5,
      creditLimit: 0,
      lowBalanceThreshold: 500,
      status: 'ACTIVE',
      lastFundedAt: '2026-10-08T14:30:00Z',
      lastFundedAmount: 2000,
      ledgerAccountCode: '1130-SMILE_ONE',
    },
    {
      id: 'sup-002',
      providerCode: 'MOOGOLD',
      providerName: 'MooGold Gateway',
      accountType: 'PREPAID',
      currency: 'USD',
      balance: 320.0,
      creditLimit: 0,
      lowBalanceThreshold: 500,
      status: 'LOW_BALANCE',
      lastFundedAt: '2026-10-06T11:00:00Z',
      lastFundedAmount: 1500,
      ledgerAccountCode: '1130-MOOGOLD',
    },
    {
      id: 'sup-003',
      providerCode: 'UNIPIN',
      providerName: 'UniPin Direct Integration',
      accountType: 'PAY_PER_ORDER',
      currency: 'USD',
      balance: 7280.0,
      creditLimit: 2000,
      lowBalanceThreshold: 1000,
      status: 'ACTIVE',
      lastFundedAt: '2026-10-09T09:15:00Z',
      lastFundedAmount: 3000,
      ledgerAccountCode: '1130-UNIPIN',
    },
  ]);

  // Initial State: Payouts
  const [payouts, setPayouts] = useState<PayoutItem[]>([
    {
      id: 'pay-001',
      payoutNumber: 'PAY-20261010-001',
      userId: 'user-agent-001',
      userName: 'مركز الأسطورة للشحن (وكيل معتمد)',
      amount: 150000,
      currency: 'YER',
      channelCode: 'JAIB',
      beneficiaryAccount: '779900112',
      beneficiaryName: 'عبدالرحمن العريقي',
      status: 'PROCESSING',
      mode: 'MANUAL',
      notes: 'تم حجز رصيد المحفظة وتمرير أمر الحوالة للمسؤول المالي (BLOCKED_EXTERNAL Safe SOP)',
      createdAt: '2026-10-10T11:20:00Z',
    },
    {
      id: 'pay-002',
      payoutNumber: 'PAY-20261009-089',
      userId: 'user-agent-002',
      userName: 'شبكة الصقر للتوزيع',
      amount: 400000,
      currency: 'YER',
      channelCode: 'JAWALI',
      beneficiaryAccount: '773344556',
      beneficiaryName: 'هاني السعيدي',
      status: 'CONFIRMED',
      mode: 'MANUAL',
      externalReference: 'JW-OUT-7788192',
      ledgerTxId: 'LTX-PAYOUT-0089',
      notes: 'تم تنفيذ الحوالة البنكية وإبراء الذمة المحاسبية في دفتر الأستاذ العام.',
      createdAt: '2026-10-09T16:45:00Z',
    },
  ]);

  // Actions
  const handleSwitchChannelMode = () => {
    if (!activeChannelToEdit) return;
    setChannels((prev) =>
      prev.map((c) => (c.code === activeChannelToEdit.code ? { ...c, mode: newChannelMode } : c)),
    );
    setIsSwitchModeModalOpen(false);
    setAlertMessage(`تم تعديل وضع القناة [${activeChannelToEdit.name}] إلى (${newChannelMode}) بنجاح وبشكل آمن.`);
    setTimeout(() => setAlertMessage(null), 5000);
  };

  const handleResolveDiscrepancy = () => {
    if (!activeDiscrepancyToResolve) return;
    setDiscrepancies((prev) =>
      prev.map((d) =>
        d.id === activeDiscrepancyToResolve.id
          ? {
              ...d,
              status: 'RESOLVED',
              resolutionType,
              resolutionNotes,
            }
          : d,
      ),
    );
    setIsResolveDiscrepancyModalOpen(false);
    setAlertMessage(
      `تمت معالجة الاستثناء (${activeDiscrepancyToResolve.externalReference}) بنجاح وتسجيل القيد التسويوي (${resolutionType}).`,
    );
    setTimeout(() => setAlertMessage(null), 5000);
  };

  const handleFundSupplier = () => {
    if (!activeSupplierToFund) return;
    const amountNum = parseFloat(fundingAmount);
    setSuppliers((prev) =>
      prev.map((s) =>
        s.id === activeSupplierToFund.id
          ? {
              ...s,
              balance: s.balance + amountNum,
              status: 'ACTIVE',
              lastFundedAt: new Date().toISOString(),
              lastFundedAmount: amountNum,
            }
          : s,
      ),
    );
    setIsFundSupplierModalOpen(false);
    setAlertMessage(
      `تم تسجيل حركة تغذية الرصيد التجاري للمزود [${activeSupplierToFund.providerName}] بمبلغ $${amountNum} USD وتسجيل حركة الأصول في دفتر الأستاذ العام (Cash Movement: Bank ↔ Prepaid Asset).`,
    );
    setTimeout(() => setAlertMessage(null), 6000);
  };

  const handleRunBatch = () => {
    const newBatchNum = `REC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-00${batches.length + 1}`;
    const newBatch: ReconciliationBatch = {
      id: `rb-${Date.now()}`,
      batchNumber: newBatchNum,
      channelCode: selectedChannel === 'ALL' ? 'JAIB' : selectedChannel,
      periodStart: new Date(Date.now() - 86400000).toISOString(),
      periodEnd: new Date().toISOString(),
      totalItems: 54,
      matchedItems: 54,
      discrepanciesCount: 0,
      totalBankAmount: 3120000,
      totalInternalAmount: 3120000,
      netDifference: 0,
      currency: 'YER',
      status: 'BALANCED',
      reconciledAt: new Date().toISOString(),
      reconciledBy: 'المدير العام (Super Admin)',
    };
    setBatches([newBatch, ...batches]);
    setIsRunBatchModalOpen(false);
    setAlertMessage(`تم تنفيذ دفعة التسوية الثلاثية (${newBatchNum}) بنجاح. كافة القيود متطابقة ومتوازنة.`);
    setTimeout(() => setAlertMessage(null), 5000);
  };

  // Filtered Lists
  const filteredDiscrepancies = discrepancies.filter((d) => {
    const matchChannel = selectedChannel === 'ALL' || d.channelCode === selectedChannel;
    const matchSearch =
      d.externalReference.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.internalReference && d.internalReference.toLowerCase().includes(searchQuery.toLowerCase())) ||
      d.batchNumber.toLowerCase().includes(searchQuery.toLowerCase());
    return matchChannel && matchSearch;
  });

  return (
    <div className="space-y-6 pb-12 text-right">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Phase P05: Payment Automation & 3-Way Reconciliation
            </span>
            <span className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-slate-800 text-slate-300">
              Double-Entry Strictly Enforced
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Scale className="w-6 h-6 text-indigo-400" />
            التسوية والمطابقة المالية وأتمتة المدفوعات
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            نظام المطابقة الثلاثية الآلي (البنك ↔ الإيداعات/السحوبات ↔ تكاليف الشحن ↔ دفتر الأستاذ العام)، وإدارة قنوات الدفع والأرصدة التجارية للمزودين
          </p>
        </div>

        {/* Global Quick Action */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsRunBatchModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition shadow-lg shadow-indigo-600/20"
          >
            <RefreshCw className="w-4 h-4" />
            تشغيل دفعة مطابقة يومية (Run 3-Way Batch)
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      {alertMessage && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <span>{alertMessage}</span>
        </div>
      )}

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">معدل المطابقة الآلية الثلاثية</span>
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white">98.9%</div>
          <div className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
            <span>99 من أصل 100 حركة طابقت تلقائياً</span>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">الفروقات والاستثناءات النشطة</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400">
            {discrepancies.filter((d) => d.status === 'OPEN').length} حالة
          </div>
          <div className="text-xs text-slate-400 mt-1">
            <span>تتطلب مراجعة مالية وتعديل قيد</span>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">الرصيد التجاري المسبق (USD)</span>
            <Wallet className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            ${suppliers.reduce((acc, s) => acc + (s.currency === 'USD' ? s.balance : 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>بوابة الشحن آمنة (Fulfillment Unblocked)</span>
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">وضع قنوات الدفع (Safe Mode)</span>
            <Sliders className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {channels.filter((c) => c.mode === 'API').length} آلي / {channels.length} قنوات
          </div>
          <div className="text-xs text-slate-400 mt-1">
            <span>التحويل التلقائي للأفراد محجوب بأمان (BLOCKED_EXTERNAL)</span>
          </div>
        </div>
      </div>

      {/* Legal Accounts & BR-06 Safety Guarantee Card */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">التحقق القانوني لحسابات الاستقبال والامتثال (BR-06 & AR-14)</div>
            <div className="text-xs text-slate-400 mt-0.5">
              كافة حسابات استقبال الأموال مسجلة رسمياً باسم الكيان التجاري المعتمد. لا يتم تداول أي أرقام حسابات وهمية أو شخصية غير مؤكدة.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5" />
            معتمدة بنكياً 100%
          </span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-800 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('batches')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${
            activeTab === 'batches'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
              : 'border-transparent text-slate-400 hover:text-white hover:border-slate-700'
          }`}
        >
          <Layers className="w-4 h-4" />
          دفعات المطابقة اليومية (3-Way Batches)
          <span className="px-2 py-0.5 rounded-full text-xs bg-slate-800 text-slate-300">{batches.length}</span>
        </button>

        <button
          onClick={() => setActiveTab('discrepancies')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${
            activeTab === 'discrepancies'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
              : 'border-transparent text-slate-400 hover:text-white hover:border-slate-700'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          فروقات واستثناءات التسوية (Exceptions Queue)
          {discrepancies.filter((d) => d.status === 'OPEN').length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30">
              {discrepancies.filter((d) => d.status === 'OPEN').length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('channels')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${
            activeTab === 'channels'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
              : 'border-transparent text-slate-400 hover:text-white hover:border-slate-700'
          }`}
        >
          <Sliders className="w-4 h-4" />
          قنوات الدفع ومحولات القدرات (Channel Adapters & Modes)
        </button>

        <button
          onClick={() => setActiveTab('suppliers')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${
            activeTab === 'suppliers'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
              : 'border-transparent text-slate-400 hover:text-white hover:border-slate-700'
          }`}
        >
          <ServerCog className="w-4 h-4" />
          الأرصدة التجارية لمزودي الشحن (Supplier Balances & Gating)
        </button>

        <button
          onClick={() => setActiveTab('payouts')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${
            activeTab === 'payouts'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
              : 'border-transparent text-slate-400 hover:text-white hover:border-slate-700'
          }`}
        >
          <ArrowUpRight className="w-4 h-4" />
          طلبات السحب والتحويل (Outbound Payouts)
        </button>
      </div>

      {/* TAB 1: Batches */}
      {activeTab === 'batches' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <h3 className="font-semibold text-white text-sm">سجل دفعات المطابقة والتسوية الثلاثية</h3>
              </div>
              <span className="text-xs text-slate-400">تطابق الكشوف البنكية مع الحركات الداخلية ودفتر الأستاذ العام</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-800/60 text-slate-400 text-xs font-semibold">
                  <tr>
                    <th className="py-3 px-4">رقم الدفعة</th>
                    <th className="py-3 px-4">قناة الدفع</th>
                    <th className="py-3 px-4">فترة الدفعة</th>
                    <th className="py-3 px-4">إجمالي الحركات</th>
                    <th className="py-3 px-4">المطابقة الآلية</th>
                    <th className="py-3 px-4">المبلغ البنكي</th>
                    <th className="py-3 px-4">المبلغ المسجل داخلياً</th>
                    <th className="py-3 px-4">صافي الفرق</th>
                    <th className="py-3 px-4">الحالة</th>
                    <th className="py-3 px-4">تاريخ المطابقة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {batches.map((batch) => (
                    <tr key={batch.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3.5 px-4 font-mono text-xs text-indigo-300 font-medium">
                        {batch.batchNumber}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-white">
                        {batch.channelCode}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-400 font-mono">
                        {new Date(batch.periodStart).toLocaleDateString('ar-YE')}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs">
                        {batch.totalItems} حركة
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>{batch.matchedItems} ({((batch.matchedItems / batch.totalItems) * 100).toFixed(1)}%)</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-medium text-white">
                        {batch.totalBankAmount.toLocaleString('en-US')} {batch.currency}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-300">
                        {batch.totalInternalAmount.toLocaleString('en-US')} {batch.currency}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs">
                        {batch.netDifference === 0 ? (
                          <span className="text-emerald-400 font-semibold">0 (متطابق)</span>
                        ) : (
                          <span className="text-amber-400 font-semibold">
                            {batch.netDifference > 0 ? `+${batch.netDifference}` : batch.netDifference} {batch.currency}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {batch.status === 'BALANCED' ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            متوازنة (BALANCED)
                          </span>
                        ) : batch.status === 'DISCREPANCY_FOUND' ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            يوجد فروقات ({batch.discrepanciesCount})
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
                            معدلة محاسبياً
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-400">
                        {new Date(batch.reconciledAt).toLocaleString('ar-YE')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Discrepancies & Exceptions Queue */}
      {activeTab === 'discrepancies' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
              <input
                type="text"
                placeholder="بحث برقم المرجع أو الدفعة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pr-9 pl-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={selectedChannel}
                onChange={(e) => setSelectedChannel(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">كافة القنوات</option>
                <option value="JAIB">جيب (JAIB)</option>
                <option value="JAWALI">جوالي (JAWALI)</option>
                <option value="ONE_CASH">ون كاش (ONE_CASH)</option>
              </select>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <h3 className="font-semibold text-white text-sm">قائمة الفروقات والاستثناءات المعلقة (Unknown Deposits & Mismatches)</h3>
              </div>
              <span className="text-xs text-slate-400">أي فارق يوقف الاعتماد التلقائي ويحوّل إلى مسار التدقيق المالي</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-800/60 text-slate-400 text-xs font-semibold">
                  <tr>
                    <th className="py-3 px-4">رقم الدفعة</th>
                    <th className="py-3 px-4">نوع الفرق</th>
                    <th className="py-3 px-4">القناة</th>
                    <th className="py-3 px-4">مرجع البنك الخارجي</th>
                    <th className="py-3 px-4">المرجع الداخلي للنظام</th>
                    <th className="py-3 px-4">مبلغ كشف البنك</th>
                    <th className="py-3 px-4">المبلغ المسجل بالنظام</th>
                    <th className="py-3 px-4">الفارق المالي</th>
                    <th className="py-3 px-4">الحالة</th>
                    <th className="py-3 px-4">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {filteredDiscrepancies.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-500 text-sm">
                        لا توجد فروقات أو استثناءات مطابقة للبحث الحالي.
                      </td>
                    </tr>
                  ) : (
                    filteredDiscrepancies.map((disc) => (
                      <tr key={disc.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-400">
                          {disc.batchNumber}
                        </td>
                        <td className="py-3.5 px-4">
                          {disc.discrepancyType === 'AMOUNT_MISMATCH' ? (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/20">
                              اختلاف في المبلغ
                            </span>
                          ) : disc.discrepancyType === 'MISSING_IN_INTERNAL' ? (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-rose-500/15 text-rose-400 border border-rose-500/20">
                              مفقود في النظام (Unknown Deposit)
                            </span>
                          ) : disc.discrepancyType === 'MISSING_IN_BANK' ? (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-500/15 text-purple-400 border border-purple-500/20">
                              غير مقيد في البنك
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-500/15 text-orange-400 border border-orange-500/20">
                              اختلاف في العملة
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-white">
                          {disc.channelCode}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-indigo-300">
                          {disc.externalReference}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-400">
                          {disc.internalReference || '—'}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-medium text-white">
                          {disc.bankAmount.toLocaleString('en-US')} {disc.currency}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-300">
                          {disc.internalAmount.toLocaleString('en-US')} {disc.currency}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-amber-400">
                          {disc.difference > 0 ? `+${disc.difference}` : disc.difference} {disc.currency}
                        </td>
                        <td className="py-3.5 px-4">
                          {disc.status === 'OPEN' ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              قيد المراجعة
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              تمت المعالجة
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {disc.status === 'OPEN' ? (
                            <button
                              onClick={() => {
                                setActiveDiscrepancyToResolve(disc);
                                setIsResolveDiscrepancyModalOpen(true);
                              }}
                              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium transition"
                            >
                              معالجة الاستثناء
                            </button>
                          ) : (
                            <span className="text-xs text-slate-500">تم القيد</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Payment Channel Adapters & Capabilities */}
      {activeTab === 'channels' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white text-sm">محولات قنوات الدفع (PaymentChannelAdapter Capabilities)</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  إدارة محددات القدرات (Flags) وأوضاع الأمان: API آلي، أو MANUAL مع رفع سند، أو BLOCKED_EXTERNAL
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-800/60 text-slate-400 text-xs font-semibold">
                  <tr>
                    <th className="py-3 px-4">القناة</th>
                    <th className="py-3 px-4">الوضع الحالي</th>
                    <th className="py-3 px-4">قدرات المحول (Capabilities)</th>
                    <th className="py-3 px-4">رقم حساب الاستقبال الرسمي</th>
                    <th className="py-3 px-4">الحد الأدنى / الأقصى</th>
                    <th className="py-3 px-4">الحد اليومي</th>
                    <th className="py-3 px-4">الامتثال القانوني</th>
                    <th className="py-3 px-4">التحكم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {channels.map((chan) => (
                    <tr key={chan.code} className="hover:bg-slate-800/30 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white">{chan.name}</div>
                        <div className="text-xs font-mono text-slate-500">{chan.code}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        {chan.mode === 'API' ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            API (ربط آلي نشط)
                          </span>
                        ) : chan.mode === 'MANUAL' ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            MANUAL (سند + تدقيق)
                          </span>
                        ) : chan.mode === 'BLOCKED_EXTERNAL' ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/30">
                            BLOCKED_EXTERNAL
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                            معطلة (DISABLED)
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                              chan.capabilities.depositConfirm
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                                : 'bg-slate-800 text-slate-500'
                            }`}
                          >
                            depositConfirm
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                              chan.capabilities.transactionLookup
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                                : 'bg-slate-800 text-slate-500'
                            }`}
                          >
                            txLookup
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                              chan.capabilities.payout
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                                : 'bg-slate-800 text-slate-500'
                            }`}
                          >
                            payout
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                              chan.capabilities.balance
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                                : 'bg-slate-800 text-slate-500'
                            }`}
                          >
                            balance
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                              chan.capabilities.reconcile
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                                : 'bg-slate-800 text-slate-500'
                            }`}
                          >
                            reconcile
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-mono text-xs text-white">{chan.accountNumber}</div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[150px]">{chan.accountHolder}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-300">
                        {chan.minAmount.toLocaleString()} - {chan.maxAmount.toLocaleString()} {chan.currency}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-300">
                        {chan.dailyVolume.toLocaleString()} / {chan.dailyLimit.toLocaleString()} {chan.currency}
                      </td>
                      <td className="py-3.5 px-4">
                        {chan.isLegalVerified ? (
                          <span className="flex items-center gap-1 text-xs text-emerald-400">
                            <CheckCircle className="w-3.5 h-3.5" />
                            مؤكد قانونياً
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-amber-400">
                            <AlertCircle className="w-3.5 h-3.5" />
                            غير مؤكد
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => {
                            setActiveChannelToEdit(chan);
                            setNewChannelMode(chan.mode);
                            setIsSwitchModeModalOpen(true);
                          }}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs font-medium transition"
                        >
                          تغيير الوضع
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Supplier Balances & Fulfillment Gating */}
      {activeTab === 'suppliers' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white text-sm">أرصدة مزودي الشحن والتحكم ببوابة الشحن (Supplier Balance & Gating)</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  التحقق من كفاية الرصيد التجاري قبل إرسال أمر الشحن. تفرقة كاملة بين تكلفة الشحن وحركة الأموال (Asset ↔ Asset).
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-800/60 text-slate-400 text-xs font-semibold">
                  <tr>
                    <th className="py-3 px-4">المزود</th>
                    <th className="py-3 px-4">طبيعة الحساب</th>
                    <th className="py-3 px-4">الرصيد الحالي</th>
                    <th className="py-3 px-4">الحد الائتماني</th>
                    <th className="py-3 px-4">حد التنبيه المنخفض</th>
                    <th className="py-3 px-4">حساب الأستاذ العام</th>
                    <th className="py-3 px-4">حالة بوابة الشحن</th>
                    <th className="py-3 px-4">آخر تغذية</th>
                    <th className="py-3 px-4">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {suppliers.map((sup) => (
                    <tr key={sup.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3.5 px-4 font-semibold text-white">
                        <div>{sup.providerName}</div>
                        <div className="text-xs font-mono text-slate-500">{sup.providerCode}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded text-xs font-mono bg-slate-800 text-slate-300">
                          {sup.accountType === 'PREPAID' ? 'مسبق الدفع (Prepaid)' : 'دفع لكل طلب (Pay-Per-Order)'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-base text-white">
                        ${sup.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })} {sup.currency}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-400">
                        ${sup.creditLimit.toLocaleString('en-US')} {sup.currency}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-400">
                        ${sup.lowBalanceThreshold.toLocaleString('en-US')} {sup.currency}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-indigo-400">
                        {sup.ledgerAccountCode}
                      </td>
                      <td className="py-3.5 px-4">
                        {sup.status === 'ACTIVE' ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            جاهز للشحن (Unblocked)
                          </span>
                        ) : sup.status === 'LOW_BALANCE' ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            رصيد منخفض (تحذير)
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            معلق (Gated / Blocked)
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-400">
                        {sup.lastFundedAt ? (
                          <div>
                            <div>{new Date(sup.lastFundedAt).toLocaleDateString('ar-YE')}</div>
                            <div className="font-mono text-[11px] text-emerald-400">+${sup.lastFundedAmount}</div>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => {
                            setActiveSupplierToFund(sup);
                            setIsFundSupplierModalOpen(true);
                          }}
                          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium transition"
                        >
                          تغذية الرصيد
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: Outbound Payouts */}
      {activeTab === 'payouts' && (
        <div className="space-y-4">
          <div className="bg-slate-900/60 border border-purple-500/20 rounded-xl p-4 flex items-start gap-3">
            <Lock className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-purple-200">
                بروتوكول التحويلات الخارجية وأمان السحب (BLOCKED_EXTERNAL)
              </div>
              <div className="text-xs text-purple-300/80 mt-1 leading-relaxed">
                وفقاً لمتطلبات المرحلة P05 ومحددات الأمان المصرفي اليمني، فإن التحويلات الآلية المباشرة غير المعتمدة رسمياً بشهادات ثنائية تظل موسومة <code className="bg-purple-950 px-1 py-0.5 rounded text-purple-200 font-mono">BLOCKED_EXTERNAL</code> مع إبقاء إجراءات التحويل اليدوي الصارم (Manual Wire SOP): يتم حجز الرصيد فوراً في المحفظة، وتنفيذ الحوالة بواسطة المسؤول المالي، وإبراء الذمة في دفتر الأستاذ العام بموجب السند المؤكد.
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-semibold text-white text-sm">سجل طلبات السحب والتحويل (Payout Orders)</h3>
              <span className="text-xs text-slate-400">تتبع حجز المحفظة والتسوية المحاسبية المقابلة</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-800/60 text-slate-400 text-xs font-semibold">
                  <tr>
                    <th className="py-3 px-4">رقم الطلب</th>
                    <th className="py-3 px-4">المستفيد</th>
                    <th className="py-3 px-4">المبلغ</th>
                    <th className="py-3 px-4">قناة التحويل</th>
                    <th className="py-3 px-4">رقم حساب المستفيد</th>
                    <th className="py-3 px-4">الحالة</th>
                    <th className="py-3 px-4">المرجع البنكي</th>
                    <th className="py-3 px-4">تاريخ الطلب</th>
                    <th className="py-3 px-4">ملاحظات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {payouts.map((pay) => (
                    <tr key={pay.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3.5 px-4 font-mono text-xs text-indigo-300 font-medium">
                        {pay.payoutNumber}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white">{pay.userName}</div>
                        <div className="text-xs text-slate-400">{pay.beneficiaryName}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-white">
                        {pay.amount.toLocaleString()} {pay.currency}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-200">
                        {pay.channelCode}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-300">
                        {pay.beneficiaryAccount}
                      </td>
                      <td className="py-3.5 px-4">
                        {pay.status === 'CONFIRMED' ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            تم التحويل والتسوية
                          </span>
                        ) : pay.status === 'PROCESSING' ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
                            قيد التنفيذ اليدوي
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            {pay.status}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-400">
                        {pay.externalReference || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-400">
                        {new Date(pay.createdAt).toLocaleDateString('ar-YE')}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-400 max-w-xs truncate">
                        {pay.notes}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Run 3-Way Batch */}
      {isRunBatchModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 text-right space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-indigo-400" />
                تشغيل دفعة مطابقة يومية (Reconciliation Batch)
              </h3>
              <button
                onClick={() => setIsRunBatchModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">اختر قناة الدفع</label>
                <select
                  value={selectedChannel}
                  onChange={(e) => setSelectedChannel(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="ALL">كافة القنوات مجتمعة</option>
                  <option value="JAIB">جيب (JAIB)</option>
                  <option value="JAWALI">جوالي (JAWALI)</option>
                  <option value="ONE_CASH">ون كاش (ONE_CASH)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">فترة المطابقة</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    defaultValue="2026-10-09"
                    className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-xs"
                  />
                  <input
                    type="date"
                    defaultValue="2026-10-10"
                    className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-xs"
                  />
                </div>
              </div>

              <div className="bg-indigo-950/30 border border-indigo-500/20 p-3 rounded-xl text-xs text-indigo-300">
                سيقوم النظام بمقارنة الكشوف البنكية المسحوبة تلقائياً مع طلبات الإيداع والسحب وحركات دفتر الأستاذ العام وتوليد تقرير الفروقات.
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsRunBatchModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition"
              >
                إلغاء
              </button>
              <button
                onClick={handleRunBatch}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold transition shadow-lg shadow-indigo-600/30"
              >
                بدء المطابقة الآن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Switch Channel Mode */}
      {isSwitchModeModalOpen && activeChannelToEdit && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 text-right space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-indigo-400" />
                تعديل وضع القناة: {activeChannelToEdit.name}
              </h3>
              <button
                onClick={() => setIsSwitchModeModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">الوضع التشغيلي (Channel Mode)</label>
                <select
                  value={newChannelMode}
                  onChange={(e: any) => setNewChannelMode(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="API">API — اعتماد آلي للويب هوك والعمليات</option>
                  <option value="MANUAL">MANUAL — تدقيق يدوي ورفع سند ورقي إجباري</option>
                  <option value="BLOCKED_EXTERNAL">BLOCKED_EXTERNAL — محجوب لعدم اكتمال التوثيق الرسمي</option>
                  <option value="DISABLED">DISABLED — معطل كلياً لأسباب أمنية</option>
                </select>
              </div>

              <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/20 text-xs text-amber-300">
                ملاحظة أمنية: في حال وجود أي انقطاع بالشبكة أو خلل في التحقق، يتحول المحول آلياً إلى وضع MANUAL لمنع أي خسائر مالية.
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsSwitchModeModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition"
              >
                إلغاء
              </button>
              <button
                onClick={handleSwitchChannelMode}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold transition"
              >
                حفظ التعديل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Resolve Discrepancy */}
      {isResolveDiscrepancyModalOpen && activeDiscrepancyToResolve && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 text-right space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                معالجة استثناء المطابقة ({activeDiscrepancyToResolve.externalReference})
              </h3>
              <button
                onClick={() => setIsResolveDiscrepancyModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="p-3 bg-slate-800/80 rounded-xl space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">المبلغ في كشف البنك:</span>
                  <span className="font-mono text-white font-semibold">
                    {activeDiscrepancyToResolve.bankAmount} {activeDiscrepancyToResolve.currency}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">المبلغ المقيد بالنظام:</span>
                  <span className="font-mono text-white font-semibold">
                    {activeDiscrepancyToResolve.internalAmount} {activeDiscrepancyToResolve.currency}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-700 pt-1 text-amber-400 font-bold">
                  <span>الفارق المحاسبي:</span>
                  <span className="font-mono">
                    {activeDiscrepancyToResolve.difference} {activeDiscrepancyToResolve.currency}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">نوع المعالجة المحاسبية</label>
                <select
                  value={resolutionType}
                  onChange={(e) => setResolutionType(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="ADJUST_LEDGER">قيد تسوية أستاذ عام (Adjust General Ledger)</option>
                  <option value="FORCE_MATCH">مطابقة إجبارية بعد التدقيق البنكي (Force Match)</option>
                  <option value="REJECT_EXTERNAL">رفض المعاملة وإعادتها للمرسل (Reject & Return)</option>
                  <option value="DISPUTE_RAISED">رفع نزاع رسمي مع البنك (Bank Dispute)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">ملاحظات وقرار المعالجة المالية</label>
                <textarea
                  rows={3}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="اكتب تفاصيل القرار المحاسبي والمستند المعزز..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsResolveDiscrepancyModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition"
              >
                إلغاء
              </button>
              <button
                onClick={handleResolveDiscrepancy}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold transition"
              >
                تأكيد وتسجيل القيد
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Fund Supplier Balance */}
      {isFundSupplierModalOpen && activeSupplierToFund && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 text-right space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Wallet className="w-5 h-5 text-indigo-400" />
                تغذية الرصيد التجاري: {activeSupplierToFund.providerName}
              </h3>
              <button
                onClick={() => setIsFundSupplierModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">المبلغ المراد شحنه (USD)</label>
                <input
                  type="number"
                  value={fundingAmount}
                  onChange={(e) => setFundingAmount(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">المرجع البنكي للتحويل الصادر</label>
                <input
                  type="text"
                  value={fundingBankRef}
                  onChange={(e) => setFundingBankRef(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-500/20 text-xs text-indigo-300">
                سيقوم النظام بإنشاء قيد محاسبي مزدوج ومتوازن فوراً (Cash Movement: Asset ↔ Asset):
                <div className="mt-1 font-mono text-[11px] text-indigo-200">
                  مدين: أصول متداولة / أرصدة مزودين ({activeSupplierToFund.ledgerAccountCode})
                  <br />
                  دائن: أصول متداولة / نقدية وبنوك (1110-CASH)
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsFundSupplierModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition"
              >
                إلغاء
              </button>
              <button
                onClick={handleFundSupplier}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold transition"
              >
                تأكيد التغذية وقيد الأستاذ العام
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
