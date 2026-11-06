'use client';

import React, { useState } from 'react';
import { TeamMember } from '@/types';
import {
  UserCheck,
  UserPlus,
  Mail,
  Briefcase,
  X,
  Check,
  Building,
  KeyRound,
  LogIn,
} from 'lucide-react';

interface UserSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: TeamMember;
  teamMembers: TeamMember[];
  onSelectUser: (user: TeamMember) => void;
  onQuickRegister: (email: string, name: string) => Promise<TeamMember>;
}

export const UserSwitchModal: React.FC<UserSwitchModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  teamMembers,
  onSelectUser,
  onQuickRegister,
}) => {
  const [emailInput, setEmailInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [isNewUserForm, setIsNewUserForm] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleQuickLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const cleanEmail = emailInput.trim().toLowerCase();

    if (!cleanEmail) {
      setErrorMsg('يرجى إدخال البريد الإلكتروني');
      return;
    }

    const found = teamMembers.find((m) => m.email.toLowerCase() === cleanEmail);
    if (found) {
      onSelectUser(found);
      onClose();
      return;
    }

    // If not found and name provided, register on the fly
    if (nameInput.trim()) {
      try {
        const created = await onQuickRegister(cleanEmail, nameInput.trim());
        onSelectUser(created);
        onClose();
      } catch (err: any) {
        setErrorMsg('فشل تسجيل الدخول: ' + err.message);
      }
    } else {
      setIsNewUserForm(true);
      setErrorMsg('هذا البريد غير مسجل مسبقاً، يرجى كتابة اسمك لتسجيلك فوراً في المنصة.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden text-right">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">تسجيل الدخول / تبديل العضو المرسل</h2>
              <p className="text-xs text-slate-400">
                اختر الحساب الذي ترغب في إرسال الإيميلات وتوقيعها باسمه
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Email Login Form */}
        <form onSubmit={handleQuickLogin} className="p-4 bg-slate-950/40 border-b border-slate-800">
          <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-sky-400" />
            تسجيل الدخول السريع عبر البريد الإلكتروني:
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="email"
              required
              placeholder="name@company.com"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg flex items-center gap-1 transition-all shadow-md shadow-emerald-950/40"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>دخول</span>
            </button>
          </div>

          {isNewUserForm && (
            <div className="mt-2 animate-in slide-in-from-top-1 duration-150">
              <input
                type="text"
                placeholder="اكتب اسمك الكامل (لتسجيل حساب جديد فوراً)"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-emerald-500/60 rounded-lg text-xs text-white placeholder-slate-400 mb-1"
              />
            </div>
          )}

          {errorMsg && (
            <div className="text-[11px] text-amber-400 mt-1 font-medium">{errorMsg}</div>
          )}
        </form>

        {/* Quick Switch from Registered List */}
        <div className="p-4 max-h-[360px] overflow-y-auto space-y-2">
          <span className="text-xs font-bold text-slate-400 block mb-2">
            أو اختر من حسابات الفريق المسجلة حالياً:
          </span>
          {teamMembers.map((member) => {
            const isCurrent = member.id === currentUser.id;
            return (
              <button
                key={member.id}
                type="button"
                onClick={() => {
                  onSelectUser(member);
                  onClose();
                }}
                className={`w-full text-right p-3 rounded-xl border flex items-center justify-between transition-all ${
                  isCurrent
                    ? 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500'
                    : 'border-slate-800 bg-slate-800/40 hover:bg-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <img
                    src={member.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(member.name)}`}
                    alt={member.name}
                    className="w-9 h-9 rounded-xl object-cover ring-1 ring-slate-700"
                  />
                  <div>
                    <div className="font-bold text-xs text-white flex items-center gap-2">
                      <span>{member.name}</span>
                      {isCurrent && (
                        <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                          الحساب النشط
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {member.role} &bull; {member.department}
                    </div>
                    <div className="text-[10px] text-sky-400 font-mono mt-0.5">
                      {member.email}
                    </div>
                  </div>
                </div>

                {isCurrent && <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/90 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
};
