'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Send,
  Lock,
} from 'lucide-react';
import { apiUrl } from '../../lib/api';

export default function VerifyPhonePage() {
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState<'input' | 'otp' | 'verified'>('input');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [carrier, setCarrier] = useState<string | null>(null);
  const [timer, setTimer] = useState(180);

  // Quick carrier detection for preview
  const getCarrierPreview = (num: string) => {
    const clean = num.replace(/\D/g, '');
    if (clean.startsWith('77') || clean.startsWith('78') || clean.endsWith('77') || clean.endsWith('78')) {
      return 'يمن موبايل (Yemen Mobile)';
    }
    if (clean.startsWith('71') || clean.endsWith('71')) {
      return 'سبأفون (Sabafon)';
    }
    if (clean.startsWith('73') || clean.endsWith('73')) {
      return 'يو - إم تي إن (YOU Telecom)';
    }
    if (clean.startsWith('70') || clean.endsWith('70')) {
      return 'واي (Y Telecom)';
    }
    return null;
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(apiUrl('/phone-verification/send-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'تعذر إرسال رمز التحقق');
      }

      setCarrier(data.carrier);
      setSuccessMsg(data.message);
      setStep('otp');
      setTimer(180);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ في الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(apiUrl('/phone-verification/verify-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code: otpCode }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'رمز التحقق غير صحيح');
      }

      setStep('verified');
      setSuccessMsg(data.message);
    } catch (err: any) {
      setError(err.message || 'تعذر التحقق من الرمز');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mx-auto mb-4">
            <Smartphone className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black text-white">تأكيد حيازة رقم الهاتف اليمني</h1>
          <p className="text-xs text-slate-400 mt-2 max-w-sm mx-auto">
            خطوة أمان لتأكيد ملكية رقم الهاتف عبر رمز SMS لمرة واحدة (E.164 Verification)
          </p>
        </div>

        {/* Legal Disclaimer Box */}
        <div className="bg-amber-950/30 border border-amber-500/30 rounded-2xl p-4 mb-6 text-xs text-amber-200/90 flex gap-3">
          <ShieldCheck className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block mb-1">إخلاء مسؤولية وضوابط الأمان:</span>
            <span>
              تأكيد حيازة رقم الهاتف هو إثبات لحيازة الشريحة (Possession Factor) لتعزيز أمان الحساب
              والطلبات، ولا يُعد إثباتاً قانونياً شاملاً للهوية (KYC).
            </span>
          </div>
        </div>

        {error && (
          <div className="bg-rose-950/40 border border-rose-500/30 rounded-2xl p-4 mb-6 text-xs text-rose-300 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && step !== 'verified' && (
          <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-4 mb-6 text-xs text-emerald-300 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {step === 'input' && (
          <form onSubmit={handleSendOtp} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2">
                أدخل رقم الهاتف اليمني
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="مثال: 770123456 أو 733987654"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3.5 text-left text-white font-mono tracking-wider focus:outline-none focus:border-indigo-500"
                  dir="ltr"
                />
                <span className="absolute right-4 top-3.5 text-xs text-slate-500 font-bold">
                  YE (+967)
                </span>
              </div>
              {getCarrierPreview(phone) && (
                <div className="mt-2 text-[11px] text-indigo-400 font-medium flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                  <span>الشبكة المكتشفة: {getCarrierPreview(phone)}</span>
                </div>
              )}
            </div>

            <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
              <div>• يدعم جميع شبكات الهاتف اليمنية: يمن موبايل، سبأفون، يو، واي.</div>
              <div>• حد الإرسال: 3 رموز لكل 15 دقيقة حماية من الضخ الاحتيالي (Anti-OTP Pumping).</div>
            </div>

            <button
              type="submit"
              disabled={loading || !phone}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
            >
              {loading ? 'جاري الإرسال...' : 'إرسال رمز التحقق SMS'}
              <Send className="w-4 h-4" />
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-center">
              <span className="text-xs text-slate-400 block mb-1">تم إرسال الرمز إلى الرقم:</span>
              <span className="text-sm font-mono font-bold text-white tracking-widest">{phone}</span>
              {carrier && <span className="block text-[11px] text-indigo-400 mt-1">({carrier})</span>}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2">
                أدخل رمز التحقق (6 أرقام)
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3.5 text-center text-2xl font-mono tracking-widest text-emerald-400 focus:outline-none focus:border-indigo-500"
                dir="ltr"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-1.5 text-slate-400">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>صلاحية الرمز: 3 دقائق</span>
              </div>
              <button
                type="button"
                onClick={() => setStep('input')}
                className="text-indigo-400 hover:underline"
              >
                تغيير الرقم
              </button>
            </div>

            <button
              type="submit"
              disabled={loading || otpCode.length !== 6}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2"
            >
              {loading ? 'جاري التحقق...' : 'تأكيد الرمز واعتماد الرقم'}
              <Lock className="w-4 h-4" />
            </button>
          </form>
        )}

        {step === 'verified' && (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-xl font-bold text-white">تم تأكيد رقم الهاتف بنجاح!</h2>
            <p className="text-xs text-slate-300 max-w-sm mx-auto">
              الرقم {phone} معتمد الآن في حسابك لاستقبال إشعارات الشحن وتأكيد طلبات الخدمات.
            </p>

            <div className="pt-4 flex justify-center gap-3">
              <Link
                href="/linked-accounts"
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-5 py-3 rounded-xl transition-all shadow-md"
              >
                إدارة الحسابات المرتبطة
              </Link>
              <Link
                href="/"
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-5 py-3 rounded-xl transition-all"
              >
                العودة للمتجر
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
