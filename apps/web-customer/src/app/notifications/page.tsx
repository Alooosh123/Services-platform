'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  ShoppingBag,
  DollarSign,
  ShieldAlert,
  MessageSquare,
  RefreshCw,
  CheckCheck,
  Clock,
  Layers,
} from 'lucide-react';
import { apiUrl } from '../../lib/api';

export default function CustomerNotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const getAuthHeader = (): Record<string, string> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('customer_token') : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchNotifications = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(apiUrl('/notifications?limit=50'), {
        headers: getAuthHeader(),
      });
      if (res.ok) {
        const json = await res.json();
        setNotifications(json.notifications || []);
        setUnreadCount(json.unreadCount || 0);
      } else {
        setNotifications([]);
        setUnreadCount(0);
        setLoadError('تعذر تحميل الإشعارات. يرجى تسجيل الدخول ثم المحاولة مجدداً.');
      }
    } catch (err) {
      setNotifications([]);
      setUnreadCount(0);
      setLoadError(err instanceof Error ? err.message : 'تعذر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  const loadFallbackNotifications = () => {
    const demo = [
      {
        id: 'n1',
        type: 'ORDER_UPDATE',
        title: 'تم اكتمال شحن طلبك بنجاح',
        message: 'تم شحن 60 شدة ببجي موبايل إلى الحساب 512345678 بنجاح، رقم الطلب ORD-20261011-001.',
        status: 'UNREAD',
        createdAt: new Date(Date.now() - 1800000).toISOString(),
        data: { orderId: 'ORD-20261011-001' },
      },
      {
        id: 'n2',
        type: 'DEPOSIT_CONFIRMED',
        title: 'تم تأكيد إيداع الرصيد في محفظتك',
        message: 'تمت إضافة 50,000 ريال يمني إلى محفظتك بموجب الحوالة رقم 99882233.',
        status: 'UNREAD',
        createdAt: new Date(Date.now() - 7200000).toISOString(),
        data: { depositId: 'DEP-001' },
      },
      {
        id: 'n3',
        type: 'SUPPORT_REPLY',
        title: 'رد جديد على تذكرة الدعم',
        message: 'قام موظف الدعم الفني بالرد على تذكرتك بخصوص استفسار الشحن.',
        status: 'READ',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        data: { ticketId: 'TCK-20261011-001' },
      },
    ];
    setNotifications(demo);
    setUnreadCount(demo.filter((d) => d.status === 'UNREAD').length);
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAsRead = async (id: string) => {
    try {
      await fetch(apiUrl(`/notifications/${id}/read`), {
        method: 'PATCH',
        headers: getAuthHeader(),
      });
    } catch {}

    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, status: 'READ', readAt: new Date().toISOString() } : n)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const handleMarkAllAsRead = async () => {
    setActionLoading(true);
    try {
      await fetch(apiUrl('/notifications/mark-all-read'), {
        method: 'POST',
        headers: getAuthHeader(),
      });
    } catch {}

    setNotifications((prev) =>
      prev.map((n) => ({ ...n, status: 'READ', readAt: new Date().toISOString() })),
    );
    setUnreadCount(0);
    setActionLoading(false);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'ORDER_UPDATE':
        return <ShoppingBag className="w-5 h-5 text-emerald-400" />;
      case 'DEPOSIT_CONFIRMED':
        return <DollarSign className="w-5 h-5 text-indigo-400" />;
      case 'SECURITY_ALERT':
        return <ShieldAlert className="w-5 h-5 text-rose-400" />;
      case 'SUPPORT_REPLY':
        return <MessageSquare className="w-5 h-5 text-blue-400" />;
      default:
        return <Bell className="w-5 h-5 text-slate-400" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6 text-right" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Bell className="w-6 h-6 text-indigo-400" />
            مركز الإشعارات والتنبيهات
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            إشعارات لحظية ومؤكدة بحالة طلبات الشحن، تأكيدات الإيداعات، وردود الدعم الفني.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              disabled={actionLoading}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition-colors"
            >
              <CheckCheck className="w-4 h-4 text-emerald-400" />
              تعليم الكل كمقروء
            </button>
          )}
          <button
            onClick={fetchNotifications}
            className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-slate-400 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {notifications.map((n) => {
          const isUnread = n.status === 'UNREAD';
          return (
            <div
              key={n.id}
              onClick={() => isUnread && handleMarkAsRead(n.id)}
              className={`p-4 rounded-2xl border transition-all flex items-start gap-4 cursor-pointer ${
                isUnread
                  ? 'bg-slate-900/90 border-indigo-500/40 shadow-lg shadow-indigo-500/5'
                  : 'bg-slate-900/40 border-slate-800/80 hover:bg-slate-900/60'
              }`}
            >
              <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 shrink-0">
                {getIcon(n.type)}
              </div>

              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    {n.title}
                    {isUnread && (
                      <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                    )}
                  </h3>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {new Date(n.createdAt).toLocaleDateString('ar-YE', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{n.message}</p>

                {n.data?.orderId && (
                  <div className="pt-1.5">
                    <Link
                      href="/orders"
                      className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1"
                    >
                      عرض تفاصيل الطلب &larr;
                    </Link>
                  </div>
                )}
                {n.data?.ticketId && (
                  <div className="pt-1.5">
                    <Link
                      href="/support"
                      className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1"
                    >
                      عرض تذكرة الدعم &larr;
                    </Link>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {loadError && !loading && (
          <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-center text-sm text-rose-400">
            {loadError}
          </p>
        )}
        {notifications.length === 0 && !loading && !loadError && (
          <div className="p-12 text-center bg-slate-900/50 border border-slate-800 rounded-2xl text-slate-500 space-y-2">
            <Bell className="w-10 h-10 mx-auto text-slate-700" />
            <p className="text-xs">لا توجد لديك إشعارات حالياً.</p>
          </div>
        )}
      </div>
    </div>
  );
}
