'use client';

import React, { useState } from 'react';
import { TeamMember } from '@/types';
import {
  Users,
  Search,
  UserPlus,
  Mail,
  Briefcase,
  Phone,
  Check,
  X,
  Plus,
  Shield,
  Building,
} from 'lucide-react';

interface TeamDirectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamMembers: TeamMember[];
  onAddRecipient: (email: string, field: 'to' | 'cc' | 'bcc') => void;
  onRegisterMember: (newMember: Partial<TeamMember>) => Promise<void>;
  selectedTo: string[];
  selectedCc: string[];
  selectedBcc: string[];
}

export const TeamDirectoryModal: React.FC<TeamDirectoryModalProps> = ({
  isOpen,
  onClose,
  teamMembers,
  onAddRecipient,
  onRegisterMember,
  selectedTo,
  selectedCc,
  selectedBcc,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [isRegistering, setIsRegistering] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: '',
    department: 'الهندسة والتقنية',
    phone: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  // Extract unique departments
  const departments = ['all', ...Array.from(new Set(teamMembers.map((m) => m.department)))];

  const filteredMembers = teamMembers.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.role.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = selectedDept === 'all' || m.department === selectedDept;
    return matchesSearch && matchesDept;
  });

  const handleSubmitNewMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) return;

    setIsSubmitting(true);
    try {
      await onRegisterMember(formData);
      setFormData({
        name: '',
        email: '',
        role: '',
        department: 'الهندسة والتقنية',
        phone: '',
      });
      setIsRegistering(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-right">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                دليل أعضاء الفريق والمستلمين
                <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-semibold">
                  {teamMembers.length} مسجل بالإيميل
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                قائمة جميع أفراد الفريق المسجلين بالإيميل لتحديد المستلمين بضغطة زر
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar: Search, Filter, Register Toggle */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[260px]">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ابحث بالاسم، الإيميل، أو المسمى الوظيفي..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-3 pr-9 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="px-3 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-sky-500"
            >
              <option value="all">كافة الإدارات ({teamMembers.length})</option>
              {departments
                .filter((d) => d !== 'all')
                .map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
            </select>
          </div>

          <button
            onClick={() => setIsRegistering(!isRegistering)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm ${
              isRegistering
                ? 'bg-slate-800 text-slate-300 border border-slate-700'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>{isRegistering ? 'إغلاق نموذج التسجيل' : 'تسجيل عضو جديد بالإيميل'}</span>
          </button>
        </div>

        {/* New Member Registration Box (Collapsible) */}
        {isRegistering && (
          <form
            onSubmit={handleSubmitNewMember}
            className="p-5 bg-slate-800/40 border-b border-slate-800 animate-in slide-in-from-top-2 duration-200"
          >
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-emerald-400" />
              بيانات تسجيل عضو جديد في المنصة
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">الاسم الكامل *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: م. عمر الحسني"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">البريد الإلكتروني الرسمي *</label>
                <input
                  type="email"
                  required
                  placeholder="omar.tech@company.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">المسمى الوظيفي</label>
                <input
                  type="text"
                  placeholder="مثال: مهندس واجهات أمامية"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">القسم / الإدارة</label>
                <input
                  type="text"
                  placeholder="مثال: الهندسة والتقنية"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">رقم الهاتف / التحويلة</label>
                <input
                  type="text"
                  placeholder="+967 777 000 000"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md"
                >
                  {isSubmitting ? 'جاري التسجيل...' : 'تأكيد التسجيل وإضافة للدليل'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Members Grid / List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredMembers.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Users className="w-12 h-12 mx-auto mb-2 text-slate-600" />
              <p className="text-sm">لا يوجد أعضاء يطابقون معايير البحث.</p>
            </div>
          ) : (
            filteredMembers.map((member) => {
              const isTo = selectedTo.includes(member.email);
              const isCc = selectedCc.includes(member.email);
              const isBcc = selectedBcc.includes(member.email);

              return (
                <div
                  key={member.id}
                  className="p-3 bg-slate-800/40 hover:bg-slate-800/80 border border-slate-800/80 hover:border-slate-700 rounded-xl flex items-center justify-between gap-4 transition-all"
                >
                  {/* Member Info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative flex-shrink-0">
                      <img
                        src={member.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(member.name)}`}
                        alt={member.name}
                        className="w-10 h-10 rounded-xl object-cover ring-1 ring-slate-700"
                      />
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${
                          member.status === 'online'
                            ? 'bg-emerald-500'
                            : member.status === 'busy'
                            ? 'bg-amber-500'
                            : 'bg-slate-500'
                        }`}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white truncate">
                          {member.name}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-700/60 text-slate-300 font-medium">
                          {member.department}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                        <span className="flex items-center gap-1 text-slate-300 truncate">
                          <Briefcase className="w-3 h-3 text-slate-500" />
                          {member.role}
                        </span>
                        <span className="flex items-center gap-1 font-mono text-[11px] text-sky-400/90 truncate">
                          <Mail className="w-3 h-3 text-sky-500" />
                          {member.email}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Recipient Assignment Buttons */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {/* Add to TO */}
                    <button
                      onClick={() => onAddRecipient(member.email, 'to')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                        isTo
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                          : 'bg-slate-700/50 hover:bg-sky-600/30 text-slate-300 hover:text-white border border-slate-700'
                      }`}
                      title={isTo ? 'محدد مسبقاً في (إلى)' : 'إضافة إلى المستلمين (To)'}
                    >
                      {isTo ? <Check className="w-3 h-3 text-sky-400" /> : <Plus className="w-3 h-3" />}
                      <span>إلى (To)</span>
                    </button>

                    {/* Add to CC */}
                    <button
                      onClick={() => onAddRecipient(member.email, 'cc')}
                      className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                        isCc
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                          : 'bg-slate-700/50 hover:bg-indigo-600/30 text-slate-300 hover:text-white border border-slate-700'
                      }`}
                      title={isCc ? 'محدد مسبقاً في (نسخة)' : 'إضافة إلى نسخة (CC)'}
                    >
                      {isCc ? <Check className="w-3 h-3 text-indigo-400" /> : <Plus className="w-3 h-3" />}
                      <span>نسخة (CC)</span>
                    </button>

                    {/* Add to BCC */}
                    <button
                      onClick={() => onAddRecipient(member.email, 'bcc')}
                      className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                        isBcc
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                          : 'bg-slate-700/50 hover:bg-purple-600/30 text-slate-300 hover:text-white border border-slate-700'
                      }`}
                      title={isBcc ? 'محدد مسبقاً في (مخفية)' : 'إضافة إلى نسخة مخفية (BCC)'}
                    >
                      {isBcc ? <Check className="w-3 h-3 text-purple-400" /> : <Plus className="w-3 h-3" />}
                      <span>مخفية (BCC)</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between text-xs text-slate-400">
          <div>
            تم تحديد: <strong className="text-white">{selectedTo.length}</strong> مستلم في (إلى)،{' '}
            <strong className="text-white">{selectedCc.length}</strong> في (نسخة)
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold transition-all shadow-sm"
          >
            إتمام التحديد والعودة
          </button>
        </div>
      </div>
    </div>
  );
};
