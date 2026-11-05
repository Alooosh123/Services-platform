import { ShieldCheck, Zap } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-slate-950 border-t border-slate-900 py-12 text-slate-400 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <Zap className="w-4 h-4 text-indigo-400" />
            منصة الشحن الرقمي والخدمات
          </div>
          <p className="text-slate-400 leading-relaxed">
            منظومة مؤتمتة وسريعة وآمنة لشحن الألعاب الإلكترونية وبطاقات الهدايا الرقمية مع تسليم فوري لحساب اللاعب مباشرة.
          </p>
        </div>

        <div>
          <h4 className="text-white font-semibold text-xs mb-3 uppercase tracking-wider">الألعاب المدعومة</h4>
          <ul className="space-y-2 text-slate-400">
            <li>شدات ببجي موبايل (PUBG UC)</li>
            <li>جواهر فري فاير (Free Fire Diamonds)</li>
            <li>ماسات موبايل ليجندز (MLBB)</li>
            <li>كول أوف ديوتي موبايل (COD Points)</li>
          </ul>
        </div>

        <div>
          <h4 className="text-white font-semibold text-xs mb-3 uppercase tracking-wider">البطاقات الرقمية</h4>
          <ul className="space-y-2 text-slate-400">
            <li>بطاقات جوجل بلاي (متجر أمريكي)</li>
            <li>بطاقات أبل ستور وآيتونز</li>
            <li>بطاقات بلايستيشن ستور</li>
            <li>بطاقات إكس بوكس لايف</li>
          </ul>
        </div>

        <div>
          <h4 className="text-white font-semibold text-xs mb-3 uppercase tracking-wider">الأمان والموثوقية</h4>
          <div className="flex items-center gap-2 text-emerald-400 mb-2 font-semibold">
            <ShieldCheck className="w-4 h-4" />
            <span>نظام محاسبي بالقيد المزدوج (Ledger)</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            جميع الأرصدة والعمليات المالية مشفرة ومحمية بسجل حركات دائم غير قابل للتلاعب مع ضمان التسليم الفوري أو استرداد الأموال التلقائي.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-900 mt-8 pt-6 flex flex-col sm:flex-row justify-between items-center text-[11px] text-slate-500">
        <p>© 2026 جميع الحقوق محفوظة - منصة الشحن الرقمي والخدمات.</p>
        <p className="flex items-center gap-1 mt-2 sm:mt-0 font-medium text-slate-400">
          مصممة بأعلى معايير الأمان المالي والتوسع التجاري
        </p>
      </div>
    </footer>
  );
}
