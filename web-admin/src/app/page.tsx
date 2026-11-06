'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ServerCog,
  Gamepad2,
  Wallet,
  DollarSign,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  ArrowUpRight,
  Zap,
  Activity,
  Layers,
  Key,
  ShoppingCart,
  Scale,
  RefreshCw,
  Building2,
} from 'lucide-react';
import { formatMoney, isolate } from '../lib/format';

export default function AdminDashboardOverview() {
  const [stats, setStats] = useState({
    activeProviders: 7,
    providerBalanceUsd: 14850.50,
    providerBalanceYer: 9400000,
    activeGateways: 4,
    successRate: 99.8,
    pendingDeposits: 0,
    totalProducts: 48,
    systemUptime: '99.98%',
  });
  const [loading, setLoading] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

  const fetchStats = async () => {
    setLoading(true);
    try {
      const token = typeof window !== 'undefined'
        ? localStorage.getItem('admin_token') || localStorage.getItem('token') || ''
        : '';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      // Fetch pending deposits count
      const depRes = await fetch(`${API_URL}/admin/deposits/pending`, { headers });
      if (depRes.ok) {
        const depData = await depRes.json();
        setStats((prev) => ({
          ...prev,
          pendingDeposits: depData.total || (depData.items ? depData.items.length : 0),
        }));
      }

      // Fetch products count
      const prodRes = await fetch(`${API_URL}/products/catalog`, { headers });
      if (prodRes.ok) {
        const catalog = await prodRes.json();
        let pCount = 0;
        catalog.forEach((cat: any) => {
          (cat.services || []).forEach((s: any) => {
            pCount += (s.products || []).length;
          });
        });
        if (pCount > 0) {
          setStats((prev) => ({ ...prev, totalProducts: pCount }));
        }
      }
    } catch (e) {
      console.warn('Dashboard stats error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-indigo-900/60 via-slate-900 to-slate-900 border border-indigo-500/20 rounded-2xl p-6 relative overflow-hidden">
        <div className="relative z-10 max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
            <Zap className="w-3.5 h-3.5" />
            <span>منصة الشحن والخدمات الرقمية - لوحة الإدارة والتحكم المركزي v1.0</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            مرحباً بك في مركز العمليات وإدارة المزودين والمحافظ
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            تحكم كامل بجميع قنوات الدفع الفوري (USDT، الكريمي، النجم)، ومزودي الألعاب (LikeCard، OneCard)، وشبكات الاتصالات والإنترنت (يمن موبايل، سبأفون، يو، يمن نت).
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2 hover:border-slate-700 transition-all shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-sm">
            <span>إجمالي المزودين المربوطين</span>
            <ServerCog className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {isolate(stats.activeProviders)} مزودين نشطين
          </div>
          <div className="text-xs text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>جاهز للشحن الفوري والتلقائي</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2 hover:border-slate-700 transition-all shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-sm">
            <span>رصيد المزودين الإجمالي</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {formatMoney(stats.providerBalanceUsd, 'USD')}
          </div>
          <div className="text-xs text-slate-400">
            + {formatMoney(stats.providerBalanceYer, 'YER')}
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2 hover:border-slate-700 transition-all shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-sm">
            <span>بوابات الدفع الفوري والمحافظ</span>
            <Wallet className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {isolate(stats.activeGateways)} بوابات معتمدة
          </div>
          <div className="text-xs text-cyan-400">
            USDT (TRC20) • الكريمي • النجم • جيب
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2 hover:border-slate-700 transition-all shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-sm">
            <span>نسبة نجاح التوجيه والجاهزية</span>
            <Activity className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {isolate(stats.successRate)}%
          </div>
          <div className="text-xs text-amber-400">
            Smart Failover & Zero Downtime
          </div>
        </div>
      </div>

      {/* Quick Launch Cards */}
      <div>
        <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-400" />
          <span>الوحدات التشغيلية السريعة</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Orders */}
          <Link
            href="/orders"
            className="group bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-xl p-5 transition-all space-y-3 hover:shadow-xl hover:shadow-indigo-500/10"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white group-hover:text-indigo-400 transition-colors">
                  إدارة طلبات الشحن
                </h3>
                <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition-colors" />
              </div>
              <p className="text-xs text-slate-400 mt-1">
                متابعة طابور الطلبات اللحظي، فحص حالة التنفيذ الفوري، وإعادة محاولة الطلبات المعلقة.
              </p>
            </div>
          </Link>

          {/* Products & Kill Switch */}
          <Link
            href="/products"
            className="group bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-xl p-5 transition-all space-y-3 hover:shadow-xl hover:shadow-emerald-500/10"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-all">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white group-hover:text-emerald-400 transition-colors">
                  الألعاب والباقات والأسعار
                </h3>
                <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
              </div>
              <p className="text-xs text-slate-400 mt-1">
                تعديل هوامش الربح، إضافة خدمات جديدة، ومفتاح الإيقاف الطارئ للباقات (Kill Switch).
              </p>
            </div>
          </Link>

          {/* PIN Vault */}
          <Link
            href="/pin-vault"
            className="group bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-xl p-5 transition-all space-y-3 hover:shadow-xl hover:shadow-amber-500/10"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-600/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:bg-amber-600 group-hover:text-white transition-all">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white group-hover:text-amber-400 transition-colors">
                  خزنة البطاقات (PIN Vault)
                </h3>
                <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors" />
              </div>
              <p className="text-xs text-slate-400 mt-1">
                مخزون البطاقات الرقمية المشفرة بـ AES-256، جرد البطاقات المتبقية، وسحب الأكواد الفوري.
              </p>
            </div>
          </Link>

          {/* Deposits */}
          <Link
            href="/deposits"
            className="group bg-slate-900 border border-slate-800 hover:border-sky-500/50 rounded-xl p-5 transition-all space-y-3 hover:shadow-xl hover:shadow-sky-500/10"
          >
            <div className="w-10 h-10 rounded-xl bg-sky-600/10 border border-sky-500/20 flex items-center justify-center text-sky-400 group-hover:bg-sky-600 group-hover:text-white transition-all">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white group-hover:text-sky-400 transition-colors">
                  إيداعات العملاء والتحقق
                </h3>
                <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-sky-400 transition-colors" />
              </div>
              <p className="text-xs text-slate-400 mt-1">
                اعتماد وتغذية إيداعات العملاء، فحص الإيصالات بالذكاء الاصطناعي، ومطابقة الحوالات.
              </p>
            </div>
          </Link>

          {/* Reconciliation */}
          <Link
            href="/reconciliation"
            className="group bg-slate-900 border border-slate-800 hover:border-violet-500/50 rounded-xl p-5 transition-all space-y-3 hover:shadow-xl hover:shadow-violet-500/10"
          >
            <div className="w-10 h-10 rounded-xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center text-violet-400 group-hover:bg-violet-600 group-hover:text-white transition-all">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white group-hover:text-violet-400 transition-colors">
                  المطابقة والتسوية المالية
                </h3>
                <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-violet-400 transition-colors" />
              </div>
              <p className="text-xs text-slate-400 mt-1">
                المطابقة الثلاثية اليومية بين حسابات البنوك، إيداعات العملاء، ودفتر الأستاذ العام.
              </p>
            </div>
          </Link>

          {/* Live Operations */}
          <Link
            href="/operations"
            className="group bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-xl p-5 transition-all space-y-3 hover:shadow-xl hover:shadow-emerald-500/10"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-all">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white group-hover:text-emerald-400 transition-colors">
                  مراقبة المنافذ والأنظمة
                </h3>
                <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
              </div>
              <p className="text-xs text-slate-400 mt-1">
                الحالة التشغيلية المباشرة للمنافذ 4000، 3000، 3001، 8081 وقاعدة البيانات وGemini AI.
              </p>
            </div>
          </Link>

          {/* SaaS Super Admin */}
          <Link
            href="/saas"
            className="group bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-xl p-5 transition-all space-y-3 hover:shadow-xl hover:shadow-indigo-500/10"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white group-hover:text-indigo-400 transition-colors">
                  منصات SaaS والشركات
                </h3>
                <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition-colors" />
              </div>
              <p className="text-xs text-slate-400 mt-1">
                التحكم المركزي في الشركات المشتركة، الباقات، التراخيص، وإدارة المستأجرين (Multi-Tenancy).
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
