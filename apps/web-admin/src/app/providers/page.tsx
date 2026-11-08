'use client';

import { useState, useEffect } from 'react';
import { Header } from '../../components/Header';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/+$/, '');
import {
  Server,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Edit,
  Power,
  Shield,
  Key,
  Globe,
  Wallet,
  X,
} from 'lucide-react';

export default function AdminProvidersPage() {
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<any | null>(null);
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    baseUrl: '',
    apiKey: '',
    type: 'MANUAL',
    isActive: true,
  });

  const fetchProviders = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
      if (!token) throw new Error('جلسة الإدارة غير متوفرة. سجّل الدخول مجدداً.');
      const res = await fetch(`${API_BASE_URL}/providers/admin/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.message || 'تعذر تحميل إعدادات المزودين.');
      const rows = Array.isArray(payload) ? payload : payload.data;
      if (!Array.isArray(rows)) throw new Error('استجابة قائمة المزودين غير صحيحة.');
      setProviders(rows);
    } catch (err) {
      setProviders([]);
      setLoadError(err instanceof Error ? err.message : 'تعذر تحميل إعدادات المزودين.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const handleTestConnection = async (id: string, name: string) => {
    setTestingId(id);
    setActionError(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
      if (!token) throw new Error('جلسة الإدارة غير متوفرة. سجّل الدخول مجدداً.');
      const res = await fetch(`${API_BASE_URL}/providers/admin/${encodeURIComponent(id)}/test-connection`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.message || `فشل اختبار الاتصال بالمزود ${name}.`);
      alert(payload.message || `أعاد الخادم نتيجة اختبار الاتصال للمزود "${name}".`);
      await fetchProviders();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'تعذر التحقق من اتصال المزود.');
    } finally {
      setTestingId(null);
    }
  };

  const openEditModal = (provider: any) => {
    setSelectedProvider(provider);
    setEditForm({
      name: provider.name,
      baseUrl: provider.baseUrl || '',
      apiKey: '',
      type: provider.type,
      isActive: provider.isActive,
    });
    setEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedProvider) return;
    setActionError(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
      if (!token) throw new Error('جلسة الإدارة غير متوفرة. سجّل الدخول مجدداً.');
      const res = await fetch(`${API_BASE_URL}/providers/admin/${encodeURIComponent(selectedProvider.id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editForm),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.message || 'تعذر حفظ إعدادات المزود.');
      alert(payload.message || 'تم تحديث إعدادات المزود وتأكيدها من الخادم.');
      setEditModal(false);
      await fetchProviders();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'تعذر حفظ إعدادات المزود.');
    }
  };

  return (
    <div className="text-right">
      <Header title="مزودو الشحن والمحولات (Provider Adapters & Gateways)" />
      {loadError && <div role="alert" className="mx-8 mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">{loadError}</div>}
      {actionError && <div role="alert" className="mx-8 mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">{actionError}</div>}

      <div className="p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">إدارة تكاملات المزودين Wholesale</h2>
            <p className="text-xs text-slate-400">
              إدارة مفاتيح الربط المشفرة، فحص الاتصال ومزامنة الأرصدة، وتبديل أوضاع التنفيذ
            </p>
          </div>

          <button
            onClick={fetchProviders}
            className="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl transition-colors self-start"
            title="تحديث"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Providers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <p className="text-xs text-slate-400">جاري تحميل إعدادات المزودين...</p>
          ) : providers.length === 0 ? (
            <p className="text-xs text-slate-400">لا توجد إعدادات مزودين مسجلة في قاعدة البيانات.</p>
          ) : providers.map((p) => (
            <div
              key={p.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl hover:border-slate-700 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
                    <Server className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{p.name}</h3>
                    <p className="text-[10px] text-indigo-400 font-mono">الرمز: {p.code}</p>
                  </div>
                </div>

                <span
                  className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                    p.isActive
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {p.isActive ? 'نشط (ACTIVE)' : 'معطل'}
                </span>
              </div>

              {/* Stats Box */}
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800/80 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5 text-emerald-400" /> رصيد المزود:
                  </span>
                  <span className="font-mono font-bold text-emerald-400">
                    {Number(p.balance).toLocaleString()} {p.currency}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-amber-400" /> مفتاح API:
                  </span>
                  <span className="font-mono text-slate-300">
                    {p.apiKey || 'لا يتطلب مفتاح'}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-indigo-400" /> الرابط الأساسي:
                  </span>
                  <span className="font-mono text-[10px] text-slate-400 truncate max-w-[160px]">
                    {p.baseUrl || 'محلي (Internal)'}
                  </span>
                </div>

                <div className="flex justify-between items-center border-t border-slate-800/60 pt-1.5">
                  <span className="text-slate-400">الطلبات المنفذة:</span>
                  <span className="font-mono font-bold text-white">
                    {p._count?.orders ?? 0} طلب
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => handleTestConnection(p.id, p.name)}
                  disabled={testingId === p.id}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testingId === p.id ? 'animate-spin' : ''}`} />
                  {testingId === p.id ? 'جاري الفحص...' : 'فحص الاتصال والرصيد'}
                </button>

                <button
                  onClick={() => openEditModal(p)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors"
                  title="تعديل الإعدادات"
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Provider Modal */}
      {editModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 text-right space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <button
                onClick={() => setEditModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-base font-bold text-white">تعديل إعدادات المزود ({selectedProvider?.code})</h3>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300 font-bold">اسم المزود المعروض</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-right"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300">الرابط الأساسي (Base URL)</label>
                <input
                  type="text"
                  value={editForm.baseUrl}
                  onChange={(e) => setEditForm({ ...editForm, baseUrl: e.target.value })}
                  placeholder="https://api.provider.com/v1"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white font-mono text-left"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300">مفتاح الربط السري (API Key)</label>
                <input
                  type="password"
                  placeholder="اتركه فارغاً إذا لم ترغب بتغييره"
                  value={editForm.apiKey}
                  onChange={(e) => setEditForm({ ...editForm, apiKey: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white font-mono text-left"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="text-slate-300 font-bold">حالة التفعيل والعمل</label>
                <input
                  type="checkbox"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-0 bg-slate-950"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setEditModal(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveEdit}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors"
              >
                حفظ التعديلات
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
