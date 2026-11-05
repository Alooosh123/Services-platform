'use client';

import { useState, useEffect } from 'react';
import {
  HelpCircle,
  PlusCircle,
  MessageSquare,
  Send,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  X,
  FileQuestion,
  Layers,
  ChevronLeft,
  LifeBuoy,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import { apiUrl } from '../../lib/api';

export default function CustomerSupportPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [isNewTicketModalOpen, setIsNewTicketModalOpen] = useState(false);

  // New ticket state
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('ORDER_ISSUE');
  const [orderId, setOrderId] = useState('');
  const [description, setDescription] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(`TCK-${Date.now()}`);

  // Reply state
  const [replyText, setReplyText] = useState('');
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  const getAuthHeader = (): Record<string, string> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('customer_token') : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchTickets = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(apiUrl('/support/tickets'), {
        headers: getAuthHeader(),
      });
      if (res.ok) {
        const json = await res.json();
        setTickets(json);
        if (json.length > 0 && !selectedTicket) {
          setSelectedTicket(json[0]);
        }
      } else {
        setTickets([]);
        setLoadError('تعذر تحميل تذاكر الدعم. يرجى تسجيل الدخول ثم المحاولة مجدداً.');
      }
    } catch (err) {
      setTickets([]);
      setLoadError(err instanceof Error ? err.message : 'تعذر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  const loadFallbackTickets = () => {
    const demo = [
      {
        id: 'tck-demo-1',
        ticketNumber: 'TCK-20261011-001',
        category: 'ORDER_ISSUE',
        priority: 'HIGH',
        status: 'IN_PROGRESS',
        subject: 'تأخر شحن شدات ببجي موبايل',
        description: 'قمت بطلب 325 شدة برقم طلب ORD-20261011-002 ولم يصل الرصيد إلى حساب اللعبة حتى الآن.',
        orderId: 'ORD-20261011-002',
        messagesCount: 2,
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        updatedAt: new Date(Date.now() - 1800000).toISOString(),
        messages: [
          {
            id: 'm1',
            senderName: 'محمد أحمد',
            senderRole: 'CUSTOMER',
            message: 'قمت بطلب 325 شدة برقم طلب ORD-20261011-002 ولم يصل الرصيد إلى حساب اللعبة حتى الآن.',
            createdAt: new Date(Date.now() - 3600000).toISOString(),
          },
          {
            id: 'm2',
            senderName: 'فريق الدعم الفني',
            senderRole: 'SUPPORT',
            message: 'أهلاً بك يا محمد، تم رفع المشكلة لمزود الخدمة وجاري التحقق من عملية الشحن فوراً.',
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
  }, []);

  const handleCreateTicket = async () => {
    if (!subject || !description) return;
    setActionLoading(true);
    try {
      const res = await fetch(apiUrl('/support/tickets'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          subject,
          category,
          orderId: orderId || undefined,
          description,
          idempotencyKey,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setNotificationMsg(`تم فتح التذكرة بنجاح برقم ${created.ticketNumber}`);
        setIsNewTicketModalOpen(false);
        setSubject('');
        setDescription('');
        setOrderId('');
        setIdempotencyKey(`TCK-${Date.now()}`);
        await fetchTickets();
        setSelectedTicket(created);
      } else {
        const err = await res.json();
        setNotificationMsg(`خطأ: ${err.message}`);
      }
    } catch (err) {
      setNotificationMsg(err instanceof Error ? `خطأ: ${err.message}` : 'تعذر إرسال التذكرة');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyText || !selectedTicket) return;
    setActionLoading(true);
    try {
      const res = await fetch(apiUrl(`/support/tickets/${selectedTicket.id}/messages`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          message: replyText,
          idempotencyKey: `MSG-${Date.now()}`,
        }),
      });
      if (res.ok) {
        const newMsg = await res.json();
        setSelectedTicket((prev: any) => ({
          ...prev,
          messages: [...(prev?.messages || []), newMsg],
          status: 'IN_PROGRESS',
        }));
        setReplyText('');
      } else {
        setNotificationMsg('تعذر إرسال الرد إلى الخادم');
      }
    } catch (err) {
      setNotificationMsg(err instanceof Error ? `خطأ: ${err.message}` : 'تعذر إرسال الرد');
    } finally {
      setActionLoading(false);
    }
  };

  const addLocalReply = () => {
    const localMsg = {
      id: `m-local-${Date.now()}`,
      senderName: 'أنت',
      senderRole: 'CUSTOMER',
      message: replyText,
      createdAt: new Date().toISOString(),
    };
    setSelectedTicket((prev: any) => ({
      ...prev,
      messages: [...(prev?.messages || []), localMsg],
    }));
    setReplyText('');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 text-right" dir="rtl">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <LifeBuoy className="w-6 h-6 text-indigo-400" />
            مركز الدعم والشكاوى وخدمات ما بعد البيع
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            متابعة تذاكر الشحن واسترداد الأموال وحل المشكلات الفنية بالتواصل المباشر مع فريق الدعم المتخصص.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchTickets}
            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            تحديث
          </button>
          <button
            onClick={() => {
              setIdempotencyKey(`TCK-${Date.now()}`);
              setIsNewTicketModalOpen(true);
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02]"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            فتح تذكرة جديدة
          </button>
        </div>
      </div>

      {notificationMsg && (
        <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs text-indigo-300 flex items-center justify-between">
          <span>{notificationMsg}</span>
          <button onClick={() => setNotificationMsg(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Grid: Ticket List + Conversation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (Tickets List) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span className="font-bold text-white">تذاكري ({tickets.length})</span>
            <span>انقر على التذكرة لعرض المحادثة</span>
          </div>

          <div className="space-y-2.5 overflow-y-auto max-h-[600px] pr-1">
            {tickets.map((t) => {
              const isSelected = selectedTicket?.id === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => setSelectedTicket(t)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 border-indigo-500/50 shadow-lg shadow-indigo-500/10'
                      : 'bg-slate-900/60 border-slate-800 hover:bg-slate-900 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-mono font-bold text-indigo-400">{t.ticketNumber}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        t.status === 'RESOLVED' || t.status === 'CLOSED'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : t.status === 'WAITING_FOR_CUSTOMER'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      }`}
                    >
                      {t.status === 'RESOLVED'
                        ? 'تم الحل'
                        : t.status === 'WAITING_FOR_CUSTOMER'
                        ? 'بانتظار ردك'
                        : t.status === 'CLOSED'
                        ? 'مغلقة'
                        : 'قيد المتابعة'}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-white line-clamp-1 mb-1">{t.subject}</h3>
                  <p className="text-xs text-slate-400 line-clamp-2 mb-2">{t.description}</p>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800/60 font-mono">
                    <span>{new Date(t.createdAt).toLocaleDateString('ar-YE')}</span>
                    <span className="flex items-center gap-1 font-sans text-slate-400">
                      <MessageSquare className="w-3 h-3" /> {t.messagesCount || t.messages?.length || 1} رسائل
                    </span>
                  </div>
                </div>
              );
            })}

            {loadError && !loading && (
              <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400">
                {loadError}
              </p>
            )}
            {tickets.length === 0 && !loading && !loadError && (
              <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl text-slate-500 space-y-2">
                <FileQuestion className="w-8 h-8 mx-auto text-slate-600" />
                <p className="text-xs">لا توجد لديك تذاكر دعم مسجلة حالياً.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (Ticket Live Conversation) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col h-[650px] shadow-xl overflow-hidden">
          {selectedTicket ? (
            <>
              {/* Conversation Header */}
              <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-indigo-400">
                      #{selectedTicket.ticketNumber}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                      {selectedTicket.category === 'ORDER_ISSUE'
                        ? 'مشكلة شحن طلب'
                        : selectedTicket.category === 'REFUND_REQUEST'
                        ? 'طلب استرداد مالي'
                        : selectedTicket.category === 'DEPOSIT_ISSUE'
                        ? 'مشكلة إيداع'
                        : 'استفسار عام'}
                    </span>
                  </div>
                  <h2 className="text-sm font-bold text-white mt-1">{selectedTicket.subject}</h2>
                  {selectedTicket.orderId && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      مرتبط بالطلب: {selectedTicket.orderId}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span className="hidden sm:inline">دعم معتمد</span>
                </div>
              </div>

              {/* Conversation Messages */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-950/20">
                {(selectedTicket.messages || []).map((m: any, idx: number) => {
                  const isCustomer = m.senderRole === 'CUSTOMER';
                  return (
                    <div
                      key={m.id || idx}
                      className={`flex flex-col ${isCustomer ? 'items-start' : 'items-end'}`}
                    >
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-1 px-1">
                        <span className="font-bold text-slate-300">{m.senderName || (isCustomer ? 'أنت' : 'الدعم الفني')}</span>
                        <span>•</span>
                        <span className="font-mono">
                          {new Date(m.createdAt).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div
                        className={`p-3.5 rounded-2xl max-w-[85%] text-xs leading-relaxed ${
                          isCustomer
                            ? 'bg-slate-800 text-slate-100 rounded-tr-none border border-slate-700/60'
                            : 'bg-indigo-600 text-white rounded-tl-none shadow-md shadow-indigo-600/20'
                        }`}
                      >
                        {m.message}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reply Input Box */}
              <div className="p-3 border-t border-slate-800 bg-slate-950/50">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendReply()}
                    placeholder="اكتب ردك لفريق الدعم هنا..."
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={handleSendReply}
                    disabled={actionLoading || !replyText.trim()}
                    className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl transition-all shadow-md shadow-indigo-600/25 flex items-center justify-center"
                  >
                    <Send className="w-4 h-4 rotate-180" />
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-1.5 pr-1">
                  ملاحظة: الردود مسجلة وموثقة في سجل الرقابة المصرفية.
                </p>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 space-y-2">
              <MessageSquare className="w-12 h-12 text-slate-700" />
              <p className="text-xs">اختر تذكرة من القائمة الجانبية لعرض تفاصيل المحادثة والرد عليها.</p>
            </div>
          )}
        </div>
      </div>

      {/* New Ticket Modal */}
      {isNewTicketModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-indigo-400" />
                فتح تذكرة دعم فني أو شكوى جديدة
              </h3>
              <button onClick={() => setIsNewTicketModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">تصنيف الشكوى:</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                >
                  <option value="ORDER_ISSUE">مشكلة في شحن طلب (تأخر أو فشل الشحن)</option>
                  <option value="REFUND_REQUEST">طلب استرداد مالي (Dispute Refund)</option>
                  <option value="DEPOSIT_ISSUE">مشكلة في إيداع رصيد المحفظة</option>
                  <option value="ACCOUNT_ISSUE">مشكلة في الحساب أو الأمان</option>
                  <option value="GENERAL_INQUIRY">استفسار عام أو اقتراح</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">عنوان التذكرة:</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="مثال: لم يصل رصيد شدات ببجي"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">
                  رقم الطلب أو الإيداع المرتبط (اختياري):
                </label>
                <input
                  type="text"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  placeholder="مثال: ORD-20261011-002"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">تفاصيل المشكلة والوصف الكامل:</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="اشرح المشكلة بدقة مع ذكر رقم الآيدي أو الحساب المتأثر..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white h-24"
                />
              </div>

              <div className="p-3 bg-indigo-950/30 border border-indigo-500/20 rounded-xl text-indigo-300 text-[11px]">
                نظام حماية الشبكة الضعيفة: التذاكر محمية برمز منع التكرار. لن يتم تكرار إرسال التذكرة عند انقطاع الاتصال.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setIsNewTicketModalOpen(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs"
              >
                إلغاء
              </button>
              <button
                onClick={handleCreateTicket}
                disabled={actionLoading || !subject.trim() || !description.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl text-xs font-bold"
              >
                {actionLoading ? 'جارٍ الإرسال...' : 'إرسال التذكرة'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
