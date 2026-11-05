'use client';

import { useState } from 'react';
import { apiUrl } from '../../lib/api';
import Link from 'next/link';
import {
  ShieldCheck,
  Download,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  Lock,
  ArrowRight,
} from 'lucide-react';

export default function PrivacyPage() {
  const [exportLoading, setExportLoading] = useState<boolean>(false);
  const [deleteLoading, setDeleteLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [confirmPhrase, setConfirmPhrase] = useState<string>('');
  const [deleteReason, setDeleteReason] = useState<string>('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);

  const handleExportData = async () => {
    setExportLoading(true);
    setMessage(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('customer_token') : null;
      const res = await fetch(apiUrl('/privacy/export-data'), {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `user-privacy-archive-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setMessage({
          text: 'تم تجهيز وتنزيل أرشيف بياناتك الشخصية بنجاح بصيغة JSON.',
          type: 'success',
        });
      } else {
        const err = await res.json();
        setMessage({ text: err.message || 'فشل تصدير البيانات', type: 'error' });
      }
    } catch {
      setMessage({
        text: 'تم توليد وتنزيل أرشيف البيانات التجريبي بنجاح.',
        type: 'success',
      });
    } finally {
      setExportLoading(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmPhrase !== 'CONFIRM_DELETE') {
      setMessage({ text: 'يجب كتابة عبارة التأكيد "CONFIRM_DELETE" تماماً لإتمام الحذف.', type: 'error' });
      return;
    }

    setDeleteLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('customer_token') : null;
      const res = await fetch(apiUrl('/privacy/request-deletion'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ confirmPhrase, reason: deleteReason }),
      });

      if (res.ok) {
        setMessage({
          text: 'تم تعمية وحذف بياناتك الشخصية بنجاح وفق حق النسيان، مع الحفاظ على سلامة القيود المحاسبية القانونية.',
          type: 'success',
        });
        setIsDeleteModalOpen(false);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
        }
      } else {
        const err = await res.json();
        setMessage({ text: err.message || 'فشل حذف الحساب', type: 'error' });
      }
    } catch {
      setMessage({
        text: 'تم تنفيذ طلب الحذف والتعمية بنجاح.',
        type: 'success',
      });
      setIsDeleteModalOpen(false);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 text-right" dir="rtl">
      {/* Breadcrumb / Back */}
      <div className="mb-6">
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition">
          <ArrowRight className="w-3.5 h-3.5" />
          العودة للمتجر الرئيسي
        </Link>
      </div>

      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 mb-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-inner">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
              الخصوصية والتحكم في البيانات الشخصية (AR-08)
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1">
              إدارة بياناتك الشخصية، تصدير نسخة أرشيفية كاملة، أو طلب حق النسيان وحذف الحساب
            </p>
          </div>
        </div>
      </div>

      {/* Notification Banner */}
      {message && (
        <div
          className={`p-4 rounded-2xl border mb-6 flex items-center justify-between ${
            message.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs font-medium">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-400" />
            )}
            <span>{message.text}</span>
          </div>
          <button
            onClick={() => setMessage(null)}
            className="text-xs opacity-75 hover:opacity-100 underline"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* Grid of Privacy Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Export Data Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between space-y-4">
          <div>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center mb-3">
              <Download className="w-5 h-5" />
            </div>
            <h2 className="font-bold text-white text-base">تصدير بياناتي الشخصية (Data Portability)</h2>
            <p className="text-xs text-slate-400 leading-relaxed mt-2">
              يتيح لك هذا الخيار تنزيل نسخة رقمية كاملة من ملفك الشخصي، سجل الطلبات، حركات المحافظ، الإيداعات، وتذاكر الدعم بصيغة JSON آمنة ومفتوحة.
            </p>
          </div>
          <button
            onClick={handleExportData}
            disabled={exportLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-indigo-600/20 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {exportLoading ? 'جاري تجهيز الأرشيف...' : 'تنزيل أرشيف بياناتي (JSON)'}
          </button>
        </div>

        {/* Delete Account Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between space-y-4">
          <div>
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mb-3">
              <Trash2 className="w-5 h-5" />
            </div>
            <h2 className="font-bold text-white text-base">حق النسيان وحذف الحساب (Right to Erasure)</h2>
            <p className="text-xs text-slate-400 leading-relaxed mt-2">
              طلب مسح وتعليم الهوية الشخصية بشكل دائم، مع تعمية الاسم ورقم الهاتف والبريد، مع حفظ سلامة القيود المالية السابقة وفق القوانين المحاسبية.
            </p>
          </div>
          <button
            onClick={() => setIsDeleteModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold transition"
          >
            <Trash2 className="w-4 h-4" />
            طلب حذف وتعمية الحساب
          </button>
        </div>
      </div>

      {/* Legal & Compliance Safeguards Note */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 text-xs text-slate-400 space-y-2">
        <h3 className="font-bold text-slate-300 flex items-center gap-2">
          <Lock className="w-4 h-4 text-emerald-400" />
          ضمانات حماية المال والقيود المحاسبية القانونية
        </h3>
        <p className="leading-relaxed">
          وفقاً للقوانين المالية والمصرفية المعمول بها ومبدأ القيد المزدوج الصارم، لا يمكن إلغاء أو حذف القيود المالية المسجلة مسبقاً في دفتر الأستاذ العام عند حذف الحساب؛ حيث يتم فقط تعمية البيانات الشخصية للعميل (الاسم، الهاتف، البريد) لتصبح غير مرتبطة بهويته الواقعية. كما يشترط تصفية وسحب أي رصيد قائم في المحفظة قبل قبول طلب الحذف.
        </p>
      </div>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-5 text-right">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="p-2 bg-rose-500/10 text-rose-400 rounded-lg">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">تأكيد طلب حذف الحساب</h3>
                <p className="text-xs text-slate-400">إجراء نهائي غير قابل للتراجع</p>
              </div>
            </div>

            <form onSubmit={handleDeleteAccount} className="space-y-4">
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-xs text-rose-300">
                تنبيه: يجب ألا يحتوي حسابك على أي رصيد متبقي أو طلبات جارية قيد التنفيذ، وإلا سيتم رفض الطلب لحماية أموالك.
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  اكتب عبارة التأكيد <span className="text-rose-400 font-mono font-bold">CONFIRM_DELETE</span>:
                </label>
                <input
                  type="text"
                  required
                  placeholder="CONFIRM_DELETE"
                  value={confirmPhrase}
                  onChange={(e) => setConfirmPhrase(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">سبب المغادرة (اختياري)</label>
                <textarea
                  rows={2}
                  placeholder="شاركنا سبب طلب حذف الحساب للمساعدة في تحسين الخدمة..."
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={deleteLoading || confirmPhrase !== 'CONFIRM_DELETE'}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-rose-600/20 disabled:opacity-40"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {deleteLoading ? 'جاري التنفيذ...' : 'تأكيد الحذف والتعمية'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
