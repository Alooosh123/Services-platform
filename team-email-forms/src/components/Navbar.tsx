'use client';

import React from 'react';
import { BrandIdentity, TeamMember } from '@/types';
import {
  Users,
  Palette,
  Send,
  History,
  Sparkles,
  UserCheck,
  PlusCircle,
  Building2,
  ChevronDown,
} from 'lucide-react';

interface NavbarProps {
  brand: BrandIdentity;
  currentUser: TeamMember;
  teamMembers: TeamMember[];
  onOpenDirectory: () => void;
  onOpenBrandSettings: () => void;
  onOpenSentHistory: () => void;
  onOpenUserSwitch: () => void;
  onNewDraft: () => void;
  sentCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  brand,
  currentUser,
  teamMembers,
  onOpenDirectory,
  onOpenBrandSettings,
  onOpenSentHistory,
  onOpenUserSwitch,
  onNewDraft,
  sentCount,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 backdrop-blur-md bg-opacity-95">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand & Title */}
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition-transform hover:scale-105"
            style={{
              background: `linear-gradient(135deg, ${brand.primaryColor}, ${brand.secondaryColor})`,
            }}
          >
            {brand.logoUrl ? (
              <img
                src={brand.logoUrl}
                alt="Logo"
                className="w-7 h-7 object-contain drop-shadow"
              />
            ) : (
              <Building2 className="w-5 h-5 text-white" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base sm:text-lg tracking-tight text-white flex items-center gap-1.5">
                {brand.companyName}
                <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Sparkles className="w-3 h-3" /> استوديو المراسلات
                </span>
              </h1>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              {brand.companySubtitle}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* New Draft Button */}
          <button
            onClick={onNewDraft}
            className="px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-all shadow-sm"
            title="إنشاء مسودة إيميل جديدة"
          >
            <PlusCircle className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">مسودة جديدة</span>
          </button>

          {/* Directory Button with member count badge */}
          <button
            onClick={onOpenDirectory}
            className="px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-all shadow-sm relative"
            title="دليل أعضاء الفريق المسجلين"
          >
            <Users className="w-4 h-4 text-sky-400" />
            <span className="hidden md:inline">أعضاء الفريق</span>
            <span className="bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs px-1.5 py-0.2 rounded-full font-bold">
              {teamMembers.length}
            </span>
          </button>

          {/* Brand & Identity Customizer */}
          <button
            onClick={onOpenBrandSettings}
            className="px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-all shadow-sm"
            title="تخصيص الشعار والهوية البصرية للقوالب"
          >
            <Palette className="w-4 h-4 text-amber-400" />
            <span className="hidden lg:inline">الهوية والشعار</span>
          </button>

          {/* Sent History Archive */}
          <button
            onClick={onOpenSentHistory}
            className="px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-all shadow-sm"
            title="سجل الإيميلات الصادرة"
          >
            <History className="w-4 h-4 text-purple-400" />
            <span className="hidden md:inline">الصادر</span>
            {sentCount > 0 && (
              <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs px-1.5 py-0.2 rounded-full font-bold">
                {sentCount}
              </span>
            )}
          </button>

          <div className="h-6 w-px bg-slate-800 mx-1 hidden sm:block" />

          {/* Current Logged In Member Card */}
          <button
            onClick={onOpenUserSwitch}
            className="flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 transition-all text-right group"
            title="تسجيل الدخول / تبديل العضو المرسل"
          >
            <div className="relative">
              <img
                src={currentUser.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(currentUser.name)}`}
                alt={currentUser.name}
                className="w-8 h-8 rounded-lg object-cover ring-2 ring-emerald-500/50"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-900" />
            </div>
            <div className="hidden sm:block">
              <div className="text-xs font-bold text-white group-hover:text-sky-300 transition-colors line-clamp-1">
                {currentUser.name}
              </div>
              <div className="text-[10px] text-slate-400 line-clamp-1">
                {currentUser.role}
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-white" />
          </button>
        </div>
      </div>
    </header>
  );
};
