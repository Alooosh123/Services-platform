import {
  ServiceAccountStatus,
  OfficialLinkMethod,
} from '@digital-topup/shared';

export interface ServiceCapabilityDefinition {
  serviceSlug: string;
  serviceName: string;
  serviceNameAr: string;
  requiredFields: string[];
  officialLinkMethod: OfficialLinkMethod;
  defaultStatus: ServiceAccountStatus;
  supportedRegions: string[];
  phoneLinkSupported: boolean;
  integrationStatus: 'ACTIVE' | 'BLOCKED_EXTERNAL';
  blockedReasonAr?: string;
  notesAr: string;
}

export const SERVICE_CAPABILITIES: Record<string, ServiceCapabilityDefinition> = {
  'pubg-mobile': {
    serviceSlug: 'pubg-mobile',
    serviceName: 'PUBG Mobile UC',
    serviceNameAr: 'ببجي موبايل (شدات UC)',
    requiredFields: ['player_id'],
    officialLinkMethod: OfficialLinkMethod.PROVIDER_QUERY_CHECK,
    defaultStatus: ServiceAccountStatus.REFERENCE_ONLY,
    supportedRegions: ['GLOBAL', 'MENA'],
    phoneLinkSupported: false, // Publisher does NOT support linking to customer mobile phone
    integrationStatus: 'ACTIVE',
    notesAr: 'يتم فحص معرف اللاعب عبر استعلام السيرفر وحفظ المعرف كمرجع شراء سريع دون ادعاء ربط OAuth.',
  },
  yoyo: {
    serviceSlug: 'yoyo',
    serviceName: 'YoYo Voice & Chat',
    serviceNameAr: 'تطبيق يويو (YoYo)',
    requiredFields: ['player_id'],
    officialLinkMethod: OfficialLinkMethod.REFERENCE_INPUT,
    defaultStatus: ServiceAccountStatus.REFERENCE_ONLY,
    supportedRegions: ['MENA'],
    phoneLinkSupported: false,
    integrationStatus: 'ACTIVE',
    notesAr: 'حفظ معرّف الحساب كمرجع موثق للطلب السريع بموافقة العميل.',
  },
  toptop: {
    serviceSlug: 'toptop',
    serviceName: 'TopTop Games',
    serviceNameAr: 'توب توب (TopTop)',
    requiredFields: ['player_id'],
    officialLinkMethod: OfficialLinkMethod.REFERENCE_INPUT,
    defaultStatus: ServiceAccountStatus.REFERENCE_ONLY,
    supportedRegions: ['MENA'],
    phoneLinkSupported: false,
    integrationStatus: 'ACTIVE',
    notesAr: 'حفظ معرّف الحساب كمرجع موثق للطلب السريع بموافقة العميل.',
  },
  'free-fire': {
    serviceSlug: 'free-fire',
    serviceName: 'Garena Free Fire',
    serviceNameAr: 'فري فاير (Free Fire)',
    requiredFields: ['player_id'],
    officialLinkMethod: OfficialLinkMethod.PROVIDER_QUERY_CHECK,
    defaultStatus: ServiceAccountStatus.REFERENCE_ONLY,
    supportedRegions: ['MENA', 'GLOBAL'],
    phoneLinkSupported: false,
    integrationStatus: 'ACTIVE',
    notesAr: 'فحص الاسم عبر المزود وحفظه كمعرف مرجعي.',
  },
  roblox: {
    serviceSlug: 'roblox',
    serviceName: 'Roblox Global',
    serviceNameAr: 'روبلوكس (Roblox)',
    requiredFields: ['username'],
    officialLinkMethod: OfficialLinkMethod.UNSUPPORTED,
    defaultStatus: ServiceAccountStatus.UNSUPPORTED,
    supportedRegions: ['GLOBAL'],
    phoneLinkSupported: false,
    integrationStatus: 'BLOCKED_EXTERNAL',
    blockedReasonAr: 'تكامل الحسابات المباشر بانتظار توفر API رسمي موثق أو ترخيص مزود معتمد (BLOCKED_EXTERNAL).',
    notesAr: 'الخدمة بانتظار مزود معتمد وواجهة برمجة رسمية.',
  },
};

export class ServiceCapabilitiesConfig {
  static getAllCapabilities(): ServiceCapabilityDefinition[] {
    return Object.values(SERVICE_CAPABILITIES);
  }

  static getCapability(serviceSlug: string): ServiceCapabilityDefinition {
    const key = serviceSlug.toLowerCase().trim();
    if (SERVICE_CAPABILITIES[key]) {
      return SERVICE_CAPABILITIES[key];
    }

    // Default Fallback: Transparent BLOCKED_EXTERNAL status for unknown/uncontracted external providers
    return {
      serviceSlug: key,
      serviceName: 'Generic Digital Service',
      serviceNameAr: 'خدمة رقمية عامة',
      requiredFields: ['player_id'],
      officialLinkMethod: OfficialLinkMethod.UNSUPPORTED,
      defaultStatus: ServiceAccountStatus.UNSUPPORTED,
      supportedRegions: ['GLOBAL'],
      phoneLinkSupported: false,
      integrationStatus: 'BLOCKED_EXTERNAL',
      blockedReasonAr: 'الخدمة بانتظار توفر API رسمي موثق وتفويض تعاقدي (BLOCKED_EXTERNAL).',
      notesAr: 'الخدمة غير مجهزة بربط رسمي آلي، وبانتظار مزود معتمد.',
    };
  }
}
