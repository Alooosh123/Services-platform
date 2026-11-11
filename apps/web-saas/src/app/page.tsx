'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

const API = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/$/, '');
type Row = Record<string, any>;

async function api(path: string, token: string, init: RequestInit = {}) {
  const response = await fetch(API + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, ...(init.headers || {}) },
    cache: 'no-store',
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || 'HTTP ' + response.status);
  return data;
}
function list(value: any): Row[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  return [];
}
function fmtDate(value?: string) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('ar', { year: 'numeric', month: 'short', day: 'numeric' });
}
function fmtMoney(value: any, currency = 'USD') {
  const n = Number(value);
  return Number.isFinite(n) ? new Intl.NumberFormat('ar', { maximumFractionDigits: 2 }).format(n) + ' ' + currency : '—';
}
function label(value?: string) {
  const map: Record<string, string> = { ACTIVE: 'نشط', SUSPENDED: 'موقوف', TERMINATED: 'منتهٍ', PENDING: 'معلق', OVERDUE: 'متأخر', PAID: 'مدفوع', EXPIRED: 'منتهي', OPERATIONAL: 'يعمل', DEGRADED: 'يحتاج مراجعة' };
  return value ? (map[value] || value) : '—';
}
function Badge({ value }: { value?: string }) {
  const good = ['ACTIVE', 'PAID', 'OPERATIONAL'].includes(value || '');
  const bad = ['SUSPENDED', 'TERMINATED', 'OVERDUE', 'EXPIRED', 'DEGRADED'].includes(value || '');
  const cls = good ? 'bg-emerald-500/10 text-emerald-300' : bad ? 'bg-rose-500/10 text-rose-300' : 'bg-amber-500/10 text-amber-300';
  return <span className={'rounded-full px-3 py-1 text-xs font-bold ' + cls}>{label(value)}</span>;
}
function Input({ title, value, set, type = 'text', placeholder = '' }: { title: string; value: string; set: (v: string) => void; type?: string; placeholder?: string }) {
  return <label className="block space-y-2"><span className="text-xs font-semibold text-slate-400">{title}</span><input type={type} value={value} onChange={e => set(e.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-violet-500" /></label>;
}

export default function SaaSPage() {
  const [token, setToken] = useState('');
  const [user, setUser] = useState<Row | null>(null);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [mfa, setMfa] = useState('');
  const [step, setStep] = useState<'credentials' | 'mfa'>('credentials');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState('overview');
  const [kpi, setKpi] = useState<Row | null>(null);
  const [system, setSystem] = useState<Row | null>(null);
  const [tenants, setTenants] = useState<Row[]>([]);
  const [subscriptions, setSubscriptions] = useState<Row[]>([]);
  const [invoices, setInvoices] = useState<Row[]>([]);
  const [plans, setPlans] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', ownerName: '', ownerEmail: '', ownerPhone: '', billingCycle: 'MONTHLY', currency: 'USD', domain: '', notes: '' });

  const load = useCallback(async (auth: string) => {
    setBusy(true); setError('');
    try {
      const result = await Promise.all([
        api('/saas/kpis', auth), api('/saas/system-status', auth), api('/saas/tenants', auth),
        api('/saas/subscriptions', auth), api('/saas/invoices', auth), api('/saas/plans', auth),
      ]);
      setKpi(result[0]); setSystem(result[1]); setTenants(list(result[2]));
      setSubscriptions(list(result[3])); setInvoices(list(result[4])); setPlans(list(result[5]));
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذر تحميل بيانات المنصة'); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('saas_admin_token');
    const profile = localStorage.getItem('saas_admin_user');
    if (saved && profile) {
      try {
        const parsed = JSON.parse(profile);
        if (parsed.role === 'SUPER_ADMIN') { setToken(saved); setUser(parsed); }
        else { localStorage.removeItem('saas_admin_token'); localStorage.removeItem('saas_admin_user'); }
      } catch { localStorage.removeItem('saas_admin_token'); localStorage.removeItem('saas_admin_user'); }
    }
  }, []);
  useEffect(() => { if (token && user?.role === 'SUPER_ADMIN') void load(token); }, [token, user, load]);

  const filtered = useMemo(() => tenants.filter(t => [t.name, t.slug, t.ownerName, t.ownerEmail, t.ownerPhone].join(' ').toLowerCase().includes(search.toLowerCase())), [tenants, search]);

  function saveSession(access: string, profile: Row) {
    if (profile?.role !== 'SUPER_ADMIN') throw new Error('هذه البوابة مخصصة لمسؤول المنصة الأعلى فقط.');
    localStorage.setItem('saas_admin_token', access); localStorage.setItem('saas_admin_user', JSON.stringify(profile));
    setToken(access); setUser(profile); setStep('credentials'); setPassword(''); setMfa('');
  }
  async function login(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch(API + '/auth/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier, password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'تعذر تسجيل الدخول');
      if (data.requiresMfa && data.tempToken) { setTempToken(data.tempToken); setStep('mfa'); }
      else if (data.tokens?.accessToken) saveSession(data.tokens.accessToken, data.user);
      else throw new Error('لم يُرجع الخادم جلسة مصادقة صالحة.');
    } catch (e) { setError(e instanceof Error ? e.message : 'فشل تسجيل الدخول'); }
    finally { setBusy(false); }
  }
  async function verifyMfa(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch(API + '/auth/admin/verify-mfa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tempToken, code: mfa }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'رمز التحقق غير صحيح');
      if (!data.tokens?.accessToken) throw new Error('لم يُرجع الخادم رمز جلسة صالحاً.');
      saveSession(data.tokens.accessToken, data.user);
    } catch (e) { setError(e instanceof Error ? e.message : 'فشل التحقق'); }
    finally { setBusy(false); }
  }
  async function logout() {
    try { if (token) await api('/auth/logout', token, { method: 'POST' }); } catch {}
    localStorage.removeItem('saas_admin_token'); localStorage.removeItem('saas_admin_user');
    setToken(''); setUser(null); setKpi(null);
  }
  async function createTenant(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const payload = { ...form, domain: form.domain.trim() || undefined, notes: form.notes.trim() || undefined };
      await api('/saas/tenants', token, { method: 'POST', body: JSON.stringify(payload) });
      setNotice('تم إنشاء المتجر وإصدار فاتورته الأولية. لم يتم تفعيل أي قناة دفع تلقائياً.');
      setCreateOpen(false);
      setForm({ name: '', slug: '', ownerName: '', ownerEmail: '', ownerPhone: '', billingCycle: 'MONTHLY', currency: 'USD', domain: '', notes: '' });
      await load(token);
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذر إنشاء المتجر'); }
    finally { setBusy(false); }
  }
  async function changeStatus(tenant: Row, status: string) {
    const reason = window.prompt('سبب تغيير حالة المتجر (مطلوب للتدقيق):');
    if (!reason?.trim()) return;
    setBusy(true);
    try {
      await api('/saas/tenants/' + tenant.id + '/status', token, { method: 'PATCH', body: JSON.stringify({ status, reason }) });
      setNotice('تم تحديث الحالة وتسجيل العملية في سجل التدقيق.'); await load(token);
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذر تحديث الحالة'); }
    finally { setBusy(false); }
  }
  async function markPaid(invoice: Row) {
    const paymentMethod = window.prompt('طريقة الدفع بعد التحقق (مثال: JAIB_MANUAL):');
    if (!paymentMethod?.trim()) return;
    const referenceNumber = window.prompt('رقم مرجع الحوالة:');
    if (!referenceNumber?.trim() || !window.confirm('هل تحققت فعلياً من وصول المبلغ ومطابقته؟')) return;
    setBusy(true);
    try {
      await api('/saas/invoices/' + invoice.id + '/mark-paid', token, { method: 'POST', body: JSON.stringify({ paymentMethod, referenceNumber }) });
      setNotice('تم تأكيد الفاتورة عبر الخادم.'); await load(token);
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذر تأكيد الفاتورة'); }
    finally { setBusy(false); }
  }

  async function editPlan(plan: Row) {
    const usd = window.prompt('السعر بالدولار USD:', String(plan.priceUsd ?? ''));
    if (usd === null) return;
    const yer = window.prompt('السعر بالريال اليمني YER:', String(plan.priceYer ?? ''));
    if (yer === null) return;
    const sar = window.prompt('السعر بالريال السعودي SAR:', String(plan.priceSar ?? ''));
    if (sar === null) return;
    const values = [Number(usd), Number(yer), Number(sar)];
    if (values.some(v => !Number.isFinite(v) || v < 0)) { setError('أدخل أسعاراً رقمية صحيحة غير سالبة.'); return; }
    setBusy(true); setError('');
    try {
      await api('/saas/plans/' + plan.id + '/price', token, { method: 'PUT', body: JSON.stringify({ priceUsd: values[0], priceYer: values[1], priceSar: values[2] }) });
      setNotice('تم تحديث أسعار الخطة. الأسعار التاريخية للطلبات والاشتراكات لا تتغير.');
      await load(token);
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذر تحديث الأسعار'); }
    finally { setBusy(false); }
  }

  if (!token || !user) return <main dir="rtl" className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white">
    <form onSubmit={step === 'credentials' ? login : verifyMfa} className="w-full max-w-md space-y-6 rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
      <div className="text-center"><div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/15 text-2xl text-violet-300">◆</div><p className="text-xs font-bold tracking-widest text-violet-300">SAAS CONTROL CENTER</p><h1 className="mt-2 text-2xl font-black">مركز إدارة المنصة</h1><p className="mt-2 text-sm text-slate-400">دخول آمن لمسؤول المنصة الأعلى فقط</p></div>
      {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</div>}
      {step === 'credentials' ? <><Input title="البريد أو اسم المستخدم" value={identifier} set={setIdentifier} placeholder="admin@example.com" /><Input title="كلمة المرور" value={password} set={setPassword} type="password" /></> : <Input title="رمز المصادقة (6 أرقام)" value={mfa} set={v => setMfa(v.replace(/\D/g, '').slice(0, 6))} placeholder="000000" />}
      <button disabled={busy} className="w-full rounded-xl bg-violet-600 py-3 font-bold hover:bg-violet-500 disabled:opacity-50">{busy ? 'جارٍ التحقق…' : step === 'credentials' ? 'متابعة إلى التحقق الثنائي' : 'تأكيد الدخول'}</button>
      {step === 'mfa' && <button type="button" onClick={() => { setStep('credentials'); setTempToken(''); }} className="w-full text-sm text-slate-400">العودة</button>}
      <p className="text-center text-xs leading-6 text-slate-500">لا توجد حسابات تجريبية أو كلمات مرور افتراضية. يلزم حساب إداري حقيقي ومصادقة ثنائية.</p>
    </form>
  </main>;

  const cards = [
    ['إجمالي المتاجر', kpi?.totalTenantsCount ?? '—', 'متجر مسجل'],
    ['الاشتراكات النشطة', kpi?.activeSubscribersCount ?? '—', 'اشتراك ساري'],
    ['الإيراد الشهري المتكرر', fmtMoney(kpi?.monthlyRecurringRevenueUsd), 'اشتراكات USD فقط دون تحويل ضمني'],
    ['الفواتير المعلقة', fmtMoney(kpi?.pendingInvoicesAmountUsd), 'USD فقط'],
    ['اشتراكات منتهية', kpi?.expiredSubscriptionsCount ?? '—', 'تحتاج متابعة'],
    ['نسبة الاشتراكات النشطة', kpi ? String(kpi.retentionRatePercent ?? 0) + '%' : '—', 'مؤشر تشغيلي'],
  ];
  const tabs = [['overview', 'نظرة عامة'], ['tenants', 'المتاجر'], ['subscriptions', 'الاشتراكات'], ['invoices', 'الفواتير'], ['plans', 'الخطط']];
  return <main dir="rtl" className="min-h-screen bg-slate-950 text-white">
    <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/95 backdrop-blur"><div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6"><div><p className="text-xs font-bold tracking-widest text-violet-300">DIGITAL TOPUP · SAAS</p><h1 className="mt-1 text-lg font-black">مركز إدارة المنصة</h1></div><div className="flex items-center gap-3"><span className="hidden text-xs text-slate-400 sm:block">{user.fullName || user.email || 'مسؤول المنصة'}</span><button onClick={() => void load(token)} disabled={busy} className="rounded-xl border border-slate-700 px-3 py-2 text-xs hover:bg-slate-800">تحديث</button><button onClick={logout} className="rounded-xl bg-slate-800 px-3 py-2 text-xs">خروج</button></div></div></header>
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {error && <div className="mb-4 flex justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}<button onClick={() => setError('')}>×</button></div>}
      {notice && <div className="mb-4 flex justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{notice}<button onClick={() => setNotice('')}>×</button></div>}
      <section className="mb-6 rounded-2xl border border-slate-800 bg-gradient-to-l from-violet-950/60 to-slate-900 p-5 sm:p-7"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm text-violet-200">لوحة التحكم المركزية متعددة المتاجر</p><h2 className="mt-2 text-2xl font-black sm:text-3xl">إدارة أعمال المنصة من مكان واحد</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">إدارة المتاجر والتراخيص والاشتراكات والفواتير ومتابعة حالة المحرك. التغييرات الحساسة تنفذ عبر API المحمي.</p></div><div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm"><div className="text-xs text-slate-400">حالة المحرك</div><div className="mt-1 font-bold"><Badge value={system?.status}/></div><div className="mt-1 text-xs text-slate-500">الإصدار {system?.version || '—'}</div></div></div></section>
      <nav className="mb-6 flex gap-2 overflow-x-auto pb-1">{tabs.map(([id, title]) => <button key={id} onClick={() => setTab(id)} className={'shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold ' + (tab === id ? 'bg-violet-600 text-white' : 'border border-slate-800 bg-slate-900 text-slate-400')}>{title}</button>)}</nav>
      {tab === 'overview' && <><section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{cards.map(([title, value, hint]) => <article key={title} className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><p className="text-sm text-slate-400">{title}</p><p className="mt-3 text-2xl font-black tabular-nums">{value}</p><p className="mt-2 text-xs text-slate-500">{hint}</p></article>)}</section><section className="mt-5 grid gap-4 lg:grid-cols-2"><article className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><h3 className="font-bold">صحة المنصة</h3><div className="mt-4 grid grid-cols-2 gap-3 text-sm">{[['المتاجر النشطة', system?.activeTenantsCount], ['إجمالي المتاجر', system?.totalTenantsCount], ['مزودو الخدمة النشطون', system?.activeProvidersCount], ['بوابات الدفع الحقيقية', system?.activeGatewaysCount]].map(([name, value]) => <div key={String(name)} className="rounded-xl bg-slate-950 p-3"><span className="text-xs text-slate-500">{name}</span><p className="mt-1 text-xl font-bold">{value ?? '—'}</p></div>)}</div><p className="mt-3 text-xs text-slate-500">سياسة الصلاحيات المتساوية: {system?.equalPermissionsPolicy === 'STRICTLY_ENFORCED' ? 'مطبقة' : 'تحتاج مراجعة'}</p></article><article className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><h3 className="font-bold">توزيع الاشتراكات</h3><div className="mt-4 space-y-4">{[['أسبوعي', kpi?.weeklySubscriptionsCount], ['شهري', kpi?.monthlySubscriptionsCount], ['سنوي', kpi?.annualSubscriptionsCount]].map(([name, value]) => <div key={String(name)}><div className="mb-1 flex justify-between text-sm"><span className="text-slate-400">{name}</span><b>{value ?? '—'}</b></div><div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-violet-500" style={{ width: Math.min(100, Number(value || 0) / Math.max(1, Number(kpi?.activeSubscribersCount || 1)) * 100) + '%' }} /></div></div>)}</div></article></section></>}
      {tab === 'tenants' && <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-6"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-bold">المتاجر والعملاء المشتركون</h3><p className="mt-1 text-xs text-slate-400">بيانات المالك والترخيص وحالة المتجر</p></div><button onClick={() => setCreateOpen(!createOpen)} className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold">+ إضافة متجر</button></div>
        {createOpen && <form onSubmit={createTenant} className="mb-6 grid gap-3 rounded-xl border border-slate-700 bg-slate-950 p-4 sm:grid-cols-2">
          <Input title="اسم المتجر" value={form.name} set={v => setForm(p => ({ ...p, name: v }))}/><Input title="المعرف المختصر (slug)" value={form.slug} set={v => setForm(p => ({ ...p, slug: v }))}/><Input title="اسم المالك" value={form.ownerName} set={v => setForm(p => ({ ...p, ownerName: v }))}/><Input title="البريد الإلكتروني" value={form.ownerEmail} set={v => setForm(p => ({ ...p, ownerEmail: v }))} type="email"/><Input title="رقم الهاتف" value={form.ownerPhone} set={v => setForm(p => ({ ...p, ownerPhone: v }))}/><Input title="النطاق (اختياري)" value={form.domain} set={v => setForm(p => ({ ...p, domain: v }))}/>
          <label className="space-y-2 text-xs text-slate-400">دورة الاشتراك<select value={form.billingCycle} onChange={e => setForm(p => ({ ...p, billingCycle: e.target.value }))} className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm text-white"><option value="WEEKLY">أسبوعي</option><option value="MONTHLY">شهري</option><option value="ANNUAL">سنوي</option></select></label>
          <label className="space-y-2 text-xs text-slate-400">العملة<select value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))} className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm text-white"><option>USD</option><option>YER</option><option>SAR</option></select></label>
          <div className="sm:col-span-2"><Input title="ملاحظات" value={form.notes} set={v => setForm(p => ({ ...p, notes: v }))}/></div>
          <div className="flex gap-2 sm:col-span-2"><button disabled={busy} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold disabled:opacity-50">إنشاء المتجر والفاتورة</button><button type="button" onClick={() => setCreateOpen(false)} className="rounded-xl bg-slate-800 px-4 py-2 text-sm">إلغاء</button></div>
          <p className="text-xs leading-5 text-amber-300 sm:col-span-2">إنشاء المتجر لا يثبت ملكية المالك ولا يفعّل قنوات الدفع. إسناد المالك يتطلب تحقق هوية ومرجع تدقيق منفصل.</p>
        </form>}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث بالاسم أو المعرّف أو المالك…" className="mb-4 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-violet-500"/>
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-right text-sm"><thead className="text-xs text-slate-500"><tr><th className="p-3">المتجر</th><th className="p-3">المالك</th><th className="p-3">الاشتراك</th><th className="p-3">الحالة</th><th className="p-3">الإنشاء</th><th className="p-3">تغيير الحالة</th></tr></thead><tbody>{filtered.map(t => <tr key={t.id} className="border-t border-slate-800"><td className="p-3"><b>{t.name}</b><div className="text-xs text-slate-500">{t.slug} · {t.domain || 'بدون نطاق'}</div></td><td className="p-3">{t.ownerName}<div className="text-xs text-slate-500">{t.ownerEmail}</div></td><td className="p-3">{t.currentSubscription?.planName || t.currentSubscription?.billingCycle || '—'}</td><td className="p-3"><Badge value={t.status}/></td><td className="p-3">{fmtDate(t.createdAt)}</td><td className="p-3"><select value={t.status} onChange={e => void changeStatus(t, e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-xs"><option value="ACTIVE">نشط</option><option value="SUSPENDED">تعليق</option><option value="TERMINATED">إنهاء</option></select></td></tr>)}</tbody></table>{filtered.length === 0 && <p className="p-8 text-center text-sm text-slate-500">لا توجد متاجر مطابقة.</p>}</div></section>}
      {tab === 'subscriptions' && <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-6"><h3 className="mb-4 text-lg font-bold">الاشتراكات</h3><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-right text-sm"><thead className="text-xs text-slate-500"><tr><th className="p-3">المتجر</th><th className="p-3">الدورة</th><th className="p-3">القيمة</th><th className="p-3">البداية</th><th className="p-3">النهاية</th><th className="p-3">الحالة</th></tr></thead><tbody>{subscriptions.map(s => <tr key={s.id} className="border-t border-slate-800"><td className="p-3">{s.tenantName || s.tenantId}</td><td className="p-3">{s.billingCycle}</td><td className="p-3">{fmtMoney(s.pricePaid, s.currency)}</td><td className="p-3">{fmtDate(s.startDate)}</td><td className="p-3">{fmtDate(s.endDate)}</td><td className="p-3"><Badge value={s.status}/></td></tr>)}</tbody></table>{subscriptions.length === 0 && <p className="p-8 text-center text-slate-500">لا توجد اشتراكات.</p>}</div></section>}
      {tab === 'invoices' && <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-6"><h3 className="mb-4 text-lg font-bold">فواتير الاشتراكات</h3><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-right text-sm"><thead className="text-xs text-slate-500"><tr><th className="p-3">رقم الفاتورة</th><th className="p-3">المتجر</th><th className="p-3">المبلغ</th><th className="p-3">الاستحقاق</th><th className="p-3">الحالة</th><th className="p-3">الإجراء</th></tr></thead><tbody>{invoices.map(i => <tr key={i.id} className="border-t border-slate-800"><td className="p-3 font-mono text-xs">{i.invoiceNumber}</td><td className="p-3">{i.tenantName || i.tenantId}</td><td className="p-3 font-bold">{fmtMoney(i.amount, i.currency)}</td><td className="p-3">{fmtDate(i.dueDate)}</td><td className="p-3"><Badge value={i.status}/></td><td className="p-3">{['PENDING', 'OVERDUE'].includes(i.status) ? <button onClick={() => void markPaid(i)} disabled={busy} className="rounded-lg bg-emerald-600/15 px-3 py-2 text-xs font-bold text-emerald-300">تأكيد بعد المطابقة</button> : '—'}</td></tr>)}</tbody></table>{invoices.length === 0 && <p className="p-8 text-center text-slate-500">لا توجد فواتير.</p>}</div><p className="mt-4 text-xs leading-5 text-amber-300">لا تؤكد الفاتورة إلا بعد التحقق من وصول الحوالة فعلياً ومطابقة مرجعها. الخادم يطبق الصلاحيات ويسجل العملية.</p></section>}
      {tab === 'plans' && <section className="grid gap-4 md:grid-cols-3">{plans.map(p => <article key={p.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><div className="flex items-center justify-between"><h3 className="font-bold">{p.nameAr || p.name}</h3><Badge value={p.isActive ? 'ACTIVE' : 'SUSPENDED'}/></div><p className="mt-2 text-xs text-slate-400">{p.durationDays} يوم · {p.activeSubscribersCount || 0} مشترك</p><div className="mt-5 space-y-2 text-sm"><p>USD: <b>{fmtMoney(p.priceUsd, 'USD')}</b></p><p>YER: <b>{fmtMoney(p.priceYer, 'YER')}</b></p><p>SAR: <b>{fmtMoney(p.priceSar, 'SAR')}</b></p></div><p className="mt-4 text-xs text-slate-500">{p.descriptionAr || 'صلاحيات المنصة الكاملة وفق سياسة الخطط الموحدة.'}</p><button onClick={() => void editPlan(p)} disabled={busy} className="mt-5 w-full rounded-xl border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-sm font-bold text-violet-200 hover:bg-violet-500/20">تعديل أسعار العملات الثلاث</button></article>)}{plans.length === 0 && <p className="text-sm text-slate-500">لا توجد خطط.</p>}</section>}
      <footer className="mt-8 flex flex-wrap justify-between gap-2 border-t border-slate-800 pt-4 text-xs text-slate-500"><span>آخر تحديث: {fmtDate(kpi?.timestamp)}</span><span>واجهة مستقلة · الصلاحيات مفروضة من الخادم</span></footer>
    </div>
  </main>;
}
