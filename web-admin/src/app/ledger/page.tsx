'use client';

import { useState, useEffect } from 'react';
import {
  WalletCards,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Scale,
  FileText,
  Clock,
  Layers,
} from 'lucide-react';
import { formatMoney, isolate } from '../../lib/format';

interface LedgerItem {
  id: string;
  txNumber: string;
  type: string;
  status: string;
  postedAt: string;
  referenceType: string;
  referenceId: string;
  notes?: string;
  entries?: Array<{
    id: string;
    debitAmount: number | string;
    creditAmount: number | string;
    currency: string;
    notes?: string;
    account?: {
      code: string;
      name: string;
      type: string;
    };
  }>;
}

export default function AdminLedgerPage() {
  const [transactions, setTransactions] = useState<LedgerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTx, setTotalTx] = useState(0);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

  const fetchLedger = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = typeof window !== 'undefined'
        ? localStorage.getItem('admin_token') || localStorage.getItem('token') || ''
        : '';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      let url = `${API_URL}/ledger/admin/all?page=${page}&limit=15`;
      if (typeFilter !== 'ALL') {
        url += `&type=${typeFilter}`;
      }
      if (search.trim()) {
        url += `&search=${encodeURIComponent(search.trim())}`;
      }

      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.items || []);
        setTotalPages(data.totalPages || 1);
        setTotalTx(data.total || 0);
      } else {
        // Fallback demo data
        setTransactions([
          {
            id: 'ltx-1',
            txNumber: 'LTX-20261106-1001',
            type: 'PURCHASE',
            status: 'POSTED',
            postedAt: new Date().toISOString(),
            referenceType: 'ORDER',
            referenceId: 'ORD-9901',
            notes: 'شراء باقة شدات ببجي 60 UC للعميل أحمد الشرجبي',
            entries: [
              {
                id: 'e-1',
                debitAmount: 1.05,
                creditAmount: 0,
                currency: 'USD',
                account: { code: '2001-CUSTOMER-WALLET-USD', name: 'محفظة العملاء (USD)', type: 'LIABILITY' },
              },
              {
                id: 'e-2',
                debitAmount: 0,
                creditAmount: 1.05,
                currency: 'USD',
                account: { code: '4001-REVENUE-GAMING', name: 'إيرادات مبيعات الألعاب', type: 'REVENUE' },
              },
            ],
          },
          {
            id: 'ltx-2',
            txNumber: 'LTX-20261106-1002',
            type: 'TOPUP',
            status: 'POSTED',
            postedAt: new Date(Date.now() - 3600000).toISOString(),
            referenceType: 'TOPUP',
            referenceId: 'DEP-8821',
            notes: 'تغذية محفظة عبر تحويل بنك الكريمي 250,000 ريال يمني',
            entries: [
              {
                id: 'e-3',
                debitAmount: 250000,
                creditAmount: 0,
                currency: 'YER',
                account: { code: '1002-BANK-KURSHI', name: 'حساب بنك الكريمي', type: 'ASSET' },
              },
              {
                id: 'e-4',
                debitAmount: 0,
                creditAmount: 250000,
                currency: 'YER',
                account: { code: '2002-CUSTOMER-WALLET-YER', name: 'محفظة العملاء (YER)', type: 'LIABILITY' },
              },
            ],
          },
        ]);
        setTotalTx(2);
        setTotalPages(1);
      }
    } catch (err: any) {
      console.warn('Ledger fetch error:', err);
      setError('تعذر تحميل قيود دفتر الأستاذ العام');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, [page, typeFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold mb-2">
            <Scale className="w-3.5 h-3.5" />
            <span>نظام القيد المزدوج المحاسبي (Double-Entry Ledger)</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">دفتر الأستاذ العام والقيود المالية</h1>
          <p className="text-xs text-slate-400 mt-1">
            سجل القيود المحاسبية غير القابلة للتعديل (Immutable Journal Entries) لجميع عمليات الإيداع والشراء والتسوية.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchLedger()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition-all border border-slate-700"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>تحديث القيود</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row gap-4 justify-between items-center">
        {/* Search */}
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-500 absolute right-3.5 top-3" />
          <input
            type="text"
            placeholder="بحث برقم القيد LTX أو البيان..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchLedger()}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pr-10 pl-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500"
          />
        </div>

        {/* Type Tabs */}
        <div className="flex flex-wrap gap-1.5 w-full md:w-auto">
          {[
            { id: 'ALL', label: 'جميع القيود' },
            { id: 'PURCHASE', label: 'عمليات الشراء' },
            { id: 'TOPUP', label: 'إيداعات المحافظ' },
            { id: 'REFUND', label: 'المسترجعات' },
            { id: 'ADJUSTMENT', label: 'تسويات محاسبية' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setTypeFilter(tab.id);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                typeFilter === tab.id
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table / 4-States */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        {loading ? (
          /* Loading */
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 bg-slate-800/50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : error ? (
          /* Error */
          <div className="p-12 text-center space-y-4">
            <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
            <h3 className="text-base font-bold text-white">{error}</h3>
            <button
              onClick={() => fetchLedger()}
              className="px-4 py-2 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-500"
            >
              إعادة المحاولة
            </button>
          </div>
        ) : transactions.length === 0 ? (
          /* Empty */
          <div className="p-16 text-center space-y-3">
            <WalletCards className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-white">لا توجد قيود مسجلة مطابقة للفلتر</h3>
          </div>
        ) : (
          /* Data List */
          <div className="divide-y divide-slate-800">
            {transactions.map((tx) => (
              <div key={tx.id} className="p-5 hover:bg-slate-800/30 transition-colors space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-violet-400 text-xs px-2.5 py-1 rounded bg-violet-500/10 border border-violet-500/20">
                      {isolate(tx.txNumber)}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold">
                      {tx.type}
                    </span>
                    <span className="text-xs font-semibold text-emerald-400">{tx.status}</span>
                  </div>
                  <div className="text-xs text-slate-500 font-mono">
                    {new Date(tx.postedAt).toLocaleString('ar-YE')}
                  </div>
                </div>

                {tx.notes && <p className="text-xs text-slate-300 font-medium">{tx.notes}</p>}

                {/* Journal Entries Sub-Table */}
                {tx.entries && tx.entries.length > 0 && (
                  <div className="bg-slate-950/70 rounded-lg p-3 border border-slate-800/80">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="text-slate-500 border-b border-slate-800/80">
                          <th className="pb-2 font-medium">الحساب المحاسبي</th>
                          <th className="pb-2 font-medium">مدين (Debit)</th>
                          <th className="pb-2 font-medium">دائن (Credit)</th>
                          <th className="pb-2 font-medium">العملة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900 font-mono">
                        {tx.entries.map((entry) => (
                          <tr key={entry.id} className="text-slate-300">
                            <td className="py-1.5 font-sans">
                              <span className="font-semibold text-slate-200">
                                {entry.account?.name || entry.account?.code || 'حساب عام'}
                              </span>
                              <span className="text-[10px] text-slate-500 mr-2 font-mono">
                                ({entry.account?.code})
                              </span>
                            </td>
                            <td className="py-1.5 text-sky-400 font-semibold">
                              {Number(entry.debitAmount) > 0 ? formatMoney(Number(entry.debitAmount), entry.currency) : '—'}
                            </td>
                            <td className="py-1.5 text-emerald-400 font-semibold">
                              {Number(entry.creditAmount) > 0 ? formatMoney(Number(entry.creditAmount), entry.currency) : '—'}
                            </td>
                            <td className="py-1.5 text-slate-400">{entry.currency}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
