import { BrandIdentity, EmailDraft, TeamMember, TemplateType, UrgencyLevel } from '../types';
import { TEMPLATES } from './constants';

export interface AIAnalysisResult {
  templateId: TemplateType;
  subject: string;
  urgency: UrgencyLevel;
  to: string[];
  cc: string[];
  greeting: string;
  intro: string;
  mainContent: string;
  bulletPoints: string[];
  callToAction: {
    text: string;
    deadline?: string;
    buttonLabel?: string;
  };
  closing: string;
  reasoning: string;
}

export function localRuleBasedClassifier(
  userPrompt: string,
  teamMembers: TeamMember[],
  currentUser: TeamMember,
  brand: BrandIdentity
): AIAnalysisResult {
  const promptLower = userPrompt.toLowerCase();

  // 1. Determine Template
  let templateId: TemplateType = 'memo';
  let reasoning = 'تم اختيار قالب "مذكرة إدارية رسمية" كقالب افتراضي للتواصل والتوجيهات المؤسسية.';

  if (
    promptLower.includes('اجتماع') ||
    promptLower.includes('لقاء') ||
    promptLower.includes('جلسة') ||
    promptLower.includes('agenda') ||
    promptLower.includes('meeting')
  ) {
    templateId = 'meeting';
    reasoning = 'تم رصد نية عقد اجتماع وتنسيق جدول أعمال، لذا تم اختيار قالب "دعوة لاجتماع رسمي وجدول أعمال" تلقائياً.';
  } else if (
    promptLower.includes('مهمة') ||
    promptLower.includes('تكليف') ||
    promptLower.includes('تسليم') ||
    promptLower.includes('مشروع') ||
    promptLower.includes('task') ||
    promptLower.includes('assign')
  ) {
    templateId = 'task';
    reasoning = 'تم رصد تفويض مهام ومسؤوليات ومواعيد تسليم، لذا تم اختيار قالب "تكليف بمهمة ومشروع" تلقائياً.';
  } else if (
    promptLower.includes('موافقة') ||
    promptLower.includes('اعتماد') ||
    promptLower.includes('شراء') ||
    promptLower.includes('ميزانية') ||
    promptLower.includes('ترقية') ||
    promptLower.includes('approval') ||
    promptLower.includes('approve')
  ) {
    templateId = 'approval';
    reasoning = 'تم رصد طلب ترخيص أو اعتماد إداري أو مالي، لذا تم اختيار قالب "طلب موافقة واعتماد إداري/مالي" تلقائياً.';
  } else if (
    promptLower.includes('إنذار') ||
    promptLower.includes('لفت نظر') ||
    promptLower.includes('تنبيه') ||
    promptLower.includes('مخالفة') ||
    promptLower.includes('تأخر') ||
    promptLower.includes('warning') ||
    promptLower.includes('notice')
  ) {
    templateId = 'warning';
    reasoning = 'تم رصد إشعار تنبيهي أو متابعة التزام رسمي، لذا تم اختيار قالب "إشعار رسمي ولفت نظر" تلقائياً.';
  } else if (
    promptLower.includes('تقرير') ||
    promptLower.includes('إنجاز') ||
    promptLower.includes('أسبوعي') ||
    promptLower.includes('شهري') ||
    promptLower.includes('مؤشرات') ||
    promptLower.includes('progress') ||
    promptLower.includes('report')
  ) {
    templateId = 'status_report';
    reasoning = 'تم رصد استعراض تقرير دوري أو مؤشرات إنجاز، لذا تم اختيار قالب "تقرير إنجاز ومتابعة سير العمل" تلقائياً.';
  } else if (
    promptLower.includes('شكر') ||
    promptLower.includes('تقدير') ||
    promptLower.includes('تهنئة') ||
    promptLower.includes('تكريم') ||
    promptLower.includes('إشادة') ||
    promptLower.includes('thanks') ||
    promptLower.includes('appreciation')
  ) {
    templateId = 'appreciation';
    reasoning = 'تم رصد نية التكريم والتقدير الرسمي، لذا تم اختيار قالب "شكر وتقدير رسمي وتكريم" تلقائياً.';
  } else if (
    promptLower.includes('فاتورة') ||
    promptLower.includes('صرف') ||
    promptLower.includes('مستحقات') ||
    promptLower.includes('دفعة') ||
    promptLower.includes('حساب بنكي') ||
    promptLower.includes('invoice') ||
    promptLower.includes('payment')
  ) {
    templateId = 'financial';
    reasoning = 'تم رصد معاملة مالية أو تسوية صرف وفواتير، لذا تم اختيار قالب "مطالبة مالية واعتماد صرف" تلقائياً.';
  }

  // 2. Identify Recipients from team directory
  const matchedRecipients: string[] = [];
  teamMembers.forEach((member) => {
    const nameParts = member.name.split(' ');
    const firstName = nameParts[1] || nameParts[0]; // e.g. "أحمد" from "م. أحمد فاروق"
    if (
      userPrompt.includes(firstName) ||
      userPrompt.includes(member.role) ||
      (member.department && userPrompt.includes(member.department)) ||
      userPrompt.includes(member.email)
    ) {
      if (!matchedRecipients.includes(member.email)) {
        matchedRecipients.push(member.email);
      }
    }
  });

  // If no recipient matched, pick relevant default
  if (matchedRecipients.length === 0) {
    if (templateId === 'approval' || templateId === 'financial') {
      const finance = teamMembers.find((m) => m.department.includes('المالية') || m.role.includes('CFO'));
      if (finance) matchedRecipients.push(finance.email);
    } else if (templateId === 'task') {
      const dev = teamMembers.find((m) => m.department.includes('الهندسة') || m.role.includes('CTO'));
      if (dev) matchedRecipients.push(dev.email);
    }
  }

  // 3. Determine Urgency
  let urgency: UrgencyLevel = 'normal';
  if (promptLower.includes('عاجل') || promptLower.includes('طارئ') || promptLower.includes('فوري') || promptLower.includes('urgent')) {
    urgency = 'urgent';
  } else if (promptLower.includes('هام') || promptLower.includes('ضروري') || promptLower.includes('أولوية') || promptLower.includes('important')) {
    urgency = 'important';
  }

  // 4. Generate structured content based on template
  const tmpl = TEMPLATES[templateId];

  // Derive a cleaned subject
  let subject = tmpl.sampleSubject;
  if (userPrompt.length > 5 && userPrompt.length < 80) {
    subject = `${tmpl.badge}: ${userPrompt.replace(/^(اكتب|أريد|صغ|ابعث|إيميل|رسالة|لـ|إلى)\s+/gi, '').trim()}`;
  }

  return {
    templateId,
    subject,
    urgency,
    to: matchedRecipients.length > 0 ? matchedRecipients : [teamMembers[0]?.email || 'team@services-platform.com'],
    cc: [],
    greeting: tmpl.defaultGreeting,
    intro: `بالإشارة إلى متطلبات العمل والتنسيق المشترك، وتلبية لما تم الاتفاق بشأنه: ${userPrompt}`,
    mainContent: `نود التأكيد على استكمال الإجراءات والتنسيق بين الإدارات المعنية بما يضمن تحقيق الأهداف المرجوة وفق أعلى معايير الجودة والالتزام المؤسسي.`,
    bulletPoints: tmpl.sampleBulletPoints,
    callToAction: {
      text: tmpl.sampleAction,
      deadline: urgency === 'urgent' ? 'خلال 24 ساعة من تاريخ الإشعار' : 'خلال 3 أيام عمل رسمية',
      buttonLabel: tmpl.sampleButtonLabel || 'الاطلاع والاتخاذ اللازم',
    },
    closing: tmpl.defaultClosing,
    reasoning,
  };
}
