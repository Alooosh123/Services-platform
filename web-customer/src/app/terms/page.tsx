import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'شروط الاستخدام | منصة الشحن الرقمي',
  description: 'شروط الاستخدام والأحكام البيعية القياسية لمنصة الشحن والخدمات الرقمية',
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6 lg:px-8 dir-rtl" dir="rtl">
      <div className="max-w-4xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-10 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-6 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">شروط الاستخدام (Terms of Service)</h1>
            <p className="text-slate-400 text-sm mt-1">اتفاقية مستوى الخدمة والبنود البيعية</p>
          </div>
          <Link
            href="/"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-xl text-sm font-semibold transition duration-200"
          >
            ← العودة للرئيسية
          </Link>
        </div>

        <div className="space-y-8 text-slate-300 leading-relaxed">
          <section className="bg-slate-800/40 border border-slate-800/60 rounded-xl p-5">
            <h2 className="text-xl font-semibold text-emerald-400 mb-3 flex items-center gap-2">
              <span>1. طبيعة المنتجات الرقمية والاستهلاك الفوري</span>
            </h2>
            <p>
              جميع بطاقات الشحن، أكواد الألعاب الإلكترونية، باقات الاتصالات والإنترنت تُعد منتجات رقمية فورية الاستهلاك والتسليم. بمجرد إتمام العملية وكشف الكود الرقمي أو تأكيد استلامه من قبل المزود، لا يمكن استرجاع المبلغ أو استبدال المنتج ما لم يكن هناك عطل مثبت وموثق من جهة المزود المصدر.
            </p>
          </section>

          <section className="bg-slate-800/40 border border-slate-800/60 rounded-xl p-5">
            <h2 className="text-xl font-semibold text-emerald-400 mb-3 flex items-center gap-2">
              <span>2. صحة بيانات المستفيد والمسؤولية المدنية</span>
            </h2>
            <p>
              يتحمل المستخدم أو الوكيل التجاري كامل المسؤولية عن دقة وصحة رقم الهاتف المشحون أو معرف اللاعب (<code className="text-emerald-300">Player ID</code>). في حال إدخال رقم هاتف أو حساب خاطئ وتم شحنه بنجاح بواسطة بوابة الاتصالات أو المزود الخارجي، تخلي المنصة مسؤوليتها القانونية والمالية عن هذا الخطأ.
            </p>
          </section>

          <section className="bg-slate-800/40 border border-slate-800/60 rounded-xl p-5">
            <h2 className="text-xl font-semibold text-emerald-400 mb-3 flex items-center gap-2">
              <span>3. التحويلات الفورية والمحافظ المالية (P2P Transfers)</span>
            </h2>
            <p className="mb-2">
              تتم جميع عمليات تحويل الرصيد بين محافظ المستخدمين (<code className="text-emerald-300">P2P Transfers</code>) بشكل لحظي وذري، وتتطلب إدخال رمز الحماية الشخصي (<code className="text-emerald-300">PIN</code>) وتأكيد الهوية.
            </p>
            <p>
              تخضع التحويلات المالية لضوابط مكافحة الاحتيال ونظام مراقبة السلوك المالي الذكي (<code className="text-emerald-300">AI Fraud Sentinel</code>)؛ ويحق للمنصة إيقاف أي عملية ترصد نمطاً دائرياً مشبوهاً لحين التحقق البشري.
            </p>
          </section>

          <section className="bg-slate-800/40 border border-slate-800/60 rounded-xl p-5">
            <h2 className="text-xl font-semibold text-emerald-400 mb-3 flex items-center gap-2">
              <span>4. أسعار الصرف وفوارق العملات (Spread Guard)</span>
            </h2>
            <p>
              تحتفظ المنصة بحق تطبيق هوامش أسعار الصرف الحية بين العملات الثلاث المعتمدة (<code className="text-emerald-300">YER</code>, <code className="text-emerald-300">USD</code>, <code className="text-emerald-300">SAR</code>) وفقاً لتقلبات السوق المصرفي، ويتم إخطار العميل بسعر الصرف النهائي المطبق قبل تأكيد أي عملية عبر المحفظة.
            </p>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t border-slate-800 flex justify-between items-center text-sm text-slate-500">
          <span>منظومة الخدمات والشحن الرقمي المتكاملة</span>
          <Link href="/privacy" className="text-emerald-400 hover:underline">
            سياسة الخصوصية ←
          </Link>
        </div>
      </div>
    </div>
  );
}

