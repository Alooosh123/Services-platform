'use client';

import React, { useState, useEffect } from 'react';
import {
  BrandIdentity,
  ChatMessage,
  EmailDraft,
  SentEmailRecord,
  TeamMember,
  TemplateType,
} from '@/types';
import { DEFAULT_BRAND, INITIAL_TEAM_MEMBERS, TEMPLATES } from '@/lib/constants';
import { Navbar } from '@/components/Navbar';
import { ChatAssistantPanel } from '@/components/ChatAssistantPanel';
import { FormFieldsEditor } from '@/components/FormFieldsEditor';
import { LiveEmailPreview } from '@/components/LiveEmailPreview';
import { TeamDirectoryModal } from '@/components/TeamDirectoryModal';
import { BrandSettingsModal } from '@/components/BrandSettingsModal';
import { SentHistoryModal } from '@/components/SentHistoryModal';
import { UserSwitchModal } from '@/components/UserSwitchModal';
import {
  Sparkles,
  SlidersHorizontal,
  Eye,
  CheckCircle,
  AlertCircle,
  Users,
} from 'lucide-react';

export default function EmailFormsStudioPage() {
  // 1. Core State
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(INITIAL_TEAM_MEMBERS);
  const [currentUser, setCurrentUser] = useState<TeamMember>(INITIAL_TEAM_MEMBERS[0]);
  const [brand, setBrand] = useState<BrandIdentity>(DEFAULT_BRAND);
  const [activeTab, setActiveTab] = useState<'chat' | 'form'>('chat');
  const [mobileViewTab, setMobileViewTab] = useState<'editor' | 'preview'>('editor');

  // Modals state
  const [isDirectoryOpen, setIsDirectoryOpen] = useState(false);
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);
  const [isSentHistoryOpen, setIsSentHistoryOpen] = useState(false);
  const [isUserSwitchOpen, setIsUserSwitchOpen] = useState(false);

  // Async loading & notification state
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' } | null>(null);

  // Sent records
  const [sentRecords, setSentRecords] = useState<SentEmailRecord[]>([]);

  // Initial Draft
  const [draft, setDraft] = useState<EmailDraft>({
    id: `draft_${Date.now()}`,
    templateId: 'memo',
    subject: TEMPLATES.memo.sampleSubject,
    urgency: 'normal',
    referenceNumber: 'REF-2026/11-042',
    date: new Date().toLocaleDateString('ar-EG'),
    to: [INITIAL_TEAM_MEMBERS[1].email, INITIAL_TEAM_MEMBERS[2].email],
    cc: [INITIAL_TEAM_MEMBERS[3].email],
    bcc: [],
    greeting: TEMPLATES.memo.defaultGreeting,
    intro: TEMPLATES.memo.sampleIntro,
    mainContent: 'نحيطكم علماً بأن المنصة تعمل على تعزيز جاهزية البنية السحابية وإطلاق حزمة الخدمات الجديدة للشركاء.',
    bulletPoints: TEMPLATES.memo.sampleBulletPoints,
    callToAction: {
      text: TEMPLATES.memo.sampleAction,
      deadline: 'يوم الخميس القادم الساعة 3:00 عصراً',
      buttonLabel: TEMPLATES.memo.sampleButtonLabel,
      buttonUrl: 'https://services-platform.com/confirm',
    },
    closing: TEMPLATES.memo.defaultClosing,
    sender: {
      name: INITIAL_TEAM_MEMBERS[0].name,
      role: INITIAL_TEAM_MEMBERS[0].role,
      email: INITIAL_TEAM_MEMBERS[0].email,
      department: INITIAL_TEAM_MEMBERS[0].department,
      phone: INITIAL_TEAM_MEMBERS[0].phone,
    },
    attachments: [
      { name: 'دليل_السياسات_والتواصل_الرسمي_2026.pdf', size: '2.1 MB', type: 'pdf' },
    ],
  });

  // Chat message history
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Show Toast Helper
  const showToast = (text: string, type: 'success' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Keep sender in sync when currentUser changes
  useEffect(() => {
    setDraft((prev) => ({
      ...prev,
      sender: {
        name: currentUser.name,
        role: currentUser.role,
        email: currentUser.email,
        department: currentUser.department,
        phone: currentUser.phone,
      },
    }));
  }, [currentUser]);

  // Handle New Draft
  const handleNewDraft = () => {
    const defaultTmpl = TEMPLATES.memo;
    setDraft({
      id: `draft_${Date.now()}`,
      templateId: 'memo',
      subject: '',
      urgency: 'normal',
      referenceNumber: `REF-${new Date().toISOString().slice(2, 7).replace('-', '')}/${Math.floor(1000 + Math.random() * 9000)}`,
      date: new Date().toLocaleDateString('ar-EG'),
      to: [],
      cc: [],
      bcc: [],
      greeting: defaultTmpl.defaultGreeting,
      intro: '',
      mainContent: '',
      bulletPoints: ['البند الأول للموضوع...', 'البند الثاني للتنسيق...'],
      callToAction: {
        text: '',
        deadline: '',
        buttonLabel: 'الاطلاع والاتخاذ اللازم',
      },
      closing: defaultTmpl.defaultClosing,
      sender: {
        name: currentUser.name,
        role: currentUser.role,
        email: currentUser.email,
        department: currentUser.department,
        phone: currentUser.phone,
      },
      attachments: [],
    });
    setChatMessages([]);
    showToast('تم فتح مسودة جديدة فارغة، يمكنك الكتابة في الشات أو تحديد الحقول.', 'info');
  };

  // Handle AI Chat Message
  const handleSendMessage = async (userPrompt: string) => {
    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: userPrompt,
      timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setIsLoadingAi(true);

    try {
      const res = await fetch('/api/ai/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userPrompt,
          teamMembers,
          currentUser,
          brand,
          currentDraft: draft,
        }),
      });

      const data = await res.json();

      if (data.success && data.result) {
        const aiRes = data.result;

        // Update draft with AI output
        setDraft((prev) => ({
          ...prev,
          templateId: aiRes.templateId || prev.templateId,
          subject: aiRes.subject || prev.subject,
          urgency: aiRes.urgency || prev.urgency,
          to: aiRes.to && aiRes.to.length > 0 ? aiRes.to : prev.to,
          cc: aiRes.cc && aiRes.cc.length > 0 ? aiRes.cc : prev.cc,
          greeting: aiRes.greeting || prev.greeting,
          intro: aiRes.intro || prev.intro,
          mainContent: aiRes.mainContent || prev.mainContent,
          bulletPoints: aiRes.bulletPoints && aiRes.bulletPoints.length > 0 ? aiRes.bulletPoints : prev.bulletPoints,
          callToAction: {
            text: aiRes.callToAction?.text || prev.callToAction.text,
            deadline: aiRes.callToAction?.deadline || prev.callToAction.deadline,
            buttonLabel: aiRes.callToAction?.buttonLabel || prev.callToAction.buttonLabel,
            buttonUrl: prev.callToAction.buttonUrl,
          },
          closing: aiRes.closing || prev.closing,
        }));

        const aiMsg: ChatMessage = {
          id: `msg_${Date.now() + 1}`,
          role: 'assistant',
          content: `تم تحليل طلبك وصياغة الإيميل بنجاح! تم تطبيق القالب المناسب (${TEMPLATES[aiRes.templateId]?.title}) وتحديث المعاينة المباشرة فوراً.`,
          timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
          suggestedTemplate: aiRes.templateId,
          reasoning: aiRes.reasoning,
        };

        setChatMessages((prev) => [...prev, aiMsg]);
        showToast(`تم اختيار قالب (${TEMPLATES[aiRes.templateId]?.badge}) وتحديث المعاينة!`, 'success');
      } else {
        throw new Error(data.error || 'Failed to analyze prompt');
      }
    } catch (err: any) {
      const fallbackMsg: ChatMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: `تم استلام طلبك وتحديث القالب بالصيغة الرسمية المناسبة.`,
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoadingAi(false);
    }
  };

  // Handle Add Recipient from Directory
  const handleAddRecipient = (email: string, field: 'to' | 'cc' | 'bcc') => {
    setDraft((prev) => {
      const currentList = prev[field] || [];
      if (currentList.includes(email)) {
        // Toggle remove if already exists
        return {
          ...prev,
          [field]: currentList.filter((e) => e !== email),
        };
      } else {
        return {
          ...prev,
          [field]: [...currentList, email],
        };
      }
    });
    showToast(`تم تحديث قائمة المستلمين (${field.toUpperCase()})`, 'info');
  };

  // Register New Member
  const handleRegisterMember = async (memberData: Partial<TeamMember>) => {
    try {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(memberData),
      });
      const data = await res.json();
      if (data.success && data.member) {
        setTeamMembers((prev) => [data.member, ...prev.filter((m) => m.email !== data.member.email)]);
        showToast(`تم تسجيل العضو (${data.member.name}) بنجاح!`, 'success');
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  // Quick Register / Login
  const handleQuickRegister = async (email: string, name: string): Promise<TeamMember> => {
    const res = await fetch('/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, role: 'عضو فريق', department: 'الهندسة والتقنية' }),
    });
    const data = await res.json();
    if (data.success && data.member) {
      setTeamMembers((prev) => [data.member, ...prev.filter((m) => m.email !== data.member.email)]);
      showToast(`مرحباً بك يا ${data.member.name}، تم تسجيل دخولك بنجاح!`, 'success');
      return data.member;
    }
    throw new Error('Registration failed');
  };

  // Save Brand Identity
  const handleSaveBrand = (updatedBrand: BrandIdentity) => {
    setBrand(updatedBrand);
    showToast('تم حفظ الهوية البصرية وتطبيق الشعار والألوان على كافة القوالب!', 'success');
  };

  // Send Email Handler
  const handleSendEmail = async (html: string) => {
    if (draft.to.length === 0) {
      alert('يرجى تحديد مستلم واحد على الأقل في حقل (إلى).');
      return;
    }

    setIsSending(true);
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: draft.to,
          cc: draft.cc,
          subject: draft.subject,
          templateId: draft.templateId,
          senderEmail: draft.sender.email,
          senderName: draft.sender.name,
          htmlContent: html,
        }),
      });

      const data = await res.json();
      if (data.success && data.record) {
        setSentRecords((prev) => [data.record, ...prev]);
        showToast(
          `تم إرسال الإيميل بنجاح إلى (${draft.to.join(', ')}) وتوثيقه في الأرشيف الرسمي!`,
          'success'
        );
      }
    } catch (err: any) {
      showToast('تعذر إرسال الإيميل: ' + err.message, 'info');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 font-sans">
      {/* Navbar */}
      <Navbar
        brand={brand}
        currentUser={currentUser}
        teamMembers={teamMembers}
        onOpenDirectory={() => setIsDirectoryOpen(true)}
        onOpenBrandSettings={() => setIsBrandModalOpen(true)}
        onOpenSentHistory={() => setIsSentHistoryOpen(true)}
        onOpenUserSwitch={() => setIsUserSwitchOpen(true)}
        onNewDraft={handleNewDraft}
        sentCount={sentRecords.length}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 duration-300">
          <div
            className={`px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-bold border backdrop-blur-md ${
              toastMessage.type === 'success'
                ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/40 shadow-emerald-950/50'
                : 'bg-sky-950/90 text-sky-200 border-sky-500/40 shadow-sky-950/50'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-sky-400" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Mobile Toggle Bar (Hidden on md/lg screens) */}
      <div className="lg:hidden p-2 bg-slate-900 border-b border-slate-800 flex items-center justify-center gap-2">
        <button
          onClick={() => setMobileViewTab('editor')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
            mobileViewTab === 'editor'
              ? 'bg-sky-600 text-white shadow-md'
              : 'bg-slate-800 text-slate-400'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>الشات والمحرر</span>
        </button>
        <button
          onClick={() => setMobileViewTab('preview')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
            mobileViewTab === 'preview'
              ? 'bg-sky-600 text-white shadow-md'
              : 'bg-slate-800 text-slate-400'
          }`}
        >
          <Eye className="w-4 h-4" />
          <span>المعاينة المباشرة</span>
        </button>
      </div>

      {/* Main Studio Work Area */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden h-[calc(100vh-64px)]">
        {/* Left Column: Chat Assistant & Form Editor (45% on Desktop) */}
        <div
          className={`w-full lg:w-[45%] xl:w-[42%] flex flex-col h-full border-b lg:border-b-0 lg:border-l border-slate-800 ${
            mobileViewTab === 'preview' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {activeTab === 'chat' ? (
            <ChatAssistantPanel
              chatMessages={chatMessages}
              onSendMessage={handleSendMessage}
              isLoading={isLoadingAi}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              currentDraft={draft}
            />
          ) : (
            <div className="flex flex-col h-full">
              {/* Tab Header */}
              <div className="p-3 border-b border-slate-800 bg-slate-900 flex items-center justify-between">
                <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setActiveTab('chat')}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white transition-all flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>المساعد الذكي (شات)</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('form')}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-sky-600 text-white shadow-md flex items-center gap-1.5"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>تخصيص الحقول يدوياً</span>
                  </button>
                </div>
              </div>

              <FormFieldsEditor
                draft={draft}
                onChange={setDraft}
                teamMembers={teamMembers}
                onOpenDirectory={() => setIsDirectoryOpen(true)}
              />
            </div>
          )}
        </div>

        {/* Right Column: Live Rendering Preview Studio (55% on Desktop) */}
        <div
          className={`w-full lg:w-[55%] xl:w-[58%] flex flex-col h-full ${
            mobileViewTab === 'editor' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          <LiveEmailPreview
            draft={draft}
            brand={brand}
            onSendEmail={handleSendEmail}
            isSending={isSending}
          />
        </div>
      </div>

      {/* Modals */}
      <TeamDirectoryModal
        isOpen={isDirectoryOpen}
        onClose={() => setIsDirectoryOpen(false)}
        teamMembers={teamMembers}
        onAddRecipient={handleAddRecipient}
        onRegisterMember={handleRegisterMember}
        selectedTo={draft.to}
        selectedCc={draft.cc}
        selectedBcc={draft.bcc}
      />

      <BrandSettingsModal
        isOpen={isBrandModalOpen}
        onClose={() => setIsBrandModalOpen(false)}
        brand={brand}
        onSaveBrand={handleSaveBrand}
      />

      <SentHistoryModal
        isOpen={isSentHistoryOpen}
        onClose={() => setIsSentHistoryOpen(false)}
        sentRecords={sentRecords}
      />

      <UserSwitchModal
        isOpen={isUserSwitchOpen}
        onClose={() => setIsUserSwitchOpen(false)}
        currentUser={currentUser}
        teamMembers={teamMembers}
        onSelectUser={setCurrentUser}
        onQuickRegister={handleQuickRegister}
      />
    </div>
  );
}
