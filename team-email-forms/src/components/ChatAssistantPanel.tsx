'use client';

import React, { useState, useRef, useEffect } from 'react';
import { BrandIdentity, ChatMessage, EmailDraft, TeamMember, TemplateType } from '@/types';
import { TEMPLATES } from '@/lib/constants';
import {
  Sparkles,
  Send,
  Bot,
  User,
  ArrowRight,
  CheckCircle2,
  SlidersHorizontal,
  Flame,
  FileEdit,
  Clock,
  Layers,
  Check,
} from 'lucide-react';

interface ChatAssistantPanelProps {
  chatMessages: ChatMessage[];
  onSendMessage: (text: string) => Promise<void>;
  isLoading: boolean;
  activeTab: 'chat' | 'form';
  setActiveTab: (tab: 'chat' | 'form') => void;
  currentDraft: EmailDraft;
}

const QUICK_PROMPTS = [
  {
    title: 'طلب اعتماد مالي لخوادم سحابية',
    prompt: 'اكتب إيميل للمدير المالي والمدير التنفيذي لطلب موافقة واعتماد ميزانية بقيمة 3,500$ لتجديد خوادم البنية التحتية، والموعد النهائي الأحد القادم.',
  },
  {
    title: 'تكليف بمهمة الربط البرمجي',
    prompt: 'صغ إيميل تكليف بمهمة للمهندس أحمد فاروق لتطوير واجهات بوابة الشركاء والتحقق من الربط البرمجي قبل يوم الأربعاء.',
  },
  {
    title: 'دعوة لاجتماع تنسيقي عاجل',
    prompt: 'دعوة لاجتماع طارئ لمديرة العمليات ومدير التقنية لمناقشة تحديثات الأمان يوم الثلاثاء الساعة 10:00 صباحاً عبر Google Meet.',
  },
  {
    title: 'تعميم إداري بساعات العمل',
    prompt: 'أريد تعميم إداري رسمي لجميع أعضاء الفريق بخصوص تنظيم أوقات الدوام المرن والالتزام برفع تقارير الإنجاز الأسبوعية كل خميس.',
  },
  {
    title: 'شكر وتقدير للإنجاز الاستثنائي',
    prompt: 'اكتب رسالة شكر وتقدير رسمية لمديرة الموارد البشرية سارة الشميري للإشادة بجهودها الاستثنائية في إعادة هيكلة الأقسام بنجاح.',
  },
];

export const ChatAssistantPanel: React.FC<ChatAssistantPanelProps> = ({
  chatMessages,
  onSendMessage,
  isLoading,
  activeTab,
  setActiveTab,
  currentDraft,
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, isLoading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    const text = inputText;
    setInputText('');
    await onSendMessage(text);
  };

  const handleQuickPromptClick = async (prompt: string) => {
    if (isLoading) return;
    await onSendMessage(prompt);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800 text-right">
      {/* Header Tabs: Chat Assistant vs Form Editor */}
      <div className="p-3 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
        <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'chat'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-900/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>المساعد الذكي (شات)</span>
          </button>
          <button
            onClick={() => setActiveTab('form')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'form'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-900/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>تخصيص الحقول يدوياً</span>
          </button>
        </div>

        {/* Current Active Template Pill */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400">
          <span className="text-[11px]">القالب المفعّل:</span>
          <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-sky-400 font-semibold border border-blue-500/20">
            {TEMPLATES[currentDraft.templateId]?.badge || 'مذكرة رسمية'}
          </span>
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {chatMessages.length === 0 ? (
          <div className="py-8 text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-sky-500/20 to-blue-600/30 border border-sky-500/30 flex items-center justify-center text-sky-400 shadow-xl">
              <Bot className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white mb-1">
                اكتب ما تريده وسيقوم الذكاء الاصطناعي بكل شيء!
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                اكتب طلبك باللغة الطبيعية (اسم الشخص، الغرض، الموعد، أو المطلوب) وسيقوم المساعد
                باختيار القالب الأنسب وصياغة إيميل رسمي معتمد فوراً.
              </p>
            </div>

            {/* Quick Prompts Suggestions */}
            <div className="pt-2 text-right">
              <span className="text-xs font-bold text-slate-400 block mb-2 px-1 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                نماذج طلبات سريعة لتجربة فورية:
              </span>
              <div className="space-y-1.5">
                {QUICK_PROMPTS.map((qp, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleQuickPromptClick(qp.prompt)}
                    disabled={isLoading}
                    className="w-full text-right p-2.5 rounded-xl bg-slate-800/40 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 hover:text-white transition-all group flex items-start justify-between gap-2"
                  >
                    <div>
                      <div className="font-bold text-sky-400 group-hover:text-sky-300">
                        {qp.title}
                      </div>
                      <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                        {qp.prompt}
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-sky-400 flex-shrink-0 mt-1 rotate-180" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          chatMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${
                msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
              }`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-white ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-tr from-sky-600 to-blue-700 shadow-md shadow-sky-900/30'
                    : 'bg-gradient-to-tr from-purple-600 to-indigo-700 shadow-md shadow-purple-900/30'
                }`}
              >
                {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              {/* Message Bubble */}
              <div
                className={`rounded-2xl p-3.5 max-w-[85%] text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-sky-600 text-white shadow-md'
                    : 'bg-slate-800/80 border border-slate-700 text-slate-200 shadow-lg'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>

                {/* AI Metadata Details (Template chosen & reasoning) */}
                {msg.role === 'assistant' && msg.suggestedTemplate && (
                  <div className="mt-3 pt-3 border-t border-slate-700/80 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400">القالب المختار تلقائياً:</span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        {TEMPLATES[msg.suggestedTemplate]?.title}
                      </span>
                    </div>

                    {msg.reasoning && (
                      <div className="text-[11px] text-slate-300 bg-slate-900/60 p-2 rounded-lg border border-slate-800 flex items-start gap-1.5">
                        <Sparkles className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
                        <span>{msg.reasoning}</span>
                      </div>
                    )}
                  </div>
                )}

                <div
                  className={`text-[9px] mt-1.5 font-mono ${
                    msg.role === 'user' ? 'text-sky-200' : 'text-slate-400'
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>
            </div>
          ))
        )}

        {/* Loading Bubble */}
        {isLoading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-700 flex items-center justify-center text-white animate-pulse">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-3.5 text-xs text-slate-300 shadow-lg flex items-center gap-2">
              <div className="flex gap-1 items-center">
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-bounce" />
                <span
                  className="w-2 h-2 rounded-full bg-sky-400 animate-bounce"
                  style={{ animationDelay: '0.15s' }}
                />
                <span
                  className="w-2 h-2 rounded-full bg-sky-400 animate-bounce"
                  style={{ animationDelay: '0.3s' }}
                />
              </div>
              <span className="text-slate-300 mr-2 font-medium">
                جاري تحليل الطلب واختيار القالب وصياغة الإيميل الرسمي...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="p-3 border-t border-slate-800 bg-slate-900/90">
        <form onSubmit={handleSend} className="relative">
          <textarea
            rows={2}
            placeholder="اكتب طلبك هنا (مثال: صغ إيميل رسمي للمدير المالي لطلب اعتماد شراء...)"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend(e);
              }
            }}
            className="w-full pl-12 pr-4 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 resize-none"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="absolute left-2.5 bottom-3.5 p-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:hover:bg-sky-600 text-white transition-all shadow-md shadow-sky-900/40"
            title="إرسال الطلب للذكاء الاصطناعي"
          >
            <Send className="w-4 h-4 rotate-180" />
          </button>
        </form>
        <div className="flex items-center justify-between mt-2 text-[10px] text-slate-500 px-1">
          <span>يدعم اللغة العربية الفصحى والنبرة المؤسسية الرسمية</span>
          <span>اضغط Enter للإرسال</span>
        </div>
      </div>
    </div>
  );
};
