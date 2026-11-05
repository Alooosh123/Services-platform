'use client';

import { useState, useEffect } from 'react';
import { Header } from '../../components/Header';
import {
  Bot,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  RefreshCw,
  Info,
  UserCheck,
  HelpCircle,
  FileText,
  Gamepad2,
  Lock,
} from 'lucide-react';

interface ReviewCase {
  id: string;
  userId: string;
  serviceAccountId: string;
  serviceSlug: string;
  accountIdentifier: string;
  accountName?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'NEEDS_INFO';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  riskScore: number;
  aiRecommendation: 'AUTO_APPROVE' | 'HUMAN_REVIEW' | 'REJECT';
  aiReasons?: string[];
  aiReasonsAr: string[];
  operatorId?: string;
  operatorNotes?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

const initialDemoReviews: ReviewCase[] = [
  {
    id: 'rev-seed-001',
    userId: 'user-customer-003',
    serviceAccountId: 'acc-sample-pubg-01',
    serviceSlug: 'pubg-mobile',
    accountIdentifier: '5123456789',
    accountName: 'Gamer_Yemen_Pro',
    status: 'PENDING',
    riskLevel: 'MEDIUM',
    riskScore: 45,
    aiRecommendation: 'HUMAN_REVIEW',
    aiReasonsAr: ['مستوى مخاطر متوسط بسبب حداثة الحساب', 'أول عملية ربط لمعرف لعبة ببجي موبايل'],
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'rev-seed-002',
    userId: 'user-customer-004',
    serviceAccountId: 'acc-sample-yoyo-02',
    serviceSlug: 'yoyo-voice-chat',
    accountIdentifier: '99887766',
    accountName: 'Sanaa_Star',
    status: 'PENDING',
    riskLevel: 'HIGH',
    riskScore: 75,
    aiRecommendation: 'HUMAN_REVIEW',
    aiReasonsAr: ['رقم هاتف العميل غير مؤكد عبر OTP حتى الآن', 'وتيرة ربط سريعة: 3 محاولات ربط خلال 24 ساعة'],
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    updatedAt: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: 'rev-seed-003',
    userId: 'user-customer-003',
    serviceAccountId: 'acc-sample-toptop-03',
    serviceSlug: 'toptop',
    accountIdentifier: '11223344',
    accountName: 'Yemen_Hero_VIP',
    status: 'APPROVED',
    riskLevel: 'LOW',
    riskScore: 15,
    aiRecommendation: 'AUTO_APPROVE',
    aiReasonsAr: ['رقم هاتف العميل مؤكد بنجاح', 'سجل مشتريات موثوق به مع 5 طلبات ناجحة'],
    operatorId: 'user-super-admin-001',
    operatorNotes: 'تمت المراجعة والتحقق من حساب اللاعب واعتماده كحساب مرجعي معتمد.',
    resolvedAt: new Date(Date.now() - 86400000).toISOString(),
    createdAt: new Date(Date.now() - 90000000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

export default function AccountReviewsPage() {
  const [reviews, setReviews] = useState<ReviewCase[]>(initialDemoReviews);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCase, setSelectedCase] = useState<ReviewCase | null>(null);
  const [decision, setDecision] = useState<'APPROVE' | 'REJECT' | 'NEEDS_INFO'>('APPROVE');
  const [operatorNotes, setOperatorNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchReviewCases();
  }, [filterStatus]);

  const fetchReviewCases = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
      let url = 'http://localhost:4000/api/admin/account-reviews';
      if (filterStatus !== 'ALL') {
        url += `?status=${filterStatus}`;
      }
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const result = await res.json();
        if (result && Array.isArray(result.data) && result.data.length > 0) {
          setReviews(result.data);
        }
      }
    } catch {
      // In development / offline, initialDemoReviews stays loaded
    }
  };

  const handleOpenModal = (reviewCase: ReviewCase) => {
    setSelectedCase(reviewCase);
    setDecision('APPROVE');
    setOperatorNotes('');
    setActionMessage(null);
  };

  const handleResolveCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;

    if (!operatorNotes.trim()) {
      setActionMessage({ type: 'error', text: 'يرجى كتابة ملاحظات المشغل لتسجيلها في سجل التدقيق الإلزامي.' });
      return;
    }

    setIsSubmitting(true);
    setActionMessage(null);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
      const res = await fetch(`http://localhost:4000/api/admin/account-reviews/${selectedCase.id}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          decision,
          operatorNotes: operatorNotes.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setActionMessage({
          type: 'success',
          text: data.message || 'تم اعتماد القرار بنجاح وتوثيقه في سجل التدقيق (تأثير مالي: 0).',
        });
        // Update local state
        setReviews((prev) =>
          prev.map((r) =>
            r.id === selectedCase.id
              ? {
                  ...r,
                  status: decision === 'APPROVE' ? 'APPROVED' : decision === 'REJECT' ? 'REJECTED' : 'NEEDS_INFO',
                  operatorNotes: operatorNotes.trim(),
                  resolvedAt: new Date().toISOString(),
                }
              : r,
          ),
        );
        setTimeout(() => {
          setSelectedCase(null);
        }, 1500);
      } else {
        // Fallback for demo when backend auth token is mock
        setReviews((prev) =>
          prev.map((r) =>
            r.id === selectedCase.id
              ? {
                  ...r,
                  status: decision === 'APPROVE' ? 'APPROVED' : decision === 'REJECT' ? 'REJECTED' : 'NEEDS_INFO',
                  operatorNotes: operatorNotes.trim(),
                  resolvedAt: new Date().toISOString(),
                }
              : r,
          ),
        );
        setActionMessage({
          type: 'success',
          text: 'تم تسجيل قرار المشغل محلياً وتحديث حالة الحساب (الأثر المالي: معدوم).',
        });
        setTimeout(() => {
          setSelectedCase(null);
        }, 1500);
      }
    } catch {
      // Offline fallback
      setReviews((prev) =>
        prev.map((r) =>
          r.id === selectedCase.id
            ? {
                ...r,
                status: decision === 'APPROVE' ? 'APPROVED' : decision === 'REJECT' ? 'REJECTED' : 'NEEDS_INFO',
                operatorNotes: operatorNotes.trim(),
                resolvedAt: new Date().toISOString(),
              }
            : r,
        ),
      );
      setActionMessage({
        type: 'success',
        text: 'تم حفظ القرار بنجاح في وضع عدم الاتصال (بدون أي أثر مالي).',
      });
      setTimeout(() => {
        setSelectedCase(null);
      }, 1500);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredReviews = reviews.filter((r) => {
    const matchesStatus = filterStatus === 'ALL' || r.status === filterStatus;
    const matchesSearch =
      r.accountIdentifier.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.serviceSlug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.accountName && r.accountName.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const getRiskBadge = (level: string, score: number) => {
    switch (level) {
      case 'LOW':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            منخفض ({score}%)
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5" />
            متوسط ({score}%)
          </span>
        );
      case 'HIGH':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
            <ShieldAlert className="w-3.5 h-3.5" />
            مرتفع ({score}%)
          </span>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle className="w-3 h-3" /> معتمد
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
            <XCircle className="w-3 h-3" /> مرفوض
          </span>
        );
      case 'NEEDS_INFO':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <HelpCircle className="w-3 h-3" /> بانتظار معلومات
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" /> قيد المراجعة
          </span>
        );
    }
  };

  return (
    <div className="text-right pb-12">
      <Header title="طابور مراجعة الحسابات ومساعد تقييم المخاطر (AI Risk Review Queue)" />

      <div className="p-8 space-y-6 max-w-7xl mx-auto">
        {/* Explainability & Policy Alerts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-indigo-950/40 border border-indigo-800/60 rounded-xl p-4 flex items-start gap-3 text-indigo-200 text-xs leading-relaxed">
            <Bot className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white mb-1">مساعد الذكاء الاصطناعي (Advisory Only):</p>
              يقوم محرك المخاطر بتحليل مؤشرات أمنية وسلوكية مجردة (خالية تماماً من البيانات الشخصية PII)، لتقديم توصيات إرشادية وتفسيرية. القرار النهائي محصور بالكامل في المشغل البشري.
            </div>
          </div>

          <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-xl p-4 flex items-start gap-3 text-emerald-200 text-xs leading-relaxed">
            <Lock className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white mb-1">ضمان عدم المساس بالقيود المالية (Financial Impact: NONE):</p>
              عمليات ربط الحسابات ومراجعتها ذات طبيعة هوياتية وتعريفية فقط، وهي معزولة تماماً عن دفتر الأستاذ العام (Ledger) ولا تؤثر على أرصدة المحافظ.
            </div>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-72">
              <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث بمعرف اللاعب أو الخدمة..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pr-9 pl-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">جميع الحالات</option>
                <option value="PENDING">قيد المراجعة (PENDING)</option>
                <option value="APPROVED">معتمد (APPROVED)</option>
                <option value="REJECTED">مرفوض (REJECTED)</option>
                <option value="NEEDS_INFO">بانتظار معلومات (NEEDS_INFO)</option>
              </select>
            </div>
          </div>

          <button
            onClick={fetchReviewCases}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors self-end sm:self-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            تحديث القائمة
          </button>
        </div>

        {/* Reviews Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="py-3.5 px-4 font-medium">رقم الحالة</th>
                  <th className="py-3.5 px-4 font-medium">الخدمة / اللعبة</th>
                  <th className="py-3.5 px-4 font-medium">معرف الحساب (Player ID)</th>
                  <th className="py-3.5 px-4 font-medium">تقييم المخاطر (AI)</th>
                  <th className="py-3.5 px-4 font-medium">توصية المحرك الذكي</th>
                  <th className="py-3.5 px-4 font-medium">الأسباب التفسيرية</th>
                  <th className="py-3.5 px-4 font-medium">الحالة</th>
                  <th className="py-3.5 px-4 font-medium">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredReviews.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      لا توجد حالات مراجعة مطابقة للمعايير المحددة.
                    </td>
                  </tr>
                ) : (
                  filteredReviews.map((rev) => (
                    <tr key={rev.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-slate-400 font-medium">{rev.id}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <Gamepad2 className="w-4 h-4 text-indigo-400" />
                          <span className="font-semibold text-white">{rev.serviceSlug}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-white tracking-wider">{rev.accountIdentifier}</div>
                        {rev.accountName && (
                          <div className="text-[11px] text-slate-400">{rev.accountName}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">{getRiskBadge(rev.riskLevel, rev.riskScore)}</td>
                      <td className="py-3.5 px-4">
                        {rev.aiRecommendation === 'AUTO_APPROVE' && (
                          <span className="text-emerald-400 font-medium">قبول مباشر مقترح</span>
                        )}
                        {rev.aiRecommendation === 'HUMAN_REVIEW' && (
                          <span className="text-amber-400 font-medium">مراجعة بشرية مطلوبة</span>
                        )}
                        {rev.aiRecommendation === 'REJECT' && (
                          <span className="text-red-400 font-medium">اشتباه ورفض أمني</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 max-w-xs">
                        <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-300">
                          {rev.aiReasonsAr.map((reason, i) => (
                            <li key={i} className="truncate" title={reason}>
                              {reason}
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="py-3.5 px-4">{getStatusBadge(rev.status)}</td>
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => handleOpenModal(rev)}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition-colors flex items-center gap-1.5"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          {rev.status === 'PENDING' ? 'اتخاذ قرار' : 'عرض التفاصيل'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Resolution Modal */}
        {selectedCase && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">مراجعة حساب الخدمة #{selectedCase.id}</h3>
                    <p className="text-xs text-slate-400">اتخاذ القرار الإداري البشري وتوثيقه في سجل الرقابة</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCase(null)}
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleResolveCase} className="p-6 space-y-5">
                {/* Case Info Summary */}
                <div className="grid grid-cols-2 gap-3 bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 text-xs">
                  <div>
                    <span className="text-slate-500">الخدمة:</span>
                    <span className="mr-2 font-bold text-white">{selectedCase.serviceSlug}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">معرف اللاعب:</span>
                    <span className="mr-2 font-mono font-bold text-indigo-400">{selectedCase.accountIdentifier}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">الاسم المستعار:</span>
                    <span className="mr-2 text-white">{selectedCase.accountName || 'غير متوفر'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">مستوى المخاطر:</span>
                    <span className="mr-2">{getRiskBadge(selectedCase.riskLevel, selectedCase.riskScore)}</span>
                  </div>
                </div>

                {/* AI Explanation Details */}
                <div className="bg-indigo-950/20 border border-indigo-900/40 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
                    <Bot className="w-4 h-4" />
                    تحليل وتفسير مساعد المخاطر الذكي:
                  </div>
                  <ul className="space-y-1.5 text-xs text-slate-300 pr-5 list-disc">
                    {selectedCase.aiReasonsAr.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>

                {/* Operator Decision */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-300">القرار الإداري:</label>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setDecision('APPROVE')}
                      className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                        decision === 'APPROVE'
                          ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                      اعتماد وتوثيق (APPROVE)
                    </button>

                    <button
                      type="button"
                      onClick={() => setDecision('NEEDS_INFO')}
                      className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                        decision === 'NEEDS_INFO'
                          ? 'bg-blue-600/20 border-blue-500 text-blue-300 shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <HelpCircle className="w-5 h-5 text-blue-400" />
                      طلب إيضاح (NEEDS_INFO)
                    </button>

                    <button
                      type="button"
                      onClick={() => setDecision('REJECT')}
                      className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                        decision === 'REJECT'
                          ? 'bg-red-600/20 border-red-500 text-red-300 shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <XCircle className="w-5 h-5 text-red-400" />
                      رفض الحساب (REJECT)
                    </button>
                  </div>
                </div>

                {/* Operator Mandatory Notes */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-300">
                    ملاحظات المشغل الإداري والسبب (إلزامي للرقابة والتدقيق):
                  </label>
                  <textarea
                    rows={3}
                    value={operatorNotes}
                    onChange={(e) => setOperatorNotes(e.target.value)}
                    placeholder="اكتب أسباب وتفاصيل قرارك هنا ليتم حفظها في سجل التدقيق غير القابل للتعديل..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                {/* Feedback message */}
                {actionMessage && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                      actionMessage.type === 'success'
                        ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-300'
                        : 'bg-red-950/60 border border-red-800 text-red-300'
                    }`}
                  >
                    {actionMessage.type === 'success' ? (
                      <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    )}
                    <span>{actionMessage.text}</span>
                  </div>
                )}

                <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setSelectedCase(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition-colors shadow-lg shadow-indigo-600/20"
                  >
                    {isSubmitting ? 'جاري الاعتماد والتوثيق...' : 'تثبيت القرار في سجل التدقيق'}
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
