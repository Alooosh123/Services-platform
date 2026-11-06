'use client';

import React from 'react';
import { EmailDraft, TemplateType, UrgencyLevel, TeamMember } from '@/types';
import { TEMPLATES } from '@/lib/constants';
import {
  FileText,
  CheckSquare,
  Calendar,
  ShieldCheck,
  AlertTriangle,
  BarChart3,
  Award,
  CreditCard,
  Plus,
  Trash2,
  Users,
  Sparkles,
  RefreshCw,
  Paperclip,
  Check,
} from 'lucide-react';

interface FormFieldsEditorProps {
  draft: EmailDraft;
  onChange: (updated: EmailDraft) => void;
  teamMembers: TeamMember[];
  onOpenDirectory: () => void;
}

const TEMPLATE_ICONS: Record<TemplateType, any> = {
  memo: FileText,
  task: CheckSquare,
  meeting: Calendar,
  approval: ShieldCheck,
  warning: AlertTriangle,
  status_report: BarChart3,
  appreciation: Award,
  financial: CreditCard,
};

export const FormFieldsEditor: React.FC<FormFieldsEditorProps> = ({
  draft,
  onChange,
  teamMembers,
  onOpenDirectory,
}) => {
  const handleTemplateChange = (templateId: TemplateType) => {
    const tmpl = TEMPLATES[templateId];
    onChange({
      ...draft,
      templateId,
      greeting: draft.greeting || tmpl.defaultGreeting,
      closing: draft.closing || tmpl.defaultClosing,
      callToAction: {
        ...draft.callToAction,
        buttonLabel: draft.callToAction.buttonLabel || tmpl.sampleButtonLabel || 'الاطلاع والاتخاذ اللازم',
      },
    });
  };

  const handleAddBulletPoint = () => {
    onChange({
      ...draft,
      bulletPoints: [...draft.bulletPoints, 'بند تنظيمي جديد...'],
    });
  };

  const handleUpdateBulletPoint = (index: number, value: string) => {
    const updated = [...draft.bulletPoints];
    updated[index] = value;
    onChange({
      ...draft,
      bulletPoints: updated,
    });
  };

  const handleRemoveBulletPoint = (index: number) => {
    const updated = draft.bulletPoints.filter((_, i) => i !== index);
    onChange({
      ...draft,
      bulletPoints: updated,
    });
  };

  const handleRemoveRecipient = (email: string, field: 'to' | 'cc') => {
    onChange({
      ...draft,
      [field]: draft[field].filter((e) => e !== email),
    });
  };

  const handleGenerateRef = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const dateStr = new Date().toISOString().slice(2, 7).replace('-', '');
    onChange({
      ...draft,
      referenceNumber: `REF-${dateStr}/${randomNum}`,
    });
  };

  const handleAddAttachment = () => {
    const newAtt = {
      name: `وثيقة_رسمية_مرفقة_${(draft.attachments?.length || 0) + 1}.pdf`,
      size: '1.4 MB',
      type: 'pdf',
    };
    onChange({
      ...draft,
      attachments: [...(draft.attachments || []), newAtt],
    });
  };

  const handleRemoveAttachment = (index: number) => {
    onChange({
      ...draft,
      attachments: draft.attachments.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-5 text-right bg-slate-900 text-slate-200">
      {/* 1. Template Selector Grid */}
      <div>
        <label className="block text-xs font-bold text-slate-300 mb-2">
          اختر القالب الرسمي (أو دَع الشات يختاره لك):
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(Object.keys(TEMPLATES) as TemplateType[]).map((tmplKey) => {
            const tmpl = TEMPLATES[tmplKey];
            const Icon = TEMPLATE_ICONS[tmplKey] || FileText;
            const isSelected = draft.templateId === tmplKey;

            return (
              <button
                key={tmplKey}
                type="button"
                onClick={() => handleTemplateChange(tmplKey)}
                className={`p-2.5 rounded-xl border text-right transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'border-sky-500 bg-sky-500/15 shadow-md shadow-sky-950/50 ring-1 ring-sky-500'
                    : 'border-slate-800 bg-slate-800/40 hover:bg-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-xs"
                    style={{
                      backgroundColor: `${tmpl.colorScheme.primary}25`,
                      color: tmpl.colorScheme.accent,
                    }}
                  >
                    <Icon className="w-4 h-4" />
                  </span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-sky-400" />}
                </div>
                <div className="font-bold text-xs text-white line-clamp-1">{tmpl.title}</div>
                <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{tmpl.badge}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Recipients Section */}
      <div className="space-y-3 p-3 bg-slate-800/40 rounded-xl border border-slate-800">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-white flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-sky-400" />
            المستلمون من دليل أعضاء الفريق:
          </label>
          <button
            type="button"
            onClick={onOpenDirectory}
            className="text-[11px] font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1"
          >
            <span>+ فتح الدليل لتحديد المستلمين</span>
          </button>
        </div>

        {/* TO field */}
        <div>
          <span className="text-[11px] text-slate-400 block mb-1">إلى (To):</span>
          <div className="flex flex-wrap gap-1.5 p-2 bg-slate-900 border border-slate-700/80 rounded-lg min-h-[38px] items-center">
            {draft.to.length === 0 ? (
              <span className="text-xs text-slate-500">لم يتم تحديد مستلمين بعد (اضغط فتح الدليل)</span>
            ) : (
              draft.to.map((email) => {
                const member = teamMembers.find((m) => m.email === email);
                return (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs"
                  >
                    <span>{member ? member.name : email}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveRecipient(email, 'to')}
                      className="hover:text-red-400 transition-colors"
                    >
                      &times;
                    </button>
                  </span>
                );
              })
            )}
          </div>
        </div>

        {/* CC field */}
        <div>
          <span className="text-[11px] text-slate-400 block mb-1">نسخة إلى (CC):</span>
          <div className="flex flex-wrap gap-1.5 p-2 bg-slate-900 border border-slate-700/80 rounded-lg min-h-[38px] items-center">
            {draft.cc.length === 0 ? (
              <span className="text-xs text-slate-500">لا يوجد (اختياري)</span>
            ) : (
              draft.cc.map((email) => {
                const member = teamMembers.find((m) => m.email === email);
                return (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs"
                  >
                    <span>{member ? member.name : email}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveRecipient(email, 'cc')}
                      className="hover:text-red-400 transition-colors"
                    >
                      &times;
                    </button>
                  </span>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 3. Subject, Urgency & Reference */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs font-bold text-slate-300 mb-1">موضوع الإيميل (Subject) *</label>
          <input
            type="text"
            value={draft.subject}
            onChange={(e) => onChange({ ...draft, subject: e.target.value })}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-sky-500 font-semibold"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1">درجة الأهمية (Urgency)</label>
          <select
            value={draft.urgency}
            onChange={(e) => onChange({ ...draft, urgency: e.target.value as UrgencyLevel })}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-sky-500 font-medium"
          >
            <option value="normal">عادي / روتيني</option>
            <option value="important">هام وأولوية</option>
            <option value="urgent">عاجل جداً وطارئ</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">الرقم المرجعي الرسمي (REF)</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={draft.referenceNumber}
              onChange={(e) => onChange({ ...draft, referenceNumber: e.target.value })}
              className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs font-mono text-white"
            />
            <button
              type="button"
              onClick={handleGenerateRef}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white"
              title="توليد رقم مرجعي جديد"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">تاريخ المراسلة</label>
          <input
            type="text"
            value={draft.date}
            onChange={(e) => onChange({ ...draft, date: e.target.value })}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
          />
        </div>
      </div>

      {/* 4. Greeting & Intro */}
      <div>
        <label className="block text-xs font-bold text-slate-300 mb-1">التحية الافتتاحية</label>
        <input
          type="text"
          value={draft.greeting}
          onChange={(e) => onChange({ ...draft, greeting: e.target.value })}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-300 mb-1">المقدمة والسياق الإداري</label>
        <textarea
          rows={2}
          value={draft.intro}
          onChange={(e) => onChange({ ...draft, intro: e.target.value })}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white resize-none"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-300 mb-1">صلب الرسالة والموضوع الرئيسي</label>
        <textarea
          rows={3}
          value={draft.mainContent}
          onChange={(e) => onChange({ ...draft, mainContent: e.target.value })}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white resize-none"
        />
      </div>

      {/* 5. Bullet Points Manager */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold text-slate-300">النقاط والمحددات المرتبة (Bullet Points):</label>
          <button
            type="button"
            onClick={handleAddBulletPoint}
            className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة نقطة</span>
          </button>
        </div>
        <div className="space-y-2">
          {draft.bulletPoints.map((point, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs flex items-center justify-center font-bold">
                {index + 1}
              </span>
              <input
                type="text"
                value={point}
                onChange={(e) => handleUpdateBulletPoint(index, e.target.value)}
                className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-sky-500"
              />
              <button
                type="button"
                onClick={() => handleRemoveBulletPoint(index)}
                className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                title="حذف النقطة"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 6. Call to Action & Deadline */}
      <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-800 space-y-3">
        <label className="block text-xs font-bold text-amber-400">
          الإجراء المطلوب والموعد النهائي (Call to Action):
        </label>
        <textarea
          rows={2}
          placeholder="الإجراء أو القرار المطلوب من المستلم..."
          value={draft.callToAction?.text || ''}
          onChange={(e) =>
            onChange({
              ...draft,
              callToAction: { ...draft.callToAction, text: e.target.value },
            })
          }
          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">الموعد النهائي (Deadline)</label>
            <input
              type="text"
              placeholder="مثال: الخميس القادم الساعة 4:00 عصراً"
              value={draft.callToAction?.deadline || ''}
              onChange={(e) =>
                onChange({
                  ...draft,
                  callToAction: { ...draft.callToAction, deadline: e.target.value },
                })
              }
              className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">نص زر التفاعل السريع</label>
            <input
              type="text"
              placeholder="مثال: اعتماد الطلب رسمياً"
              value={draft.callToAction?.buttonLabel || ''}
              onChange={(e) =>
                onChange({
                  ...draft,
                  callToAction: { ...draft.callToAction, buttonLabel: e.target.value },
                })
              }
              className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
            />
          </div>
        </div>
      </div>

      {/* 7. Attachments */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Paperclip className="w-3.5 h-3.5 text-slate-400" />
            المرفقات الرسمية ({(draft.attachments || []).length})
          </label>
          <button
            type="button"
            onClick={handleAddAttachment}
            className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة مرفق تجريبي</span>
          </button>
        </div>
        <div className="space-y-1.5">
          {(draft.attachments || []).map((att, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2 bg-slate-800 border border-slate-700 rounded-lg text-xs"
            >
              <div className="flex items-center gap-2 text-slate-300">
                <FileText className="w-3.5 h-3.5 text-sky-400" />
                <span className="font-semibold text-white">{att.name}</span>
                <span className="text-[11px] text-slate-400">({att.size})</span>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveAttachment(idx)}
                className="text-slate-500 hover:text-red-400"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 8. Closing */}
      <div>
        <label className="block text-xs font-bold text-slate-300 mb-1">الخاتمة الرسمية</label>
        <input
          type="text"
          value={draft.closing}
          onChange={(e) => onChange({ ...draft, closing: e.target.value })}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
        />
      </div>
    </div>
  );
};
