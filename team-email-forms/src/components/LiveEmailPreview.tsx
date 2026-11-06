'use client';

import React, { useState, useEffect } from 'react';
import { BrandIdentity, EmailDraft } from '@/types';
import { generateEmailHtml } from '@/lib/emailGenerator';
import {
  Monitor,
  Smartphone,
  Code2,
  Copy,
  Check,
  Send,
  ExternalLink,
  Printer,
  Sparkles,
  RefreshCw,
  Mail,
} from 'lucide-react';

interface LiveEmailPreviewProps {
  draft: EmailDraft;
  brand: BrandIdentity;
  onSendEmail: (html: string) => Promise<void>;
  isSending: boolean;
}

export const LiveEmailPreview: React.FC<LiveEmailPreviewProps> = ({
  draft,
  brand,
  onSendEmail,
  isSending,
}) => {
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile' | 'code'>('desktop');
  const [copiedHtml, setCopiedHtml] = useState(false);
  const [renderedHtml, setRenderedHtml] = useState('');

  // Re-generate HTML whenever draft or brand changes
  useEffect(() => {
    const html = generateEmailHtml(draft, brand);
    setRenderedHtml(html);
  }, [draft, brand]);

  // Copy rich HTML to clipboard
  const handleCopyHtml = async () => {
    try {
      if (navigator.clipboard) {
        // Copy both text/html and text/plain to clipboard if supported
        try {
          const blobHtml = new Blob([renderedHtml], { type: 'text/html' });
          const blobText = new Blob([renderedHtml], { type: 'text/plain' });
          const data = [new ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobText })];
          await navigator.clipboard.write(data);
        } catch {
          await navigator.clipboard.writeText(renderedHtml);
        }
      }
      setCopiedHtml(true);
      setTimeout(() => setCopiedHtml(false), 2500);
    } catch (err) {
      console.error('Clipboard copy error:', err);
    }
  };

  // Open default mail client (mailto:)
  const handleOpenMailClient = () => {
    const toStr = (draft.to || []).join(',');
    const ccStr = (draft.cc || []).join(',');
    const subjectEncoded = encodeURIComponent(draft.subject || '');

    const bodyPlain = `
${draft.greeting || ''}

${draft.intro || ''}

${draft.mainContent || ''}

المحددات:
${(draft.bulletPoints || []).map((p, i) => `${i + 1}. ${p}`).join('\n')}

الإجراء المطلوب:
${draft.callToAction?.text || ''}
${draft.callToAction?.deadline ? `الموعد: ${draft.callToAction.deadline}` : ''}

${draft.closing || ''}

--
${draft.sender?.name || ''}
${draft.sender?.role || ''} | ${draft.sender?.department || ''}
${brand.companyName}
`.trim();

    const bodyEncoded = encodeURIComponent(bodyPlain);
    let mailtoUrl = `mailto:${toStr}?subject=${subjectEncoded}&body=${bodyEncoded}`;
    if (ccStr) {
      mailtoUrl += `&cc=${encodeURIComponent(ccStr)}`;
    }
    window.open(mailtoUrl, '_blank');
  };

  const handlePrint = () => {
    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.write(renderedHtml);
      printWin.document.close();
      printWin.focus();
      printWin.print();
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100">
      {/* Top Preview Toolbar */}
      <div className="p-3 border-b border-slate-800 bg-slate-900/90 flex flex-wrap items-center justify-between gap-3">
        {/* View Mode Toggle: Desktop / Mobile / Code */}
        <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800">
          <button
            onClick={() => setViewMode('desktop')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              viewMode === 'desktop'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-900/40'
                : 'text-slate-400 hover:text-white'
            }`}
            title="معاينة سطح المكتب (Outlook / Gmail)"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">سطح المكتب</span>
          </button>
          <button
            onClick={() => setViewMode('mobile')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              viewMode === 'mobile'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-900/40'
                : 'text-slate-400 hover:text-white'
            }`}
            title="معاينة شاشة الهاتف المحمول"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">شاشة الجوال</span>
          </button>
          <button
            onClick={() => setViewMode('code')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              viewMode === 'code'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-900/40'
                : 'text-slate-400 hover:text-white'
            }`}
            title="كود HTML المصدري المتوافق مع كافة برامج البريد"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">كود HTML</span>
          </button>
        </div>

        {/* Action Buttons: Copy HTML, Mail client, Send */}
        <div className="flex items-center gap-2">
          {/* Copy HTML Button */}
          <button
            onClick={handleCopyHtml}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${
              copiedHtml
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
            title="نسخ كود HTML جاهز للصق المباشر في Gmail أو Outlook"
          >
            {copiedHtml ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedHtml ? 'تم النسخ بنجاح!' : 'نسخ HTML'}</span>
          </button>

          {/* Mail Client Button */}
          <button
            onClick={handleOpenMailClient}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-all shadow-sm"
            title="فتح المسودة مباشرة في برنامج البريد الافتراضي على جهازك"
          >
            <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden md:inline">فتح في البريد</span>
          </button>

          {/* Print Button */}
          <button
            onClick={handlePrint}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800 transition-colors hidden sm:block"
            title="طباعة أو حفظ كملف PDF"
          >
            <Printer className="w-4 h-4" />
          </button>

          {/* Send Email Button */}
          <button
            onClick={() => onSendEmail(renderedHtml)}
            disabled={isSending || draft.to.length === 0}
            className="px-4 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white flex items-center gap-1.5 transition-all shadow-md shadow-emerald-950/50"
            title={draft.to.length === 0 ? 'يرجى تحديد مستلم أولاً' : 'إرسال الإيميل للمستلمين'}
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isSending ? 'جاري الإرسال...' : 'إرسال الإيميل'}</span>
          </button>
        </div>
      </div>

      {/* Recipient summary bar */}
      <div className="px-4 py-2 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2 truncate">
          <span className="text-slate-500">المستلم:</span>
          <span className="text-white font-semibold truncate">
            {draft.to.length > 0 ? draft.to.join(', ') : '(لم يُحدد مستلم بعد)'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-sky-400 flex-shrink-0">
          <Sparkles className="w-3 h-3" />
          <span>المعاينة المباشرة (Live Rendering)</span>
        </div>
      </div>

      {/* Main Preview Container */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex items-start justify-center bg-slate-950">
        {viewMode === 'desktop' && (
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-300/40 animate-in fade-in duration-300">
            {/* Desktop Browser Mockup Header */}
            <div className="bg-slate-100 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-400" />
                <span className="w-3 h-3 rounded-full bg-amber-400" />
                <span className="w-3 h-3 rounded-full bg-emerald-400" />
              </div>
              <div className="text-[11px] font-mono text-slate-500 truncate max-w-sm px-4 py-1 bg-white rounded-md border border-slate-200 shadow-xs">
                inbox://{draft.to[0] || 'recipient'} - {draft.subject || 'رسالة رسمية'}
              </div>
              <div className="text-[10px] text-slate-400 font-semibold">Outlook / Gmail</div>
            </div>

            {/* Email Render Frame */}
            <div className="p-2 sm:p-6 bg-slate-50">
              <iframe
                title="Email Preview"
                srcDoc={renderedHtml}
                className="w-full h-[720px] border-0 rounded-xl bg-white shadow-sm"
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        )}

        {viewMode === 'mobile' && (
          <div className="w-[375px] max-w-full bg-slate-900 rounded-[44px] p-3 shadow-2xl border-4 border-slate-700 animate-in zoom-in-95 duration-300">
            {/* Phone Notch & Status Bar */}
            <div className="w-36 h-4 bg-slate-950 rounded-b-xl mx-auto mb-2 flex items-center justify-center">
              <div className="w-10 h-1 rounded-full bg-slate-800" />
            </div>

            {/* Screen */}
            <div className="rounded-[32px] overflow-hidden bg-white shadow-inner">
              <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 flex items-center justify-between text-[11px] text-slate-600 font-medium">
                <span className="truncate max-w-[200px]">بريد الوارد ({brand.companyName})</span>
                <span>9:41</span>
              </div>
              <iframe
                title="Mobile Email Preview"
                srcDoc={renderedHtml}
                className="w-full h-[580px] border-0 bg-white"
                sandbox="allow-same-origin"
              />
            </div>

            {/* Home indicator */}
            <div className="w-28 h-1 bg-slate-700 rounded-full mx-auto mt-3" />
          </div>
        )}

        {viewMode === 'code' && (
          <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span className="font-mono">email_template.html</span>
              <button
                onClick={handleCopyHtml}
                className="text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1"
              >
                {copiedHtml ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedHtml ? 'تم النسخ' : 'نسخ الكود بالكامل'}</span>
              </button>
            </div>
            <pre className="p-4 text-xs font-mono text-emerald-400/90 overflow-x-auto h-[650px] leading-relaxed select-all">
              {renderedHtml}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
