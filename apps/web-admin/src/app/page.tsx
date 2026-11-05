'use client';

import { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import {
  DollarSign,
  TrendingUp,
  Package,
  Clock,
  ArrowUpLeft,
  Server,
} from 'lucide-react';

export default function AdminDashboardPage() {
  const [data, setData] = useState<any>({
    kpis: {
      totalRevenue: '14,285.50',
      totalCost: '11,430.00',
      netProfit: '2,855.50',
      totalOrders: 142,
      completedOrders: 138,
      failedOrders: 4,
      successRate: '97.2',
      totalCustomers: 89,
      totalCustomerWalletLiabilities: '1,420.00',
    },
    providers: [
      { id: '1', code: 'MOCK', name: 'مزود الشحن التجريبي (Demo Mode)', balance: '10000.00', isActive: true },
      { id: '2', code: 'SMILE_ONE', name: 'بوابة Smile.one العالمية', balance: '0.00', isActive: false },
      { id: '3', code: 'UNIPIN', name: 'مزود القسائم UniPin API', balance: '0.00', isActive: false },
    ],
    recentOrders: [
      {
        id: 'ord-1',
        orderNumber: 'ORD-20261008-8491',
        user: { fullName: 'أحمد محمد', email: 'customer@gmail.com' },
        package: { name: '660 شدة (UC)', product: { game: { name: 'ببجي موبايل' } } },
        totalAmount: '10.49',
        status: 'مكتمل (COMPLETED)',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'ord-2',
        orderNumber: 'ORD-20261008-7712',
        user: { fullName: 'زيد علي', email: 'zaid@gaming.iq' },
        package: { name: '310 جوهرة', product: { game: { name: 'فري فاير' } } },
        totalAmount: '3.15',
        status: 'مكتمل (COMPLETED)',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'ord-3',
        orderNumber: 'ORD-20261008-5521',
        user: { fullName: 'مصطفى كامل', email: 'mustafa@test.com' },
        package: { name: '257 ماسة', product: { game: { name: 'موبايل ليجندز' } } },
        totalAmount: '4.30',
        status: 'قيد الشحن (PROCESSING)',
        createdAt: new Date().toISOString(),
      },
    ],
  });

  useEffect(() => {
    fetch('http://localhost:4000/api/reports/dashboard-kpis')
      .then((res) => (res.ok ? res.json() : null))
      .then((res) => {
        if (res && res.kpis) setData(res);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="text-right">
      <Header title="لوحة المؤشرات والتحليلات المالية" />

      <div className="p-8 space-y-8">
        {/* KPI Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">صافي الأرباح المحققة</span>
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-bold text-white font-mono">${data.kpis.netProfit}</h3>
              <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                <ArrowUpLeft className="w-3.5 h-3.5" /> هامش الربح المباشر من الشحنات
              </p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">إجمالي المبيعات (Revenue)</span>
              <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-bold text-white font-mono">${data.kpis.totalRevenue}</h3>
              <p className="text-xs text-slate-400 mt-1">تكلفة المزودين: ${data.kpis.totalCost}</p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">إجمالي طلبات الشحن</span>
              <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
                <Package className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-bold text-white font-mono">{data.kpis.totalOrders}</h3>
              <p className="text-xs text-emerald-400 mt-1">نسبة النجاح: {data.kpis.successRate}%</p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">التزامات المحافظ (أرصدة العملاء)</span>
              <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-bold text-white font-mono">${data.kpis.totalCustomerWalletLiabilities}</h3>
              <p className="text-xs text-slate-400 mt-1">موزعة على {data.kpis.totalCustomers} حساب عميل</p>
            </div>
          </div>
        </div>

        {/* Providers and Operations */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-bold text-white">شحنات وطلبات العملاء الأخيرة</h3>
                <p className="text-xs text-slate-400">متابعة فورية لدورة تنفيذ وتسليم الشحن</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs text-slate-400">
                    <th className="pb-3 font-medium">رقم الطلب</th>
                    <th className="pb-3 font-medium">العميل</th>
                    <th className="pb-3 font-medium">اللعبة والباقة</th>
                    <th className="pb-3 font-medium">المبلغ</th>
                    <th className="pb-3 font-medium">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {data.recentOrders.map((order: any) => (
                    <tr key={order.id} className="text-xs">
                      <td className="py-3.5 font-mono text-indigo-400 font-medium">{order.orderNumber}</td>
                      <td className="py-3.5 text-slate-300">{order.user?.fullName || 'عميل'}</td>
                      <td className="py-3.5 text-white">
                        {order.package?.product?.game?.name} - {order.package?.name}
                      </td>
                      <td className="py-3.5 font-bold font-mono text-white">${order.totalAmount}</td>
                      <td className="py-3.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Provider Balances Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-bold text-white">مزودو الشحن المتصلون</h3>
                <p className="text-xs text-slate-400">أرصدة حسابات الجملة Wholesale</p>
              </div>
              <Server className="w-4 h-4 text-indigo-400" />
            </div>

            <div className="space-y-4">
              {data.providers.map((p: any) => (
                <div key={p.id} className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{p.name}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                        p.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {p.isActive ? 'نشط (ACTIVE)' : 'جاهز للربط'}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-slate-400">رصيد الحساب:</span>
                    <span className="text-sm font-bold font-mono text-emerald-400">${p.balance}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
