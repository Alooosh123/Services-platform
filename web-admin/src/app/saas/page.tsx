'use client';

import { useState, useEffect } from 'react';
import {
  Building2,
  Users,
  CreditCard,
  ShieldCheck,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
  Layers,
  Key,
  Calendar,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import { formatMoney, isolate } from '../../lib/format';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  customDomain: string | null;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  status: 'ACTIVE' | 'PENDING_SETUP' | 'SUSPENDED' | 'TERMINATED';
  licenseKey: string;
  notes: string | null;
  createdAt: string;
  subscriptions: Array<{
    id: string;
    billingCycle: string;
    pricePaid: string;
    status: string;
    endDate: string;
    plan: {
      nameAr: string;
      name: string;
    };
  }>;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    amount: string;
    status: string;
    dueDate: string;
  }>;
}

interface SaaSPlan {
  id: string;
  name: string;
  nameAr: string;
  billingCycle: string;
  durationDays: number;
  priceUsd: string;
  priceYer: string;
  priceSar: string;
  descriptionAr: string;
  featuresJson: string[];
}

export default function AdminSaaSPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [plans, setPlans] = useState<SaaSPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // New Tenant Modal State
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    domain: '',
    ownerName: '',
    ownerEmail: '',
    ownerPhone: '',
    planId: '',
    notes: '',
  });

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

  const getHeaders = () => {
    const token = typeof window !== 'undefined'
      ? localStorage.getItem('admin_token') || localStorage.getItem('token') || ''
      : '';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [tenantsRes, plansRes] = await Promise.all([
        fetch(`${API_URL}/saas/admin/tenants`, { credentials: 'omit', headers: getHeaders() }),
        fetch(`${API_URL}/saas/plans`, { credentials: 'omit' }),
      ]);

      if (plansRes.ok) {
        const plansData = await plansRes.json();
        setPlans(plansData);
        if (plansData.length > 0 && !formData.planId) {
          setFormData((prev) => ({ ...prev, planId: plansData[0].id }));
        }
      }

      if (tenantsRes.ok) {
        const tenantsData = await tenantsRes.json();
        setTenants(Array.isArray(tenantsData) ? tenantsData : []);
      }
    } catch (err: any) {
      console.warn('Error loading SaaS data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch(`${API_URL}/saas/admin/tenants`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'فشل إنشاء الشركة المشتركة');
      }
      setFeedback({ type: 'success', message: `تم تفعيل اشتراك شركة "${formData.name}" بنجاح!` });
      setShowModal(false);
      setFormData({
        name: '',
        slug: '',
        domain: '',
        ownerName: '',
        ownerEmail: '',
        ownerPhone: '',
        planId: plans[0]?.id || '',
        notes: '',
      });
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (tenantId: string, newStatus: 'ACTIVE' | 'SUSPENDED' | 'TERMINATED') => {
    try {
      const res = await fetch(`${API_URL}/saas/admin/tenants/${tenantId}/status`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ status: newStatus, reason: `Admin console action at ${new Date().toISOString()}` }),
      });
      if (res.ok) {
        setFeedback({ type: 'success', message: `تم تحديث حالة الشركة إلى ${newStatus}` });
        await loadData();
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'تعذر تعديل حالة الشركة' });
    }
  };

  const filteredTenants = tenants.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase()) ||
      t.ownerEmail.toLowerCase().includes(search.toLowerCase()) ||
      t.licenseKey.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const activeCount = tenants.filter((t) => t.status === 'ACTIVE').length;
  const suspendedCount = tenants.filter((t) => t.status === 'SUSPENDED').length;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Banner */}
      <div className="glass-panel rounded-2xl p-6 bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-slate-900 border border-indigo-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">إدارة منصات SaaS والشركات المشتركة</h1>
              <p className="text-sm text-slate-400 mt-1">
                التحكم المركزي في المتاجر متعددة المستأجرين (Multi-Tenant)، الباقات، التراخيص، والاشتراكات.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-sm font-semibold border border-slate-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            تحديث
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-sky-500 hover:from-indigo-600 hover:to-sky-600 text-white text-sm font-bold shadow-lg shadow-indigo-500/25 transition"
          >
            <Plus className="w-4 h-4" />
            تسجيل شركة جديدة (Onboard)
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between border ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            <span className="font-semibold">{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-xs hover:underline">
            إغلاق
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-xl border border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between text-slate-400 text-sm">
            <span>إجمالي الشركات</span>
            <Building2 className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-3xl font-black text-white mt-2">{tenants.length}</div>
          <div className="text-xs text-sky-400 mt-1">متاجر مسجلة في المنصة</div>
        </div>

        <div className="glass-panel p-5 rounded-xl border border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between text-slate-400 text-sm">
            <span>الاشتراكات النشطة</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-black text-emerald-400 mt-2">{activeCount}</div>
          <div className="text-xs text-slate-400 mt-1">تراخيص تعمل بدون قيود</div>
        </div>

        <div className="glass-panel p-5 rounded-xl border border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between text-slate-400 text-sm">
            <span>الشركات المعلقة</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-black text-amber-400 mt-2">{suspendedCount}</div>
          <div className="text-xs text-slate-400 mt-1">تتطلب تسوية أو تجديد</div>
        </div>

        <div className="glass-panel p-5 rounded-xl border border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between text-slate-400 text-sm">
            <span>باقات SaaS المتاحة</span>
            <Layers className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-3xl font-black text-purple-400 mt-2">{plans.length}</div>
          <div className="text-xs text-slate-400 mt-1">أسبوعية، شهرية، وسنوية</div>
        </div>
      </div>

      {/* Available Plans Strip */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 bg-slate-900/40">
        <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-400" />
          باقات الاشتراك المعتمدة (SaaS Plans Matrix)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 hover:border-indigo-500/40 transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-white text-base">{plan.nameAr}</span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {plan.billingCycle}
                  </span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-emerald-400">
                    {isolate(`$${plan.priceUsd}`)}
                  </span>
                  <span className="text-xs text-slate-400">/ {plan.durationDays} يوم</span>
                </div>
                <p className="text-xs text-slate-400 mt-2">{plan.descriptionAr}</p>
                <div className="mt-3 space-y-1">
                  {(Array.isArray(plan.featuresJson) ? plan.featuresJson : []).map((feat, i) => (
                    <div key={i} className="text-xs text-slate-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tenants Table Controls */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:w-96">
          <Search className="absolute right-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم، المعرف slug، الإيميل، أو مفتاح الترخيص..."
            className="w-full pl-4 pr-10 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          {['ALL', 'ACTIVE', 'SUSPENDED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
              }`}
            >
              {st === 'ALL' ? 'جميع الشركات' : st === 'ACTIVE' ? 'نشطة فقط' : 'معلقة فقط'}
            </button>
          ))}
        </div>
      </div>

      {/* Tenants Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden bg-slate-900/60">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800 text-xs">
              <tr>
                <th className="py-3.5 px-4">الشركة والمطعم</th>
                <th className="py-3.5 px-4">النطاق / الرابط</th>
                <th className="py-3.5 px-4">المالك وبيانات الاتصال</th>
                <th className="py-3.5 px-4">الباقة والاشتراك</th>
                <th className="py-3.5 px-4">مفتاح الترخيص</th>
                <th className="py-3.5 px-4">الحالة</th>
                <th className="py-3.5 px-4">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                    جاري تحميل بيانات المستأجرين والشركات...
                  </td>
                </tr>
              ) : filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Building2 className="w-10 h-10 mx-auto mb-2 text-slate-600" />
                    لم يتم العثور على أي شركات مشتركة مسجلة. انقر على &quot;تسجيل شركة جديدة&quot; للبدء.
                  </td>
                </tr>
              ) : (
                filteredTenants.map((tenant) => {
                  const latestSub = tenant.subscriptions?.[0];
                  return (
                    <tr key={tenant.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-4 px-4 font-bold text-white">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-black text-xs">
                            {tenant.name.slice(0, 2)}
                          </div>
                          <div>
                            <div>{tenant.name}</div>
                            <span className="text-[11px] font-mono text-slate-400">{tenant.slug}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4 text-xs font-mono text-sky-400">
                        <a
                          href={`http://${tenant.domain || `${tenant.slug}.digitaltopup.ye`}`}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline flex items-center gap-1"
                        >
                          {tenant.domain || `${tenant.slug}.digitaltopup.ye`}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>

                      <td className="py-4 px-4 text-xs">
                        <div className="font-semibold text-slate-200">{tenant.ownerName}</div>
                        <div className="text-slate-400">{tenant.ownerEmail}</div>
                        <div className="text-slate-500 font-mono" dir="ltr">
                          {tenant.ownerPhone}
                        </div>
                      </td>

                      <td className="py-4 px-4 text-xs">
                        {latestSub ? (
                          <div>
                            <span className="font-bold text-white">{latestSub.plan?.nameAr || 'خطة SaaS'}</span>
                            <div className="text-slate-400">
                              ينتهي: {new Date(latestSub.endDate).toLocaleDateString('ar-EG')}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-500">لا يوجد اشتراك نشط</span>
                        )}
                      </td>

                      <td className="py-4 px-4 font-mono text-[11px] text-slate-400">
                        <span className="bg-slate-950 px-2 py-1 rounded border border-slate-800 select-all">
                          {tenant.licenseKey}
                        </span>
                      </td>

                      <td className="py-4 px-4 text-xs">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold ${
                            tenant.status === 'ACTIVE'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {tenant.status === 'ACTIVE' ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" /> نشط ومفعل
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="w-3 h-3" /> معلق مؤقتاً
                            </>
                          )}
                        </span>
                      </td>

                      <td className="py-4 px-4 text-xs">
                        {tenant.status === 'ACTIVE' ? (
                          <button
                            onClick={() => handleStatusChange(tenant.id, 'SUSPENDED')}
                            className="text-amber-400 hover:text-amber-300 font-semibold px-2 py-1 bg-amber-500/10 rounded hover:bg-amber-500/20 transition"
                          >
                            تعليق الخدمة
                          </button>
                        ) : (
                          <button
                            onClick={() => handleStatusChange(tenant.id, 'ACTIVE')}
                            className="text-emerald-400 hover:text-emerald-300 font-semibold px-2 py-1 bg-emerald-500/10 rounded hover:bg-emerald-500/20 transition"
                          >
                            تفعيل الحساب
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Onboarding Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" dir="rtl">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl relative">
            <h3 className="text-xl font-black text-white mb-1 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-400" />
              تسجيل شركة SaaS جديدة
            </h3>
            <p className="text-xs text-slate-400 mb-5">
              سيتم إنشاء حساب الشركة تلقائياً مع توليد مفتاح ترخيص (License Key) وتفعيل المتجر الفرعي.
            </p>

            <form onSubmit={handleCreateTenant} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">اسم الشركة / المتجر *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="مثال: متجر صقر الشحن"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">المعرف الفرعي (Slug) *</label>
                  <input
                    type="text"
                    required
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                    placeholder="مثال: saqr-store"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">اسم مالك الشركة *</label>
                  <input
                    type="text"
                    required
                    value={formData.ownerName}
                    onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                    placeholder="الاسم الثلاثي"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">البريد الإلكتروني *</label>
                  <input
                    type="email"
                    required
                    value={formData.ownerEmail}
                    onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
                    placeholder="owner@domain.com"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">رقم الهاتف *</label>
                  <input
                    type="text"
                    required
                    value={formData.ownerPhone}
                    onChange={(e) => setFormData({ ...formData, ownerPhone: e.target.value })}
                    placeholder="770000000"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">باقة الاشتراك الأولى *</label>
                <select
                  value={formData.planId}
                  onChange={(e) => setFormData({ ...formData, planId: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nameAr} - ${p.priceUsd} ({p.billingCycle})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">ملاحظات داخلية</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="أي شروط أو ميزات متفق عليها خاصة بهذا المستأجر..."
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/30 disabled:opacity-50"
                >
                  {submitting ? 'جاري التسجيل...' : 'تأكيد التسجيل وتفعيل الاشتراك'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
