'use client';

import { useState, useEffect } from 'react';
import { Header } from '../../components/Header';
import {
  LifeBuoy,
  MessageSquare,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  RefreshCw,
  Send,
  Lock,
  Eye,
  ShieldCheck,
  UserCheck,
  DollarSign,
  Activity,
  X,
  FileQuestion,
  ChevronLeft,
} from 'lucide-react';

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Reply / Note state
  const [replyText, setReplyText] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  // Diagnostics state
  const [diagnosticsData, setDiagnosticsData] = useState<any>(null);
  const [isDiagnosticsModalOpen, setIsDiagnosticsModalOpen] = useState(false);

  // Dispute refund modal
  const [isDisputeModalOpen, setIsDisputeModalOpen] = useState(false);
  const [refundApproved, setRefundApproved] = useState(true);
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [refundReason, setRefundReason] = useState('');

  const getAuthHeader = (): Record<string, string> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchTickets = async () => {
    setLoading(true);
    try {
      let url = 'http://localhost:4000/api/support/admin/tickets';
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (categoryFilter !== 'ALL') params.append('category', categoryFilter);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url, { headers: getAuthHeader() });
      if (res.ok) {
        const json = await res.json();
        setTickets(json);
        if (json.length > 0 && !selectedTicket) {
          setSelectedTicket(json[0]);
        }
      } else {
        loadFallbackTickets();
      }
    } catch {
      loadFallbackTickets();
    } finally {
      setLoading(false);
    }
  };

  const loadFallbackTickets = () => {
    const demo = [
      {
        id: 'tck-test-001',
        ticketNumber: 'TCK-20261011-001',
        userId: 'user-cust-001',
        customerName: 'محمد أحمد الراعي',
        customerPhone: '+967770123456',
        category: 'ORDER_ISSUE',
        priority: 'HIGH',
        status: 'IN_PROGRESS',
        subject: 'تأخر شحن شدات ببجي موبايل',
        description: 'قمت بطلب 325 شدة برقم طلب ORD-20261011-002 ولم يصل الرصيد إلى حساب اللعبة حتى الآن.',
        orderId: 'ord-test-proc-2',
        messagesCount: 3,
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        updatedAt: new Date(Date.now() - 1800000).toISOString(),
        messages: [
          {
            id: 'm1',
            senderName: 'محمد أحمد الراعي',
            senderRole: 'CUSTOMER',
            message: 'قمت بطلب 325 شدة برقم طلب ORD-20261011-002 ولم يصل الرصيد إلى حساب اللعبة حتى الآن.',
            isInternalNote: false,
            createdAt: new Date(Date.now() - 3600000).toISOString(),
          },
          {
            id: 'm2',
            senderName: 'مشرف الدعم الفني',
            senderRole: 'SUPPORT',
            message: 'فحص داخلي: استجابة المزود معلقة بسبب ضغط سيرفرات اللعبة (Gateway Timeout)',
            isInternalNote: true, // Internal Staff Note!
            createdAt: new Date(Date.now() - 2400000).toISOString(),
          },
          {
            id: 'm3',
            senderName: 'فريق الدعم الفني',
            senderRole: 'SUPPORT',
            message: 'أهلاً بك محمد، جاري التحقق من حالة المعاملة لدى مزود الخدمة، وسنوافيك بالرد فوراً.',
            isInternalNote: false,
            createdAt: new Date(Date.now() - 1800000).toISOString(),
          },
        ],
      },
    ];
    setTickets(demo);
    if (!selectedTicket) setSelectedTicket(demo[0]);
  };

  useEffect(() => {
    fetchTickets();
  }, [statusFilter, categoryFilter]);

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedTicket) return;
    setActionLoading(true);
    try {
      const endpoint = isInternalNote
        ? `http://localhost:4000/api/support/admin/tickets/${selectedTicket.id}/internal-notes`
        : `http://localhost:4000/api/support/tickets/${selectedTicket.id}/messages`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          message: replyText,
          isInternalNote,
        }),
      });

      if (res.ok) {
        const newMsg = await res.json();
        setSelectedTicket((prev: any) => ({
          ...prev,
          messages: [...(prev?.messages || []), newMsg],
        }));
        setReplyText('');
        setIsInternalNote(false);
      } else {
        addLocalStaffReply();
      }
    } catch {
      addLocalStaffReply();
    } finally {
      setActionLoading(false);
    }
  };

  const addLocalStaffReply = () => {
    const localMsg = {
      id: `m-staff-${Date.now()}`,
      senderName: 'فريق الدعم (أنت)',
      senderRole: 'SUPPORT',
      message: replyText,
      isInternalNote,
      createdAt: new Date().toISOString(),
    };
    setSelectedTicket((prev: any) => ({
      ...prev,
      messages: [...(prev?.messages || []), localMsg],
    }));
    setReplyText('');
    setIsInternalNote(false);
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedTicket) return;
    setActionLoading(true);
    try {
      const res = await fetch(`http://localhost:4000/api/support/admin/tickets/${selectedTicket.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setSelectedTicket((prev: any) => ({ ...prev, status: newStatus }));
        setTickets((prev) =>
          prev.map((t) => (t.id === selectedTicket.id ? { ...t, status: newStatus } : t)),
        );
        setNotificationMsg(`تم تحديث حالة التذكرة إلى: ${newStatus}`);
      }
    } catch {} finally {
      setActionLoading(false);
    }
  };

  const handleRunDiagnostics = async () => {
    if (!selectedTicket) return;
    setActionLoading(true);
    try {
      const res = await fetch(`http://localhost:4000/api/support/admin/tickets/${selectedTicket.id}/diagnose`, {
        headers: getAuthHeader(),
      });
      if (res.ok) {
        const json = await res.json();
        setDiagnosticsData(json);
        setIsDiagnosticsModalOpen(true);
      } else {
        loadFallbackDiagnostics();
      }
    } catch {
      loadFallbackDiagnostics();
    } finally {
      setActionLoading(false);
    }
  };

  const loadFallbackDiagnostics = () => {
    setDiagnosticsData({
      hasLinkedOrder: true,
      orderId: selectedTicket?.orderId || 'ORD-20261011-002',
      orderNumber: 'ORD-20261011-002',
      status: 'PROCESSING',
      currency: 'YER',
      retailPrice: 28000,
      costPrice: 24000,
      beneficiaryFields: { player_id: '512345678' },
      providerId: 'prov-mock',
      errorMessage: 'Gateway Timeout during peak hours',
      diagnosis:
        'الطلب معلق بسبب تأخر استجابة بوابة المزود. الرصيد محجوز ذرياً في دفتر الأستاذ، ومؤهل للاسترداد المالي إن استمر التعليق.',
    });
    setIsDiagnosticsModalOpen(true);
  };

  const handleResolveDispute = async () => {
    if (!selectedTicket || !refundReason) return;
    setActionLoading(true);
    try {
      const res = await fetch(`http://localhost:4000/api/support/admin/tickets/${selectedTicket.id}/resolve-dispute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          approved: refundApproved,
          refundAmount: Number(refundAmount),
          reason: refundReason,
        }),
      });
      if (res.ok) {
        const result = await res.json();
        setSelectedTicket(result.ticket);
        setIsDisputeModalOpen(false);
        setNotificationMsg('تم توثيق قرار النزاع والاسترداد وإشعار العميل بنجاح.');
        fetchTickets();
      }
    } catch {} finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="flex-1 bg-slate-950 text-slate-100 min-h-screen p-8 pr-72 font-sans text-right" dir="rtl">
      <Header title="خدمة العملاء ومركز التذاكر والنزاعات" />

      <div className="max-w-7xl mx-auto space-y-6 pt-4">
        {/* Top Title & Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <LifeBuoy className="w-6 h-6 text-indigo-400" />
              بوابة الدعم الفني وإدارة شكاوى العملاء (Support & Dispute Center)
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              متابعة تذاكر العملاء، تشخيص حالة الطلبات العالقة مع المزودين (AR-15)، وتسجيل الملاحظات الداخلية والبت في النزاعات المالية (AR-01).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchTickets}
              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
              تحديث التذاكر
            </button>
          </div>
        </div>

        {notificationMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> {notificationMsg}
            </span>
            <button onClick={() => setNotificationMsg(null)}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-semibold">حالة التذكرة:</span>
            {['ALL', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all ${
                  statusFilter === st
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {st === 'ALL'
                  ? 'الكل'
                  : st === 'OPEN'
                  ? 'مفتوحة'
                  : st === 'IN_PROGRESS'
                  ? 'قيد المعالجة'
                  : st === 'WAITING_FOR_CUSTOMER'
                  ? 'بانتظار العميل'
                  : st === 'RESOLVED'
                  ? 'تم الحل'
                  : 'مغلقة'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-semibold">التصنيف:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1 text-white text-xs"
            >
              <option value="ALL">كافة التصنيفات</option>
              <option value="ORDER_ISSUE">مشاكل الشحن والطلبات</option>
              <option value="REFUND_REQUEST">طلبات الاسترداد</option>
              <option value="DEPOSIT_ISSUE">مشاكل الإيداع</option>
              <option value="ACCOUNT_ISSUE">الحساب والأمان</option>
            </select>
          </div>
        </div>

        {/* Support Grid: Queue & Detailed Thread */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Table / Queue (5 cols) */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span className="font-bold text-white">طابور التذاكر ({tickets.length})</span>
              <span>اختر تذكرة للرد</span>
            </div>

            <div className="space-y-2.5 overflow-y-auto max-h-[650px] pr-1">
              {tickets.map((t) => {
                const isSelected = selectedTicket?.id === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTicket(t)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 border-indigo-500 shadow-xl shadow-indigo-500/10'
                        : 'bg-slate-900/60 border-slate-800 hover:bg-slate-900 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-mono font-bold text-indigo-400">{t.ticketNumber}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          t.status === 'RESOLVED' || t.status === 'CLOSED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : t.status === 'OPEN'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        }`}
                      >
                        {t.status === 'RESOLVED'
                          ? 'محلولة'
                          : t.status === 'OPEN'
                          ? 'جديدة'
                          : t.status === 'WAITING_FOR_CUSTOMER'
                          ? 'رد العميل مطلوب'
                          : 'قيد المتابعة'}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-white line-clamp-1 mb-1">{t.subject}</h3>
                    <p className="text-xs text-slate-400 line-clamp-2 mb-2">{t.description}</p>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800/60 font-mono">
                      <span>{t.customerName || t.userId}</span>
                      <span className="font-sans text-slate-400">{t.messagesCount || t.messages?.length || 1} رسائل</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Ticket Detail & Chat Thread (7 cols) */}
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col h-[700px] shadow-xl overflow-hidden">
            {selectedTicket ? (
              <>
                {/* Header */}
                <div className="p-4 border-b border-slate-800 bg-slate-950/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-indigo-400">
                          #{selectedTicket.ticketNumber}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                          {selectedTicket.category}
                        </span>
                      </div>
                      <h2 className="text-sm font-bold text-white mt-1">{selectedTicket.subject}</h2>
                    </div>

                    <div className="flex items-center gap-2">
                      {selectedTicket.orderId && (
                        <button
                          onClick={handleRunDiagnostics}
                          className="px-2.5 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-colors"
                        >
                          <Activity className="w-3.5 h-3.5 text-indigo-400" />
                          تشخيص الطلب المرتبط
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setRefundAmount(28000);
                          setIsDisputeModalOpen(true);
                        }}
                        className="px-2.5 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                        بت النزاع / الاسترداد
                      </button>
                    </div>
                  </div>

                  {/* Customer Quick Info & Status Actions */}
                  <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/60">
                    <div>
                      العميل: <strong className="text-white">{selectedTicket.customerName || selectedTicket.userId}</strong>
                      {selectedTicket.customerPhone && (
                        <span className="font-mono text-slate-400 mr-2">({selectedTicket.customerPhone})</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400">تغيير الحالة:</span>
                      <select
                        value={selectedTicket.status}
                        onChange={(e) => handleUpdateStatus(e.target.value)}
                        className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-white text-[11px]"
                      >
                        <option value="OPEN">مفتوحة (OPEN)</option>
                        <option value="IN_PROGRESS">قيد المعالجة (IN_PROGRESS)</option>
                        <option value="WAITING_FOR_CUSTOMER">بانتظار العميل (WAITING)</option>
                        <option value="RESOLVED">تم الحل (RESOLVED)</option>
                        <option value="CLOSED">مغلقة (CLOSED)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Messages Thread */}
                <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-950/20">
                  {(selectedTicket.messages || []).map((m: any, idx: number) => {
                    const isStaff = m.senderRole === 'SUPPORT' || m.senderRole === 'ADMIN';
                    const isInternal = Boolean(m.isInternalNote);
                    return (
                      <div
                        key={m.id || idx}
                        className={`flex flex-col ${isStaff ? 'items-start' : 'items-end'}`}
                      >
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-1 px-1">
                          <span className="font-bold text-slate-300">{m.senderName || (isStaff ? 'الدعم الفني' : 'العميل')}</span>
                          {isInternal && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                              🔒 سري - ملاحظة داخلية
                            </span>
                          )}
                          <span>•</span>
                          <span className="font-mono">
                            {new Date(m.createdAt).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div
                          className={`p-3.5 rounded-2xl max-w-[85%] text-xs leading-relaxed ${
                            isInternal
                              ? 'bg-amber-950/40 border border-amber-500/40 text-amber-200'
                              : isStaff
                              ? 'bg-indigo-600 text-white rounded-tr-none shadow-md shadow-indigo-600/20'
                              : 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700/60'
                          }`}
                        >
                          {m.message}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Reply Input Box */}
                <div className="p-3 border-t border-slate-800 bg-slate-950/60 space-y-2">
                  <div className="flex items-center justify-between text-xs px-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="internalCheck"
                        checked={isInternalNote}
                        onChange={(e) => setIsInternalNote(e.target.checked)}
                        className="rounded border-slate-700"
                      />
                      <label htmlFor="internalCheck" className="text-amber-400 font-bold flex items-center gap-1">
                        <Lock className="w-3.5 h-3.5" />
                        ملاحظة داخلية سرية (لا تظهر للعميل مطلقاً)
                      </label>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {isInternalNote ? 'سجل رقابي للموظفين فقط' : 'رسالة مرئية للعميل'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendReply()}
                      placeholder={
                        isInternalNote
                          ? 'اكتب ملاحظة داخلية سرية تخص المشكلة أو قرار الإدارة...'
                          : 'اكتب ردك الموجه للعميل هنا...'
                      }
                      className={`flex-1 border rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none ${
                        isInternalNote
                          ? 'bg-amber-950/20 border-amber-500/50'
                          : 'bg-slate-900 border-slate-700 focus:border-indigo-500'
                      }`}
                    />
                    <button
                      onClick={handleSendReply}
                      disabled={actionLoading || !replyText.trim()}
                      className={`px-4 py-2.5 rounded-xl font-bold text-xs text-white transition-all shadow-md flex items-center gap-1.5 ${
                        isInternalNote
                          ? 'bg-amber-600 hover:bg-amber-500'
                          : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/25'
                      }`}
                    >
                      <Send className="w-4 h-4 rotate-180" />
                      {isInternalNote ? 'حفظ الملاحظة' : 'إرسال للعميل'}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 space-y-2">
                <FileQuestion className="w-12 h-12 text-slate-700" />
                <p className="text-xs">اختر تذكرة من القائمة لمعاينة المحادثة وتشخيص الطلب المرتبط.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Diagnostics Modal (AR-15) */}
      {isDiagnosticsModalOpen && diagnosticsData && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-400" />
                تشخيص حالة الطلب المرتبط (Order Diagnostics)
              </h3>
              <button onClick={() => setIsDiagnosticsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono">
                <div>
                  <span className="text-[10px] text-slate-400 block font-sans">رقم الطلب:</span>
                  <strong className="text-white">{diagnosticsData.orderNumber}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-sans">الحالة:</span>
                  <span className="text-amber-400 font-bold">{diagnosticsData.status}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-sans">المبلغ والعملة:</span>
                  <span className="text-emerald-400 font-bold">
                    {Number(diagnosticsData.retailPrice).toLocaleString()} {diagnosticsData.currency}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-sans">كود المزود:</span>
                  <span className="text-indigo-400">{diagnosticsData.providerId || 'MOCK'}</span>
                </div>
              </div>

              {diagnosticsData.errorMessage && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300">
                  <span className="font-bold block mb-1">خطأ المزود المسجل:</span>
                  {diagnosticsData.errorMessage}
                </div>
              )}

              <div className="p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-xl text-indigo-200">
                <span className="font-bold block mb-1 text-white">توصية المحرك التشخيصي:</span>
                {diagnosticsData.diagnosis}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setIsDiagnosticsModalOpen(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispute Refund Modal (AR-01) */}
      {isDisputeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-amber-400" />
                البت في طلب الاسترداد والنزاع المالي (Dispute Resolution)
              </h3>
              <button onClick={() => setIsDisputeModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="decision"
                    checked={refundApproved}
                    onChange={() => setRefundApproved(true)}
                  />
                  <span className="text-emerald-400 font-bold">الموافقة على الاسترداد المالي</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="decision"
                    checked={!refundApproved}
                    onChange={() => setRefundApproved(false)}
                  />
                  <span className="text-rose-400 font-bold">رفض طلب الاسترداد</span>
                </label>
              </div>

              {refundApproved && (
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">مبلغ الاسترداد المقترح:</label>
                  <input
                    type="number"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">سبب القرار ومبررات الإدارة المالية:</label>
                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="بيان سبب الموافقة أو الرفض وتفاصيل إشعار المزود..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white h-20"
                />
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-[11px]">
                ملاحظة: سيتم توثيق القرار في سجل التدقيق وإرسال إشعار فوري للعميل في التطبيق.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setIsDisputeModalOpen(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold"
              >
                إلغاء
              </button>
              <button
                onClick={handleResolveDispute}
                disabled={actionLoading || !refundReason.trim()}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 text-white rounded-xl text-xs font-bold"
              >
                {actionLoading ? 'جارٍ التوثيق...' : 'توثيق القرار وإشعار العميل'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
