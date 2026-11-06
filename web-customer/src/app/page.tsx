'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Gamepad2,
  PhoneCall,
  Wifi,
  CreditCard,
  Smartphone,
  ShieldCheck,
  Zap,
  ArrowLeft,
  Wallet,
  Sparkles,
  ChevronDown,
  Lock,
  Layers,
  Flame,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { getCustomerSession } from '../lib/api';
import { initials, firstName, formatMoney } from '../lib/format';
import { TopUpAiAssistant } from '../components/TopUpAiAssistant';

export default function CustomerHomePage() {
  const [activeCurrency, setActiveCurrency] = useState<'YER' | 'SAR' | 'USD'>('YER');
  const [session, setSession] = useState<{ user: any; token: string | null }>({ user: null, token: null });

  useEffect(() => {
    setSession(getCustomerSession());
  }, []);

  const currencies = [
    { code: 'YER', label: 'ريال يمني', symbol: 'ر.ي' },
    { code: 'SAR', label: 'ريال سعودي', symbol: 'ر.س' },
    { code: 'USD', label: 'دولار أمريكي', symbol: '$' },
  ];

  const categories = [
    {
      id: 'gaming',
      title: 'شحن الألعاب الفورية',
      subtitle: 'ببجي موبايل، فري فاير، روبلوكس، كول أوف ديوتي، بيس',
      icon: <Gamepad2 className="w-8 h-8 text-sky-400" />,
      color: 'from-sky-500/15 to-indigo-500/5 border-sky-500/30',
      badge: '⚡ شحن لحظي بالـ ID',
      items: ['ببجي موبايل (PUBG UC)', 'فري فاير (Free Fire)', 'روبلوكس (Robux)', 'موبايل ليجندز'],
    },
    {
      id: 'telecom',
      title: 'اتصالات وباقات يمن',
      subtitle: 'يمن موبايل، سبأفون، يو YOU، شركة واي للاتصالات',
      icon: <PhoneCall className="w-8 h-8 text-emerald-400" />,
      color: 'from-emerald-500/15 to-teal-500/5 border-emerald-500/30',
      badge: '📡 ربط مباشر 24/7',
      items: ['يمن موبايل (رصيد + باقات)', 'سبأفون (جنوب وشمال)', 'يو (YOU باقات نت)', 'شركة واي للاتصالات'],
    },
    {
      id: 'internet',
      title: 'إنترنت منزلي وشبكات',
      subtitle: 'يمن نت ADSL، فايبر ضوئي، عدن نت 4G، يمن 4G',
      icon: <Wifi className="w-8 h-8 text-cyan-400" />,
      color: 'from-cyan-500/15 to-blue-500/5 border-cyan-500/30',
      badge: '🌐 تجديد وسداد فوري',
      items: ['يمن نت ADSL سوبر نت', 'خدمة فايبر الضوئية', 'عدن نت AdenNet 4G', 'يمن فورجي Yemen 4G'],
    },
    {
      id: 'cards',
      title: 'بطاقات رقمية واشتراكات',
      subtitle: 'جوجل بلاي، أبل ستور، بلايستيشن، شاهد VIP، نتفلكس',
      icon: <CreditCard className="w-8 h-8 text-purple-400" />,
      color: 'from-purple-500/15 to-pink-500/5 border-purple-500/30',
      badge: '🔑 أكواد معتمدة أصلية',
      items: ['بطاقات Google Play', 'بطاقات Apple Gift Card', 'اشتراكات PlayStation', 'شاهد VIP ونتفلكس'],
    },
  ];

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex flex-col font-sans" dir="rtl">
      {/* Top Navbar */}
      <header className="border-b border-[#1E293B] bg-[#0F172A]/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-400 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-sky-500/25">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-xl text-white tracking-wide">توب آب ستور</span>
                <span className="text-[10px] font-extrabold bg-sky-500/15 text-sky-400 border border-sky-500/30 px-2 py-0.5 rounded-full">
                  TOPUP STORE
                </span>
              </div>
              <p className="text-[11px] text-slate-400">المنصة الشاملة لخدمات الشحن الرقمي</p>
            </div>
          </Link>

          {/* Center: Currency selector pill */}
          <div className="hidden md:flex items-center gap-1 bg-[#161F30] border border-[#1E293B] p-1 rounded-xl">
            {currencies.map((c) => (
              <button
                key={c.code}
                onClick={() => setActiveCurrency(c.code as any)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  activeCurrency === c.code
                    ? 'bg-sky-500 text-white shadow-md shadow-sky-500/25'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {c.symbol} {c.code}
              </button>
            ))}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            <a
              href="http://localhost:8081"
              target="_blank"
              rel="noreferrer"
              className="hidden lg:flex items-center gap-2 bg-[#161F30] hover:bg-[#1E293B] text-sky-400 text-xs font-bold px-3.5 py-2 rounded-xl border border-[#1E293B] transition"
            >
              <Smartphone className="w-4 h-4 text-sky-400" />
              <span>تطبيق الهاتف (Expo Web)</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>

            {session?.user ? (
              <div className="flex items-center gap-2 bg-[#161F30] border border-[#1E293B] px-3 py-1.5 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow">
                  {initials(session.user.fullName || session.user.email)}
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-white leading-none">{firstName(session.user.fullName || '') || session.user.email}</p>
                  <p className="text-[10px] text-sky-400 font-mono">حساب موثق</p>
                </div>
              </div>
            ) : (
              <Link
                href="/login"
                className="bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-lg shadow-sky-500/20 transition flex items-center gap-2"
              >
                <span>دخول / تسجيل حساب</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 py-8 w-full space-y-10">
        {/* Hero Section */}
        <div className="relative rounded-3xl bg-gradient-to-b from-[#161F30]/90 to-[#0F172A]/80 border border-[#1E293B] p-8 md:p-12 overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl -z-10" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -z-10" />

          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 bg-sky-500/10 text-sky-400 border border-sky-500/20 px-3.5 py-1.5 rounded-full text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>الإصدار 2.0 المتكامل - شحن تلقائي فوري بالمعرف</span>
            </div>

            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-snug">
              بوابتك الشاملة لشحن الألعاب، الاتصالات، والبطاقات في اليمن
            </h1>

            <p className="text-slate-300 text-sm md:text-base leading-relaxed">
              شحن مباشر ومضمون لببجي وفري فاير، تسديد باقات يمن موبايل وسبأفون ويو، وتجديد فوري لإنترنت يمن نت وعدن نت،
              مع دعم كامل لجميع طرق الدفع بالريال اليمني والسعودي والدولار وعملة USDT.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-4">
              <a
                href="http://localhost:8081"
                target="_blank"
                rel="noreferrer"
                className="bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-sm px-6 py-3 rounded-2xl shadow-xl shadow-sky-500/25 transition flex items-center gap-2"
              >
                <Smartphone className="w-4 h-4" />
                <span>فتح تطبيق الموبايل (Port 8081)</span>
              </a>

              <a
                href="http://localhost:3001"
                target="_blank"
                rel="noreferrer"
                className="bg-[#161F30] hover:bg-[#1E293B] text-slate-200 font-bold text-sm px-6 py-3 rounded-2xl border border-[#1E293B] transition flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4 text-sky-400" />
                <span>لوحة التحكم الإدارية (Port 3001)</span>
              </a>

              <Link
                href="/login"
                className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 font-bold text-sm px-6 py-3 rounded-2xl border border-rose-500/30 transition flex items-center gap-2"
              >
                <span>دخول سريع بحساب Google 🌐</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Categories Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black text-white">أقسام الخدمات الرقمية</h2>
              <p className="text-xs text-slate-400">اختر الخدمة المطلوبة لبدء الشحن الفوري والتسديد المباشر</p>
            </div>
            <span className="text-xs font-bold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-3 py-1 rounded-full">
              4 أقسام رئيسية جاهزة
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="bg-[#161F30] border border-[#1E293B] hover:border-sky-500/40 rounded-2xl p-6 transition-all duration-200 hover:shadow-xl hover:shadow-sky-500/10 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-xl bg-[#0B0F19] border border-[#1E293B] flex items-center justify-center">
                      {cat.icon}
                    </div>
                    <span className="text-[11px] font-bold text-sky-300 bg-sky-500/10 border border-sky-500/20 px-2.5 py-0.5 rounded-full">
                      {cat.badge}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-extrabold text-lg text-white">{cat.title}</h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{cat.subtitle}</p>
                  </div>

                  <ul className="space-y-1.5 pt-2 border-t border-[#1E293B]/60">
                    {cat.items.map((item, idx) => (
                      <li key={idx} className="text-xs text-slate-300 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <a
                  href="http://localhost:8081"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full bg-[#0B0F19] hover:bg-sky-500 hover:text-white text-sky-400 text-xs font-bold py-2.5 rounded-xl border border-[#1E293B] transition-all text-center flex items-center justify-center gap-1.5"
                >
                  <span>شحن الآن من التطبيق</span>
                  <ArrowLeft className="w-3 h-3" />
                </a>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Gateways Bar */}
        <div className="bg-[#161F30] border border-[#1E293B] rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Wallet className="w-4 h-4 text-sky-400" />
              <span>بوابات الإيداع المعتمدة والسداد التلقائي</span>
            </h3>
            <span className="text-xs text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
              تحقق تلقائي 24/7
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 text-center">
            <div className="bg-[#0B0F19] border border-[#1E293B] p-3 rounded-xl">
              <p className="text-xs font-bold text-white">بنك الكريمي</p>
              <p className="text-[10px] text-slate-400">حساب مميز & إيداع فوري</p>
            </div>
            <div className="bg-[#0B0F19] border border-[#1E293B] p-3 rounded-xl">
              <p className="text-xs font-bold text-white">محفظة جيب M-Floos</p>
              <p className="text-[10px] text-slate-400">تحويل إلكتروني لحظي</p>
            </div>
            <div className="bg-[#0B0F19] border border-[#1E293B] p-3 rounded-xl">
              <p className="text-xs font-bold text-white">ون كاش OneCash</p>
              <p className="text-[10px] text-slate-400">دفع إلكتروني مباشر</p>
            </div>
            <div className="bg-[#0B0F19] border border-[#1E293B] p-3 rounded-xl">
              <p className="text-xs font-bold text-white">النجم للصرافة</p>
              <p className="text-[10px] text-slate-400">حوالات شبكة النجم</p>
            </div>
            <div className="bg-[#0B0F19] border border-[#1E293B] p-3 rounded-xl">
              <p className="text-xs font-bold text-emerald-400">USDT (TRC20)</p>
              <p className="text-[10px] text-slate-400">دفع بالعملات المشفرة</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1E293B] bg-[#0F172A] py-6 text-center text-xs text-slate-500 space-y-2">
        <p className="font-bold text-slate-400">توب آب ستور ⚡ المنصة اليمنية الأولى لخدمات الشحن والاتصالات الرقمية</p>
        <p>© 2026 جميع الحقوق محفوظة • يدعم العملات المتعددة (YER • SAR • USD)</p>
      </footer>

      {/* Floating AI Assistant (Google Gemini 3.8 Flash) */}
      <TopUpAiAssistant user={session.user} />
    </div>
  );
}
