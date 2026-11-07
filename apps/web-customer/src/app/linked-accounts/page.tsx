'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Gamepad2,
  Shield,
  ShieldCheck,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  Info,
} from 'lucide-react';
import { apiRequest, getCustomerToken } from '../../lib/api';

interface ServiceAccount {
  id: string;
  serviceSlug: string;
  serviceName: string;
  serviceNameAr: string;
  accountIdentifier: string;
  accountName?: string;
  serverZoneId?: string;
  status: string;
  verificationSource?: string;
  lastVerifiedAt?: string;
}

export default function LinkedAccountsPage() {
  const [accounts, setAccounts] = useState<ServiceAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedService, setSelectedService] = useState('pubg-mobile');
  const [accountIdentifier, setAccountIdentifier] = useState('');
  const [accountName, setAccountName] = useState('');
  const [consentGranted, setConsentGranted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const fetchAccounts = async () => {
    setLoading(true);
    setError(null);
    if (!getCustomerToken()) {
      setAccounts([]);
      setError('سجّل الدخول لعرض الحسابات المرتبطة.');
      setLoading(false);
      return;
    }

    try {
      const response = await apiRequest<ServiceAccount[] | { data?: ServiceAccount[] }>('/service-accounts');
      const rows = Array.isArray(response) ? response : response.data;
      if (!Array.isArray(rows)) throw new Error('استجابة الحسابات المرتبطة غير صحيحة.');
      setAccounts(rows);
    } catch (err) {
      setAccounts([]);
      setError(err instanceof Error ? err.message : 'تعذر تحميل الحسابات المرتبطة.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consentGranted) {
      setError('يجب الموافقة الصريحة لحفظ الحساب المرجعي');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await apiRequest<{ message?: string }>('/service-accounts', {
        method: 'POST',
        body: JSON.stringify({
          serviceSlug: selectedService,
          accountIdentifier,
          accountName: accountName || undefined,
          consentGranted: true,
          consentScopes: ['READ_ACCOUNT_INFO', 'AUTOPROMPT_CHECKOUT'],
        }),
      });

      setActionMsg(response.message || 'تم حفظ وربط الحساب بنجاح');
      setShowAddModal(false);
      setAccountIdentifier('');
      setAccountName('');
      setConsentGranted(false);
      await fetchAccounts();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ في ربط الحساب');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnlink = async (id: string) => {
    if (!confirm('هل أنت متأكد من إلغاء ربط هذا الحساب وسحب الموافقة؟')) return;

    try {
      const response = await apiRequest<{ message?: string }>(`/service-accounts/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      setActionMsg(response.message || 'تم إلغاء الربط وسحب الموافقة بنجاح.');
      await fetchAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إلغاء ربط الحساب.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Gamepad2 className="w-6 h-6 text-indigo-400" />
            <h1 className="text-2xl font-black text-white">حسابات الألعاب والخدمات المرتبطة</h1>
          </div>
          <p className="text-xs text-slate-400">
            إدارة المعرفات المرجعية المحفوظة لتسريع عملية الشراء دون الحاجة لإدخال معرف اللاعب في كل مرة
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-5 py-3 rounded-xl transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>ربط حساب جديد</span>
        </button>
      </div>

      {actionMsg && (
        <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-4 mb-6 text-xs text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{actionMsg}</span>
          </div>
          <button onClick={() => setActionMsg(null)} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* Information Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-8 text-xs text-slate-300 space-y-2">
        <div className="flex items-center gap-2 font-bold text-indigo-400">
          <Info className="w-4 h-4" />
          <span>طبيعة الربط وحماية الخصوصية:</span>
        </div>
        <p className="text-slate-400 text-[11px] leading-relaxed">
          حفظ الحساب هو معرّف مرجعي (Reference Only) مسجل بموافقتك لتسريع تعبئة الطلبات. لا تطلب
          المنصة أبداً كلمات مرور ألعابك أو رموز التحقق الخاصة بالناشرين، ولا تملك المنصة صلاحية النقل أو التصرف في حسابك.
        </p>
      </div>

      {/* Accounts List */}
      {loading ? (
        <div className="text-center py-12 text-slate-500 text-sm">جاري تحميل الحسابات...</div>
      ) : accounts.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center">
          <Gamepad2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white mb-1">لا توجد حسابات مرتبطة بعد</h3>
          <p className="text-xs text-slate-400 mb-6">
            قم بربط معرّف حسابك في ببجي موبايل أو توب توب لتعبئة طلباتك بضغطة زر واحدة
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all"
          >
            إضافة أول حساب
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {accounts.map((acc) => (
            <div
              key={acc.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 transition-all shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <span className="text-[11px] font-bold text-indigo-400 block mb-0.5">
                      {acc.serviceNameAr}
                    </span>
                    <h3 className="text-base font-black text-white font-mono">
                      {acc.accountIdentifier}
                    </h3>
                  </div>

                  {acc.status === 'VERIFIED_PROVIDER' ? (
                    <span className="bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      موثق لدى المزود
                    </span>
                  ) : acc.status === 'REFERENCE_ONLY' ? (
                    <span className="bg-amber-950/60 text-amber-300 border border-amber-500/30 text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      معرف مرجعي معتمد
                    </span>
                  ) : (
                    <span className="bg-slate-800 text-slate-400 text-[10px] font-bold px-2.5 py-1 rounded-lg">
                      {acc.status}
                    </span>
                  )}
                </div>

                {acc.accountName && (
                  <div className="text-xs text-slate-300 mb-2">
                    الاسم المسجل: <span className="text-white font-bold">{acc.accountName}</span>
                  </div>
                )}

                <div className="text-[11px] text-slate-500 space-y-0.5">
                  <div>المصدر: {acc.verificationSource || 'إدخال المستخدم والمطابقة'}</div>
                  {acc.serverZoneId && <div>السيرفر / الزون: {acc.serverZoneId}</div>}
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between">
                <Link
                  href={`/topup/${acc.serviceSlug}`}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1"
                >
                  <span>شحن سريع</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>

                <button
                  onClick={() => handleUnlink(acc.id)}
                  className="text-rose-400 hover:text-rose-300 text-xs font-medium flex items-center gap-1 hover:underline"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>إلغاء الربط</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-white mb-2">ربط حساب خدمة رقمية جديد</h2>
            <p className="text-xs text-slate-400 mb-6">
              أدخل بيانات حسابك لتسريع وتأكيد عمليات الشحن القادمة
            </p>

            {error && (
              <div className="bg-rose-950/40 border border-rose-500/30 rounded-xl p-3 mb-4 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleAddAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  اختر الخدمة أو اللعبة
                </label>
                <select
                  value={selectedService}
                  onChange={(e) => setSelectedService(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="pubg-mobile">ببجي موبايل (PUBG Mobile UC)</option>
                  <option value="yoyo">تطبيق يويو (YoYo Chat)</option>
                  <option value="toptop">توب توب (TopTop Games)</option>
                  <option value="free-fire">فري فاير (Garena Free Fire)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  معرف اللاعب / المستخدم (Player ID)
                </label>
                <input
                  type="text"
                  required
                  value={accountIdentifier}
                  onChange={(e) => setAccountIdentifier(e.target.value)}
                  placeholder="مثال: 5123456789"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  اسم اللاعب أو الكنية (اختياري)
                </label>
                <input
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="مثال: الصقر اليماني"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Explicit User Consent Agreement Box */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-indigo-400 block">
                  إقرار الموافقة الصريحة (Explicit User Consent):
                </span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  أوافق صراحة على حفظ معرّف الحساب أعلاه في حسابي لاستخدامه كمعرف مرجعي عند طلب الشحن
                  لتسريع العملية وتفادي أخطاء الإدخال، وأعلم أن بإمكاني إلغاء الربط وسحب الموافقة في أي
                  وقت.
                </p>
                <label className="flex items-start gap-2.5 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    checked={consentGranted}
                    onChange={(e) => setConsentGranted(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700 mt-0.5"
                  />
                  <span className="text-xs text-slate-200 font-bold select-none">
                    أوافق وأمنح التفويض لحفظ هذا المعرف المرجعي
                  </span>
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="w-1/3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 rounded-xl text-xs transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting || !consentGranted || !accountIdentifier}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-xs transition-all shadow-lg shadow-indigo-600/30"
                >
                  {submitting ? 'جاري الربط...' : 'تأكيد الحفظ والربط'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
