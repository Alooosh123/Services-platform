export type UrgencyLevel = 'normal' | 'important' | 'urgent';

export type TemplateType =
  | 'memo'
  | 'task'
  | 'meeting'
  | 'approval'
  | 'warning'
  | 'status_report'
  | 'appreciation'
  | 'financial';

export interface TemplateDefinition {
  id: TemplateType;
  title: string;
  englishTitle: string;
  badge: string;
  description: string;
  iconName: string;
  colorScheme: {
    primary: string;
    accent: string;
    lightBg: string;
  };
  defaultGreeting: string;
  defaultClosing: string;
  sampleSubject: string;
  sampleIntro: string;
  sampleBulletPoints: string[];
  sampleAction: string;
  sampleButtonLabel?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  avatar?: string;
  status: 'online' | 'busy' | 'away';
  phone?: string;
  registeredAt: string;
}

export interface BrandIdentity {
  companyName: string;
  companySubtitle: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: 'Cairo' | 'Tajawal' | 'IBM Plex Sans Arabic' | 'system-ui';
  headerStyle: 'modern_gradient' | 'classic_formal' | 'bordered_letterhead' | 'minimalist';
  footerLegalNotice: string;
  website: string;
  supportEmail: string;
  officeAddress: string;
  officialStamp: boolean;
  signatureStyle: 'card' | 'classic' | 'minimal';
}

export interface EmailActionRequired {
  text: string;
  deadline?: string;
  buttonLabel?: string;
  buttonUrl?: string;
}

export interface EmailAttachment {
  name: string;
  size: string;
  type: string;
}

export interface EmailDraft {
  id: string;
  templateId: TemplateType;
  subject: string;
  urgency: UrgencyLevel;
  referenceNumber: string;
  date: string;
  to: string[];
  cc: string[];
  bcc: string[];
  greeting: string;
  intro: string;
  mainContent: string;
  bulletPoints: string[];
  callToAction: EmailActionRequired;
  closing: string;
  sender: {
    name: string;
    role: string;
    email: string;
    department: string;
    phone?: string;
  };
  attachments: EmailAttachment[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  suggestedTemplate?: TemplateType;
  reasoning?: string;
  appliedDraft?: Partial<EmailDraft>;
}

export interface SentEmailRecord {
  id: string;
  sentAt: string;
  to: string[];
  cc: string[];
  subject: string;
  templateId: TemplateType;
  senderEmail: string;
  senderName: string;
  htmlContent: string;
  status: 'delivered' | 'pending';
}
