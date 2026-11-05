'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Bell,
  HelpCircle,
  Link as LinkIcon,
  ShoppingBag,
  User,
  Wallet,
  Zap,
} from 'lucide-react';
import { apiRequest, getCustomerToken } from '../lib/api';

export function Navbar() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [yerBalance, setYerBalance] = useState<string | null>(null);

  useEffect(() => {
    const loadAccountData = async () => {
      if (!getCustomerToken()) return;

      const userJson = window.localStorage.getItem('customer_user');
      if (userJson) {
        try {
          const user = JSON.parse(userJson);
          setCustomerName(user.fullName || user.email || null);
        } catch {
          window.localStorage.removeItem('customer_user');
        }
      }

      const [notifications, wallets] = await Promise.allSettled([
        apiRequest<{ unreadCount?: number }>('/notifications?limit=1'),
        apiRequest<Array<{ currency: string; availableBalance?: number; balance: number }>>('/wallet/balances'),
      ]);
      if (notifications.status === 'fulfilled') {
        setUnreadCount(notifications.value.unreadCount || 0);
      }
      if (wallets.status === 'fulfilled') {
        const yerWallet = wallets.value.find((wallet) => wallet.currency === 'YER');
        if (yerWallet) {
          setYerBalance(Number(yerWallet.availableBalance ?? yerWallet.balance).toLocaleString());
        }
      }
    };

    void loadAccountData();
    window.addEventListener('customer-session-changed', loadAccountData);
    return () => window.removeEventListener('customer-session-changed', loadAccountData);
  }, []);

  return (
    <header className="sticky top-0 z-50 bg-slate-950/85 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform">
            <Zap className="w-5 h-5 fill-white" />
          </div>
          <div>
            <span className="font-extrabold text-lg text-white tracking-tight">منصة توب آب</span>
            <span className="block text-[10px] text-indigo-400 font-medium">شحن فوري للألعاب والبطاقات</span>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-5 text-sm font-medium">
          <Link href="/" className="text-slate-300 hover:text-white transition-colors">متجر الخدمات</Link>
          <Link href="/orders" className="text-slate-300 hover:text-white transition-colors flex items-center gap-1.5">
            <ShoppingBag className="w-4 h-4 text-slate-400" /> طلباتي
          </Link>
          <Link href="/linked-accounts" className="text-slate-300 hover:text-white transition-colors flex items-center gap-1.5">
            <LinkIcon className="w-4 h-4 text-slate-400" /> الحسابات المرتبطة
          </Link>
          <Link href="/support" className="text-slate-300 hover:text-white transition-colors flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-indigo-400" /> مركز الدعم والشكاوى
          </Link>
          <Link href="/wallet" className="text-slate-300 hover:text-white transition-colors flex items-center gap-1.5">
            <Wallet className="w-4 h-4 text-emerald-400" /> المحفظة
          </Link>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/notifications"
            className="relative p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl transition-colors shadow-sm"
            title="الإشعارات"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500 text-white rounded-full text-[9px] font-black flex items-center justify-center animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>

          <Link href="/wallet" className="hidden sm:flex items-center gap-2 bg-slate-900 border border-slate-800 hover:border-slate-700 px-3.5 py-1.5 rounded-xl transition-colors shadow-sm">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-slate-400">المحفظة:</span>
            <span className="text-xs font-bold font-mono text-emerald-400">{yerBalance ?? '—'} YER</span>
          </Link>

          <Link
            href={customerName ? '/wallet' : '/login'}
            className="flex items-center gap-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-300 transition-colors"
          >
            <User className="w-4 h-4" />
            <span className="hidden sm:inline">{customerName || 'حسابي'}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
