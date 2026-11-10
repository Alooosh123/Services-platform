'use client';

import { FormEvent, useEffect, useState } from 'react';

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/+$/, '');

type AgentOperation = {
  id: string;
  direction: string;
  channelCode: string;
  status: string;
  expectedAmount: number | string;
  expectedCurrency: string;
  expectedReferenceNumber?: string | null;
  expectedAccountLastFour?: string | null;
  depositRequest?: {
    depositNumber: string;
    referenceNumber: string;
    amount: number;
    currency: string;
    senderName?: string | null;
    senderPhone?: string | null;
    senderAccount?: { id: string; identifierType: string; maskedIdentifier: string; status: string; identifier?: string | null } | null;
  } | null;
  payoutRequest?: {
    payoutNumber: string;
    status: string;
    amount: number;
    currency: string;
  } | null;
};

type VerificationForm = {
  observedAmount: string;
  observedCurrency: string;
  observedReferenceNumber: string;
  observedAccountLastFour: string;
  observedSenderIdentifier: string;
  evidenceReference: string;
  agentNotes: string;
};

const emptyForm: VerificationForm = {
  observedAmount: '',
  observedCurrency: 'YER',
  observedReferenceNumber: '',
  observedAccountLastFour: '',
  observedSenderIdentifier: '',
  evidenceReference: '',
  agentNotes: '',
};

export default function WalletAgentPage() {
  const [operations, setOperations] = useState<AgentOperation[]>([]);
  const [forms, setForms] = useState<Record<string, VerificationForm>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestApi = async (path: string, init: RequestInit = {}) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    if (!token) throw new Error('جلسة الموظف غير موجودة. سجّل الدخول بحساب وكيل المحافظ أولاً.');
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    if (init.body) headers.set('Content-Type', 'application/json');

    const response = await fetch(`${API_URL}${path}`, { ...init, headers });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message = Array.isArray(payload?.message)
        ? payload.message.join('، ')
        : payload?.message;
      throw new Error(message || `فشل الطلب (HTTP ${response.status})`);
    }
    return payload;
  };

  const loadQueue = async () => {
    setLoading(true);
    try {
      const data = await requestApi('/wallet-agent/operations/my-queue');
      if (!Array.isArray(data)) throw new Error('استجابة قائمة مهام الوكيل غير صالحة.');
      setOperations(data.filter((item: AgentOperation) => item.direction === 'INBOUND_DEPOSIT'));
      setError(null);
    } catch (e) {
      setOperations([]);
      setError(e instanceof Error ? e.message : 'تعذر تحميل مهام الوكيل.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadQueue();
  }, []);

  const updateForm = (id: string, field: keyof VerificationForm, value: string) => {
    setForms((current) => ({
      ...current,
      [id]: { ...(current[id] || emptyForm), [field]: value },
    }));
  };

  const claim = async (operation: AgentOperation) => {
    setBusyId(operation.id);
    try {
      await requestApi(`/wallet-agent/operations/${encodeURIComponent(operation.id)}/claim`, {
        method: 'POST',
      });
      // Keep all observed fields blank: the agent must independently read the provider's
      // official transaction history rather than simply resubmit the customer's expected values.
      setForms((current) => ({
        ...current,
        [operation.id]: { ...emptyForm, observedCurrency: '' },
      }));
      setNotice('تم استلام المهمة باسم حسابك. افحص سجل/كشف المحفظة الرسمي قبل إدخال بيانات المطابقة.');
      setError(null);
      await loadQueue();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر استلام المهمة.');
    } finally {
      setBusyId(null);
    }
  };

  const submit = async (event: FormEvent, operation: AgentOperation) => {
    event.preventDefault();
    const form = forms[operation.id] || emptyForm;
    const amount = Number(form.observedAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('أدخل المبلغ الظاهر فعلياً في سجل المحفظة.');
      return;
    }
    if (!/^[0-9]{4}$/.test(form.observedAccountLastFour)) {
      setError('أدخل آخر أربعة أرقام من حساب الاستقبال كما تظهر في سجل الحركة.');
      return;
    }
    if (!form.observedSenderIdentifier.trim()) {
      setError('أدخل معرّف حساب المرسل كما يظهر في سجل/كشف المحفظة الرسمي.');
      return;
    }
    if (form.observedReferenceNumber.trim().length < 5 || form.evidenceReference.trim().length < 5) {
      setError('رقم الحركة ومرجع مستند/كشف المطابقة مطلوبان.');
      return;
    }

    setBusyId(operation.id);
    try {
      const result = await requestApi(`/wallet-agent/operations/${encodeURIComponent(operation.id)}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          observedAmount: amount,
          observedCurrency: form.observedCurrency,
          observedReferenceNumber: form.observedReferenceNumber.trim(),
          observedAccountLastFour: form.observedAccountLastFour,
          observedSenderIdentifier: form.observedSenderIdentifier.trim(),
          evidenceReference: form.evidenceReference.trim(),
          agentNotes: form.agentNotes.trim() || undefined,
        }),
      });
      setNotice(result?.autoCredited === true
        ? 'تمت مطابقة الحركة مع الحساب المرسل وحساب الاستقبال وسجل العملية؛ أضيف الرصيد تلقائياً ورُحّل القيد المحاسبي.'
        : 'تم إرسال نتيجة المطابقة. لم يُضف الرصيد آلياً؛ هذه الحركة تنتظر المراجعة المالية.');
      setError(null);
      await loadQueue();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر إرسال نتيجة المطابقة.');
    } finally {
      setBusyId(null);
    }
  };

  const statusLabel: Record<string, string> = {
    PENDING: 'بانتظار وكيل',
    CLAIMED: 'قيد تحقق الوكيل',
    AGENT_SUBMITTED: 'بانتظار المالية',
    NEEDS_REVIEW: 'اختلاف - مراجعة مطلوبة',
    POSTED: 'تم القيد الآلي',
  };

  return (
    <main dir="rtl" className="mx-auto max-w-5xl space-y-6 p-4 text-right sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-white">مهام وكيل المحافظ</h1>
          <p className="mt-1 text-sm text-slate-400">
            التحقق من سجل التحويل الرسمي. عند التطابق الدقيق وتفعيل سياسة القيد الآلي، يرحّل النظام القيد المزدوج؛ وإلا تُحال الحركة للمالية.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadQueue()}
          disabled={loading}
          className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-bold text-slate-200 disabled:opacity-50"
        >
          تحديث المهام
        </button>
      </header>

      {notice && <p role="status" className="rounded-xl border border-emerald-700/60 bg-emerald-950/40 p-3 text-sm text-emerald-300">{notice}</p>}
      {error && <p role="alert" className="rounded-xl border border-rose-700/60 bg-rose-950/40 p-3 text-sm text-rose-300">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-400">جاري تحميل المهام من الخادم...</p>
      ) : operations.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-sm text-slate-400">
          لا توجد حالياً مهام إيداع واردة مسندة أو بانتظار وكيل.
        </div>
      ) : (
        <div className="space-y-4">
          {operations.map((operation) => {
            const form = forms[operation.id] || emptyForm;
            const deposit = operation.depositRequest;
            return (
              <section key={operation.id} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-bold text-white">{deposit?.depositNumber || 'طلب إيداع'} · {operation.channelCode}</h2>
                    <p className="mt-1 text-xs text-slate-400">
                      المبلغ المتوقع: {Number(operation.expectedAmount).toLocaleString('en-US')} {operation.expectedCurrency}
                      {deposit?.senderName ? ` · المحول: ${deposit.senderName}` : ''}
                    </p>
                    {operation.status === 'CLAIMED' && deposit?.senderAccount?.identifier && (
                      <p className="mt-2 rounded-lg border border-indigo-500/20 bg-indigo-950/30 p-2 text-xs text-indigo-200">
                        معرّف الإرسال المحفوظ لدى العميل: <strong dir="ltr">{deposit.senderAccount.identifier}</strong>
                      </p>
                    )}
                  </div>
                  <span className="rounded-lg border border-slate-700 px-3 py-1 text-xs font-bold text-slate-300">
                    {statusLabel[operation.status] || operation.status}
                  </span>
                </div>

                {operation.status === 'PENDING' && (
                  <button
                    type="button"
                    disabled={busyId === operation.id}
                    onClick={() => void claim(operation)}
                    className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  >
                    استلام مهمة التحقق
                  </button>
                )}

                {operation.status === 'CLAIMED' && (
                  <form onSubmit={(event) => void submit(event, operation)} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="space-y-1 text-xs text-slate-300">
                      <span>المبلغ المرصود في سجل المحفظة</span>
                      <input required type="number" min="0.0001" step="0.0001" value={form.observedAmount} onChange={(e) => updateForm(operation.id, 'observedAmount', e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white" />
                    </label>
                    <label className="space-y-1 text-xs text-slate-300">
                      <span>العملة المرصودة</span>
                      <select required value={form.observedCurrency} onChange={(e) => updateForm(operation.id, 'observedCurrency', e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white">
                        <option value="" disabled>اختر العملة كما ظهرت في كشف الحركة</option>
                        <option value="YER">YER</option>
                        <option value="USD">USD</option>
                        <option value="SAR">SAR</option>
                      </select>
                    </label>
                    <label className="space-y-1 text-xs text-slate-300">
                      <span>الرقم المرجعي الظاهر في سجل المحفظة</span>
                      <input required value={form.observedReferenceNumber} onChange={(e) => updateForm(operation.id, 'observedReferenceNumber', e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white" />
                    </label>
                    <label className="space-y-1 text-xs text-slate-300">
                      <span>آخر أربعة أرقام من حساب الاستقبال الرسمي</span>
                      <input required maxLength={4} inputMode="numeric" pattern="[0-9]{4}" value={form.observedAccountLastFour} onChange={(e) => updateForm(operation.id, 'observedAccountLastFour', e.target.value.replace(/\D/g, '').slice(0, 4))} className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white" />
                    </label>
                    <label className="space-y-1 text-xs text-slate-300 sm:col-span-2">
                      <span>معرّف حساب المرسل كما يظهر في سجل المحفظة الرسمي</span>
                      <p className="text-[11px] text-slate-500">المعرّف المحفوظ للعميل: {deposit?.senderAccount?.maskedIdentifier || 'غير متوفر'} · نوعه: {deposit?.senderAccount?.identifierType || '—'}</p>
                      <input required maxLength={80} value={form.observedSenderIdentifier} onChange={(e) => updateForm(operation.id, 'observedSenderIdentifier', e.target.value)} placeholder="أدخل الرقم البديل أو الهاتف كما ظهر في الحركة الواردة" className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white" />
                    </label>
                    <label className="space-y-1 text-xs text-slate-300 sm:col-span-2">
                      <span>مرجع الإثبات من كشف/سجل المحفظة الرسمي</span>
                      <input required value={form.evidenceReference} onChange={(e) => updateForm(operation.id, 'evidenceReference', e.target.value)} placeholder="مثال: رقم سطر كشف الحساب أو رقم مستند داخلي" className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white" />
                    </label>
                    <label className="space-y-1 text-xs text-slate-300 sm:col-span-2">
                      <span>ملاحظات الوكيل (اختياري)</span>
                      <textarea rows={2} value={form.agentNotes} onChange={(e) => updateForm(operation.id, 'agentNotes', e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white" />
                    </label>
                    <p className="text-xs leading-6 text-amber-300 sm:col-span-2">
                      لا تدخل PIN أو OTP أو كلمة مرور المحفظة أو بيانات تسجيل الدخول. لا تعتمد صورة العميل وحدها؛ يجب مطابقة الحركة في سجل الحساب الرسمي.
                    </p>
                    <div className="sm:col-span-2">
                      <button type="submit" disabled={busyId === operation.id} className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
                        إرسال المطابقة إلى المالية
                      </button>
                    </div>
                  </form>
                )}

                {operation.status === 'AGENT_SUBMITTED' && (
                  <p className="rounded-xl bg-sky-950/40 p-3 text-sm text-sky-300">
                    وصلت نتيجة المطابقة. لا تضف رصيداً ولا تنفذ إجراءً آخر؛ ينتظر الطلب اعتماد موظف مالية مستقل.
                  </p>
                )}
                {operation.status === 'NEEDS_REVIEW' && (
                  <p className="rounded-xl bg-amber-950/40 p-3 text-sm text-amber-300">
                    توجد فروقات بين بيانات الطلب والحركة المرصودة. أوقف المعالجة وأبلغ المالية؛ لا تعِد إرسال أو تعديل بيانات الحركة.
                  </p>
                )}
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
