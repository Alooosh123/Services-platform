'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Lock, Mail, KeyRound, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('admin@digitaltopup.com');
  const [password, setPassword] = useState('Admin@123456');
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [step, setStep] = useState<'credentials' | 'mfa'>('credentials');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('http://localhost:4000/api/auth/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'بيانات الدخول الإدارية غير صحيحة');
      }

      if (data.requiresMfa) {
        setTempToken(data.tempToken);
        setStep('mfa');
      } else if (data.tokens) {
        localStorage.setItem('admin_token', data.tokens.accessToken);
        localStorage.setItem('admin_user', JSON.stringify(data.user));
        setSuccess(true);
        setTimeout(() => router.push('/'), 800);
      }
    } catch (err: any) {
      setError(err?.message || 'فشل تسجيل الدخول الإداري');
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaCode || mfaCode.length !== 6) {
      setError('يرجى إدخال رمز التحقق المكون من 6 أرقام');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('http://localhost:4000/api/auth/admin/verify-mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken, code: mfaCode }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'رمز التحقق غير صحيح');
      }

      localStorage.setItem('admin_token', data.tokens.accessToken);
      if (data.user) {
        localStorage.setItem('admin_user', JSON.stringify(data.user));
      }
      setSuccess(true);
      setTimeout(() => router.push('/'), 800);
    } catch (err: any) {
      setError(err?.message || 'فشل التحقق من رمز MFA');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans" dir="rtl">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="w-14 h-14 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-indigo-600/20 mb-4">
          <Shield className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-white tracking-tight">بوابة الإدارة المركزية (Digital TopUp)</h2>
        <p className="mt-2 text-xs text-slate-400">
          دخول آمن للمشرفين، مراقبة المزودين، وتسوية الحسابات المالية
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-900 border border-slate-800 py-8 px-6 shadow-2xl rounded-3xl sm:px-10 space-y-6">
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-2xl text-xs flex items-center gap-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="font-semibold">{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-3 rounded-2xl text-xs flex items-center gap-3">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="font-semibold">تم التحقق بنجاح، جاري فتح لوحة التحكم...</span>
            </div>
          )}

          {step === 'credentials' ? (
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 block">البريد الإلكتروني للإدارة:</label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    dir="ltr"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition"
                  />
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 block">كلمة المرور:</label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    dir="ltr"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition"
                  />
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-600/30 transition disabled:opacity-50 text-sm flex items-center justify-center gap-2 mt-4"
              >
                <span>{loading ? 'جاري التحقق...' : 'دخول المشرف الإداري'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleMfaSubmit} className="space-y-4">
              <div className="text-center space-y-1">
                <div className="w-10 h-10 bg-indigo-600/20 text-indigo-400 rounded-xl flex items-center justify-center mx-auto mb-2">
                  <KeyRound className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-white">رمز التحقق الثنائي (MFA)</h3>
                <p className="text-xs text-slate-400">أدخل رمز TOTP المكون من 6 أرقام من تطبيق Authenticator</p>
              </div>

              <div className="space-y-1">
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  dir="ltr"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 text-center text-2xl font-mono tracking-widest text-white placeholder:text-slate-700 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-600/30 transition disabled:opacity-50 text-sm flex items-center justify-center gap-2"
              >
                <span>{loading ? 'جاري التحقق...' : 'تأكيد ودخول اللوحة'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setStep('credentials')}
                className="w-full text-center text-xs text-slate-400 hover:text-slate-200"
              >
                الرجوع لإعادة إدخال كلمة المرور
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
