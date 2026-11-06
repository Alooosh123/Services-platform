'use client';

import { useState, useEffect } from 'react';
import {
  KeyRound,
  ShieldCheck,
  Upload,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Search,
  PackageCheck,
  FileSpreadsheet,
  Lock,
} from 'lucide-react';

export default function PinVaultPage() {
  const [inventory, setInventory] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Import form state
  const [selectedProductId, setSelectedProductId] = useState('');
  const [pinsText, setPinsText] = useState('');
  const [defaultCostPrice, setDefaultCostPrice] = useState('10.0');

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') || localStorage.getItem('token') || '' : '';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      // 1. Fetch PIN Inventory
      const invRes = await fetch(`${API_URL}/admin/pin-vault/inventory`, { headers });
      if (invRes.ok) {
        const invData = await invRes.json();
        setInventory(invData.items || invData || []);
      } else {
        // Fallback demo inventory
        setInventory([
          {
            productId: 'prod-razer-10',
            productName: 'Razer Gold $10 Global',
            sku: 'RAZER-GOLD-10',
            availableCount: 45,
            reservedCount: 2,
            soldCount: 310,
            lowStockThreshold: 10,
            isLowStock: false,
          },
          {
            productId: 'prod-pubg-60-pin',
            productName: 'PUBG Mobile 60 UC Voucher',
            sku: 'PUBG-60-VOUCH',
            availableCount: 4,
            reservedCount: 1,
            soldCount: 840,
            lowStockThreshold: 15,
            isLowStock: true,
          },
          {
            productId: 'prod-itunes-5',
            productName: 'Apple iTunes $5 US',
            sku: 'ITUNES-US-5',
            availableCount: 18,
            reservedCount: 0,
            soldCount: 155,
            lowStockThreshold: 5,
            isLowStock: false,
          },
        ]);
      }

      // 2. Fetch Products for selection
      const prodRes = await fetch(`${API_URL}/products/catalog`, { headers });
      if (prodRes.ok) {
        const prodData = await prodRes.json();
        const allProducts = prodData.flatMap((c: any) =>
          c.services.flatMap((s: any) => s.products || []),
        );
        setProducts(allProducts);
        if (allProducts.length > 0 && !selectedProductId) {
          setSelectedProductId(allProducts[0].id);
        }
      }
    } catch (err: any) {
      console.warn('Could not fetch real PIN Vault data:', err?.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleBatchImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !pinsText.trim()) {
      setFeedback({ type: 'error', message: 'يرجى اختيار المنتج ولصق الأكواد المراد استيرادها.' });
      return;
    }

    setImporting(true);
    setFeedback(null);

    // Parse lines: PIN,SerialNumber,ExpiryDate,CostPrice
    const lines = pinsText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const parsedPins = lines.map((line, idx) => {
      const parts = line.split(/[,;\t]/).map((p) => p.trim());
      const pinCode = parts[0];
      const serialNumber = parts[1] || `SN-${Date.now()}-${idx}`;
      const expiryDate = parts[2] || undefined;
      const cost = parts[3] ? parseFloat(parts[3]) : parseFloat(defaultCostPrice) || 10.0;

      return {
        pinCode,
        serialNumber,
        expiryDate,
        costPrice: cost,
      };
    });

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') || localStorage.getItem('token') || '' : '';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_URL}/admin/pin-vault/import`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          productId: selectedProductId,
          pins: parsedPins,
        }),
      });

      if (res.ok) {
        const resData = await res.json();
        setFeedback({
          type: 'success',
          message: `تم تشفير واستيراد ${resData.importedCount || parsedPins.length} كود بنجاح (AES-256-GCM) وتحديث المخزون.`,
        });
        setPinsText('');
        fetchData();
      } else {
        const errJson = await res.json();
        setFeedback({
          type: 'error',
          message: errJson.message || 'فشل استيراد الدفعة، تأكد من عدم وجود أكواد مكررة.',
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'حدث خطأ أثناء إرسال الدفعة للخادم.',
      });
    } finally {
      setImporting(false);
    }
  };

  const filteredInventory = inventory.filter(
    (item) =>
      item.productName?.toLowerCase().includes(search.toLowerCase()) ||
      item.sku?.toLowerCase().includes(search.toLowerCase()),
  );

  const totalAvailable = inventory.reduce((acc, curr) => acc + (curr.availableCount || 0), 0);
  const totalSold = inventory.reduce((acc, curr) => acc + (curr.soldCount || 0), 0);
  const lowStockCount = inventory.filter((i) => i.isLowStock || (i.availableCount <= (i.lowStockThreshold || 5))).length;

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto text-right" dir="rtl">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">مخزن البطاقات والأكواد المشفرة (PIN Vault)</h1>
              <p className="text-sm text-slate-400 mt-1">
                تشفير AES-256-GCM، السحب اللحظي الذري SKIP LOCKED، ومراقبة المخزون الحرج
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg border border-slate-700 transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          تحديث المخزون
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-400">إجمالي الأكواد المتاحة للبيع</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <PackageCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white font-mono">{totalAvailable}</span>
            <span className="text-xs text-slate-500">كود مشفر</span>
          </div>
        </div>

        <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-400">إجمالي البطاقات المباعة</span>
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white font-mono">{totalSold}</span>
            <span className="text-xs text-slate-500">عملية تسليم فوري</span>
          </div>
        </div>

        <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-400">تنبيهات المخزون الحرج</span>
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-rose-400 font-mono">{lowStockCount}</span>
            <span className="text-xs text-slate-500">فئات بحاجة لإعادة التعبئة</span>
          </div>
        </div>
      </div>

      {/* Main Content Grid: Import Panel & Inventory Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Batch Import Form */}
        <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-6 h-fit space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Upload className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white">استيراد دفعة كروت وبطاقات جديدة</h2>
          </div>

          <form onSubmit={handleBatchImport} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">الفئة أو المنتج المستهدف</label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg p-2.5 focus:border-indigo-500 focus:outline-none"
              >
                {products.length > 0 ? (
                  products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nameAr || p.name} ({p.sku})
                    </option>
                  ))
                ) : (
                  <option value="prod-razer-10">Razer Gold $10 Global</option>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">التكلفة الافتراضية للكود ($)</label>
              <input
                type="number"
                step="0.01"
                value={defaultCostPrice}
                onChange={(e) => setDefaultCostPrice(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg p-2.5 focus:border-indigo-500 focus:outline-none font-mono"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-400">
                  قائمة الأكواد (كود واحد في كل سطر)
                </label>
                <span className="text-[10px] text-slate-500">تنسيق: PIN,Serial,Expiry</span>
              </div>
              <textarea
                rows={6}
                value={pinsText}
                onChange={(e) => setPinsText(e.target.value)}
                placeholder="RZ-9988-1122-3344,SN-998811,2027-12-31&#10;RZ-5544-3322-1100,SN-554433,2027-12-31"
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs font-mono rounded-lg p-3 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-500/20 text-[11px] text-indigo-300 flex items-start gap-2">
              <Lock className="w-4 h-4 shrink-0 mt-0.5 text-indigo-400" />
              <span>
                تخضع جميع الأكواد لتشفير AES-256-GCM قبل كتابتها في قاعدة البيانات، ولا يتم فك التشفير إلا لحظة التسليم الفوري للعميل.
              </span>
            </div>

            {feedback && (
              <div
                className={`p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${
                  feedback.type === 'success'
                    ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-950/40 text-rose-300 border border-rose-500/30'
                }`}
              >
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                )}
                <span>{feedback.message}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={importing}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm rounded-lg transition shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
            >
              <Upload className={`w-4 h-4 ${importing ? 'animate-bounce' : ''}`} />
              {importing ? 'جاري التشفير والحفظ...' : 'تشفير وحفظ الدفعة'}
            </button>
          </form>
        </div>

        {/* Right Column: Inventory Table */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-amber-400" />
              حالة مخزون المنتجات الرقمية
            </h2>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث باسم المنتج أو الـ SKU..."
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg pr-9 pl-3 py-2 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold">
                  <th className="py-3 px-4">اسم المنتج والـ SKU</th>
                  <th className="py-3 px-3 text-center">المتاح للبيع</th>
                  <th className="py-3 px-3 text-center">المحجوز</th>
                  <th className="py-3 px-3 text-center">المباع</th>
                  <th className="py-3 px-3 text-center">حالة المخزون</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                {filteredInventory.map((item, idx) => {
                  const isLow = item.isLowStock || (item.availableCount <= (item.lowStockThreshold || 5));
                  return (
                    <tr key={item.productId || idx} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 font-sans">
                        <div className="font-semibold text-white">{item.productName}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{item.sku}</div>
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <span className={`px-2 py-1 rounded font-bold ${
                          item.availableCount > 0 ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/20' : 'bg-rose-950/60 text-rose-400 border border-rose-500/20'
                        }`}>
                          {item.availableCount}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-center text-slate-400">
                        {item.reservedCount || 0}
                      </td>
                      <td className="py-3.5 px-3 text-center text-slate-400">
                        {item.soldCount || 0}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        {isLow ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-sans font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <AlertTriangle className="w-3 h-3" />
                            مخزون حرج
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-sans font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            متوفر
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredInventory.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500 font-sans">
                      لا توجد فئات مطابقة لبحثك.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
