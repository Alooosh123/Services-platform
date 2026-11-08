'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Gamepad2,
  ShoppingCart,
  WalletCards,
  ServerCog,
  ShieldCheck,
  Zap,
  DollarSign,
  Wallet,
  TrendingUp,
  Bot,
  Scale,
  LifeBuoy,
  ShieldAlert,
  Activity,
  Rocket,
  FileCheck2,
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

const navItems = [
  { name: 'لوحة المؤشرات', href: '/', icon: LayoutDashboard },
  { name: 'الألعاب والمنتجات', href: '/products', icon: Gamepad2 },
  { name: 'إدارة الطلبات', href: '/orders', icon: ShoppingCart },
  { name: 'مركز العمليات والمراقبة', href: '/operations', icon: Activity },
  { name: 'مركز الإطلاق والتشغيل التجاري', href: '/launch', icon: Rocket },
  { name: 'تسليم التشغيل وأدلة العمليات', href: '/handover', icon: FileCheck2 },
  { name: 'خدمة العملاء والتذاكر', href: '/support', icon: LifeBuoy },
  { name: 'تقارير الأرباح والمبيعات', href: '/reports', icon: TrendingUp },
  { name: 'إيداعات العملاء والتحقق', href: '/deposits', icon: DollarSign },
  { name: 'محافظ العملاء والرقابة', href: '/wallets', icon: Wallet },
  { name: 'دفتر الأستاذ العام', href: '/ledger', icon: WalletCards },
  { name: 'التسوية والمطابقة المالية', href: '/reconciliation', icon: Scale },
  { name: 'مراجعة الحسابات والمخاطر', href: '/account-reviews', icon: Bot },
  { name: 'مزودو الشحن والمحولات', href: '/providers', icon: ServerCog },
  { name: 'الأمن ومكافحة الاحتيال', href: '/security', icon: ShieldAlert },
  { name: 'سجل الرقابة والتدقيق', href: '/audit', icon: ShieldCheck },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-slate-900 border-l border-slate-800 flex flex-col h-screen fixed right-0 top-0 z-40 text-right">
      <div className="h-16 flex items-center px-6 border-b border-slate-800 gap-3">
        <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
          <Zap className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-bold text-white text-base leading-tight">لوحة الإدارة</h1>
          <p className="text-xs text-indigo-400 font-medium">التحكم المركزي</p>
        </div>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              title={item.name}
              className={[
                'flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60',
              ].join(' ')}
            >
              <Icon
                className={[
                  'w-4 h-4',
                  isActive ? 'text-indigo-400' : 'text-slate-500',
                ].join(' ')}
              />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800 bg-slate-900/50">
        <div className="mb-3 flex items-center justify-start px-2">
          <ThemeToggle />
        </div>
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-semibold text-xs text-indigo-400 border border-slate-700">
            SA
          </div>
          <div className="overflow-hidden">
            <p className="text-xs font-semibold text-white truncate">المدير العام (Super Admin)</p>
            <p className="text-[10px] text-emerald-400 font-mono">وضع التجربة (نشط)</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
