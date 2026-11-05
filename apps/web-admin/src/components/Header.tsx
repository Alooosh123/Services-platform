'use client';

import { Bell, Activity } from 'lucide-react';

export function Header({ title }: { title: string }) {
  return (
    <header className="h-16 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-8 sticky top-0 z-30 text-right">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-bold text-white">{title}</h2>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          الـ Backend متصل: منفذ 4000
        </span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-700/60">
          <Activity className="w-3.5 h-3.5 text-indigo-400" />
          <span>المحرك المالي: <strong>قيد مزدوج صارم (ACID)</strong></span>
        </div>
        <button className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors">
          <Bell className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
