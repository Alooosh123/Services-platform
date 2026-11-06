import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'سياسة الخصوصية | منصة الشحن الرقمي',
  description: 'سياسة الخصوصية وحماية بيانات المستخدمين القياسية لخدمة Google Sign-In ومتاجر التطبيقات',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6 lg:px-8 dir-rtl" dir="rtl">
      <div className="max-w-4xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-10 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-6 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">سياسة الخصوصية (Privacy Policy)</h1>
            <p className="text-slate-400 text-sm mt-1">تاريخ آخر تحديث: 2026</p>
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
              <span>1. البيانات التي نجمعها</span>
            </h2>
            <p className="mb-3">
              عند استخدامك لمنصتنا أو تسجيل الدخول عبر خدمة <strong>Google Sign-In (OAuth 2.0)</strong>، نقوم بجمع البيانات الأساسية التالية فقط:
            </p>
            <ul className="list-disc list-inside space-y-2 mr-2 text-slate-300">
              <li>
                <strong className="text-white">بيانات الحساب:</strong> الاسم الكامل وعنوان البريد الإلكتروني وصورة الملف الشخصي (المزودة من Google Identity Services) لغرض إنشاء حسابك وتوليد محافظك المالية تلقائياً (<code className="text-emerald-300">YER</code>, <code className="text-emerald-300">USD</code>, <code className="text-emerald-300">SAR</code>).
              </li>
              <li>
                <strong className="text-white">بيانات المستفيد:</strong> رقم الهاتف ومعرفات الألعاب (<code className="text-emerald-300">Player IDs</code>) التي تدخلها لتنفيذ طلبات الشحن وإرسال الأكواد الرقمية عبر WhatsApp أو الرسائل القصيرة.
              </li>
              <li>
                <strong className="text-white">إشعارات الدفع:</strong> صور إشعارات الإيداع البنكي والمحافظ الإلكترونية لغرض المطابقة المالية الآلية والتحقق البصري بواسطة الذكاء الاصطناعي.
              </li>
            </ul>
          </section>

          <section className="bg-slate-800/40 border border-slate-800/60 rounded-xl p-5">
            <h2 className="text-xl font-semibold text-emerald-400 mb-3 flex items-center gap-2">
              <span>2. كيفية استخدام البيانات وحمايتها</span>
            </h2>
            <ul className="list-disc list-inside space-y-2 mr-2 text-slate-300">
              <li>
                تُشفر جميع الأكواد الرقمية في خزنتنا بمعيار التشفير العسكري <code className="text-emerald-300">AES-256-GCM</code>، وتُحمى جميع الجلسات بتوقيعات <code className="text-emerald-300">JWT</code> والتحقق الثنائي <code className="text-emerald-300">MFA TOTP</code>.
              </li>
              <li>
                لا نقوم ببيع أو مشاركة بياناتك الشخصية مع أي أطراف إعلانية خارجية، ويقتصر تمرير معرف اللاعب أو رقم الهاتف على بوابة المزود التقني المعتمد لتنفيذ طلبك فقط.
              </li>
              <li>
                تُعزل العمليات المالية في دفتر الأستاذ المحاسبي المزدوج (<code className="text-emerald-300">Double-Entry Ledger</code>) لضمان النزاهة المحاسبية ومكافحة التلاعب.
              </li>
            </ul>
          </section>

          <section className="bg-slate-800/40 border border-slate-800/60 rounded-xl p-5">
            <h2 className="text-xl font-semibold text-emerald-400 mb-3 flex items-center gap-2">
              <span>3. الاحتفاظ بالبيانات وحذف الحساب</span>
            </h2>
            <p className="mb-2">
              تُحفظ السجلات المالية في دفتر الأستاذ امتثالاً للمتطلبات المحاسبية والقانونية المصرفية.
            </p>
            <p>
              يمكنك طلب إغلاق حسابك وحذف بياناتك الشخصية غير المرتبطة بالتزامات مالية معلقة من خلال التواصل مع الدعم الفني أو عبر بوابة الإدارة.
            </p>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t border-slate-800 flex justify-between items-center text-sm text-slate-500">
          <span>منظومة الخدمات والشحن الرقمي المتكاملة</span>
          <Link href="/terms" className="text-emerald-400 hover:underline">
            شروط الاستخدام ←
          </Link>
        </div>
      </div>
    </div>
  );
}

