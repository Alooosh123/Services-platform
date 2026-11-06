'use client';

import React, { useState } from 'react';
import { SentEmailRecord, TemplateType } from '@/types';
import { TEMPLATES } from '@/lib/constants';
import {
  History,
  CheckCircle2,
  Clock,
  X,
  Eye,
  RotateCcw,
  Search,
  Mail,
  User,
} from 'lucide-react';

interface SentHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  sentRecords: SentEmailRecord[];
  onRestoreDraft?: (record: SentEmailRecord) => void;
}

export const SentHistoryModal: React.FC<SentHistoryModalProps> = ({
  isOpen,
  onClose,
  sentRecords,
  onRestoreDraft,
}) => {
  const [search, setSearch] = useState('');
  const [previewRecord, setPreviewRecord] = useState<SentEmailRecord | null>(null);

  if (!isOpen) return null;

  const filtered = sentRecords.filter(
    (r) =>
      r.subject.toLowerCase().includes(search.toLowerCase()) ||
      r.to.some((t) => t.toLowerCase().includes(search.toLowerCase())) ||
      r.senderName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-right">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                سجل المراسلات والإيميلات الصادرة
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-semibold">
                  {sentRecords.length} مرسلة
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                أرشيف رسمي لجميع الإيميلات التي تم إرسالها بين أعضاء الفريق
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

        {/* Search */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/40">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ابحث في سجل الصادر بالموضوع أو المستلم..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-3 pr-9 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        {/* Content list or preview */}
        <div className="flex-1 overflow-y-auto p-4">
          {previewRecord ? (
            <div className="space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <button
                  onClick={() => setPreviewRecord(null)}
                  className="text-xs text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1"
                >
                  &rarr; العودة لقائمة الأرشيف
                </button>
                <span className="text-xs text-slate-400">
                  تاريخ الإرسال: {new Date(previewRecord.sentAt).toLocaleString('ar-EG')}
                </span>
              </div>
              <div className="rounded-xl overflow-hidden border border-slate-700 bg-white">
                <iframe
                  title="Sent Email Content"
                  srcDoc={previewRecord.htmlContent}
                  className="w-full h-[550px] border-0"
                />
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <History className="w-12 h-12 mx-auto mb-2 text-slate-600" />
              <p className="text-sm font-semibold">لا توجد مراسلات صادرة مسجلة حتى الآن.</p>
              <p className="text-xs text-slate-500 mt-1">
                عند الضغط على "إرسال الإيميل" ستظهر جميع المراسلات هنا تلقائياً.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((record) => {
                const tmpl = TEMPLATES[record.templateId];
                return (
                  <div
                    key={record.id}
                    className="p-3.5 bg-slate-800/40 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl flex items-center justify-between gap-4 transition-all"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-white truncate">
                          {record.subject}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30 flex-shrink-0">
                          {tmpl?.badge || 'رسمي'}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-semibold flex items-center gap-1 flex-shrink-0">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          تم التسليم
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3 text-sky-400" />
                          إلى: <strong className="text-slate-300">{record.to.join(', ')}</strong>
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-500" />
                          المرسل: {record.senderName}
                        </span>
                        <span className="flex items-center gap-1 font-mono text-[11px] text-slate-500">
                          <Clock className="w-3 h-3" />
                          {new Date(record.sentAt).toLocaleString('ar-EG')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => setPreviewRecord(record)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-700/60 hover:bg-slate-700 text-slate-200 flex items-center gap-1 transition-all"
                        title="معاينة محتوى الإيميل المرسل"
                      >
                        <Eye className="w-3.5 h-3.5 text-sky-400" />
                        <span>معاينة</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/90 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
