import { Injectable } from '@nestjs/common';
import { RouterSnapshot } from './mikrotik-readonly.client';

export type DiagnosticSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export interface NetworkDiagnostic {
  code: string;
  severity: DiagnosticSeverity;
  title: string;
  explanation: string;
  recommendedChecks: string[];
  sources: string[];
}

const REST_DOC = 'https://help.mikrotik.com/docs/spaces/ROS/pages/47579162/REST+API';
const USER_DOC = 'https://help.mikrotik.com/docs/spaces/ROS/pages/8978504/User';
const RESOURCE_DOC = 'https://help.mikrotik.com/docs/spaces/ROS/pages/40992875/Resource';
const ETHERNET_DOC = 'https://help.mikrotik.com/docs/spaces/ROS/pages/8323191/Ethernet';

@Injectable()
export class NetworkDiagnosisService {
  diagnose(snapshot: RouterSnapshot): NetworkDiagnostic[] {
    const findings: NetworkDiagnostic[] = [];
    const cpu = snapshot.cpuLoadPercent;
    if (cpu !== null && cpu >= 95) findings.push({
      code: 'ROUTER_CPU_CRITICAL', severity: 'CRITICAL', title: 'استهلاك المعالج حرج',
      explanation: 'قراءة CPU الحالية بلغت ' + cpu + '%. هذه عتبة تشغيلية داخل المنصة وليست تصنيفاً رسمياً من MikroTik.',
      recommendedChecks: ['قارن الحمل مع وقت الذروة والمهام المجدولة.', 'راجع سجلات النظام والواجهات لمعرفة النشاط المتزامن.', 'لا توقف الخدمات أو تعِد تشغيل الجهاز تلقائياً.'],
      sources: [RESOURCE_DOC, 'https://help.mikrotik.com/docs/spaces/ROS/pages/328094/Log'],
    });
    else if (cpu !== null && cpu >= 85) findings.push({
      code: 'ROUTER_CPU_HIGH', severity: 'WARNING', title: 'استهلاك المعالج مرتفع',
      explanation: 'قراءة CPU الحالية بلغت ' + cpu + '%. العتبة تحذيرية داخلية وتحتاج مقارنة زمنية قبل اتخاذ إجراء.',
      recommendedChecks: ['راقب اتجاه CPU خلال عدة عينات.', 'راجع واجهات المرور العالية وسجلات النظام.'],
      sources: [RESOURCE_DOC, 'https://help.mikrotik.com/docs/spaces/ROS/pages/139526175/Interface+stats+and+monitor-traffic'],
    });

    if (snapshot.freeMemoryBytes !== null && snapshot.totalMemoryBytes && snapshot.totalMemoryBytes > 0) {
      const ratio = snapshot.freeMemoryBytes / snapshot.totalMemoryBytes;
      if (ratio < 0.05) findings.push({
        code: 'ROUTER_MEMORY_CRITICAL', severity: 'CRITICAL', title: 'الذاكرة الحرة منخفضة جداً',
        explanation: 'المتاح أقل من 5% من الذاكرة الإجمالية؛ هذه عتبة تصنيف تشغيلية داخلية.',
        recommendedChecks: ['راجع العمليات والميزات النشطة واستهلاك الذاكرة.', 'احفظ سجلات الحالة قبل أي تغيير.', 'لا تنفذ إعادة تشغيل أو حذف إعدادات تلقائياً.'],
        sources: [RESOURCE_DOC],
      });
      else if (ratio < 0.15) findings.push({
        code: 'ROUTER_MEMORY_LOW', severity: 'WARNING', title: 'الذاكرة الحرة منخفضة',
        explanation: 'المتاح أقل من 15% من الذاكرة الإجمالية؛ راقب الاتجاه قبل التدخل.',
        recommendedChecks: ['قارن الذاكرة الحرة مع عينات سابقة.', 'راجع الخدمات التي أضيفت مؤخراً.'],
        sources: [RESOURCE_DOC],
      });
    }

    const down = snapshot.interfaces.filter((item) => !item.running && !item.disabled);
    for (const item of down.slice(0, 20)) findings.push({
      code: 'INTERFACE_NOT_RUNNING', severity: 'WARNING', title: 'واجهة غير عاملة: ' + item.name,
      explanation: 'الواجهة غير معطلة إدارياً لكنها لا تعرض حالة running.',
      recommendedChecks: ['افحص الكابل والطاقة والطرف المقابل.', 'راجع تفاوض السرعة وحالة المنفذ من جهاز MikroTik.', 'لا تفعّل الواجهة ولا تعِد ضبطها آلياً.'],
      sources: [ETHERNET_DOC],
    });

    if (findings.length === 0) findings.push({
      code: 'NO_RULE_MATCH', severity: 'INFO', title: 'لم تُكتشف مؤشرات أعطال بالقواعد الحالية',
      explanation: 'النتيجة لا تثبت خلو الشبكة من الأعطال؛ إنها تعني فقط أن القراءات الحالية لم تتجاوز العتبات المحددة.',
      recommendedChecks: ['استمر في جمع عينات زمنية.', 'أضف مراقبة SNMP/traffic counters عند الحاجة وبعد مراجعة الصلاحيات.'],
      sources: [REST_DOC, RESOURCE_DOC],
    });
    return findings;
  }

  connectionFailure(code: string): NetworkDiagnostic {
    const descriptions: Record<string, { title: string; explanation: string; checks: string[] }> = {
      CONFIGURATION_MISSING: { title: 'وكيل MikroTik غير مهيأ', explanation: 'لم تُضبط بيانات اتصال جهاز الاختبار.', checks: ['أدخل عنوان إدارة داخلياً وحساباً مخصصاً للقراءة فقط.'] },
      AUTHENTICATION_FAILED: { title: 'فشل مصادقة حساب القراءة فقط', explanation: 'رفض RouterOS اسم المستخدم أو صلاحية REST.', checks: ['تحقق من الحساب ومجموعة الصلاحيات read وrest-api.', 'لا تستخدم الحساب الإداري الافتراضي.'] },
      INSECURE_CONFIGURATION: { title: 'إعداد الاتصال غير آمن', explanation: 'يقبل الوكيل HTTPS فقط ولا يرسل بيانات الدخول عبر HTTP.', checks: ['فعّل www-ssl واستخدم شهادة موثوقة.'] },
      HOST_NOT_ALLOWED: { title: 'عنوان الجهاز خارج نطاق الإدارة المسموح', explanation: 'يقبل الوكيل عناوين IPv4 الخاصة فقط لتقليل مخاطر SSRF.', checks: ['استخدم عنوان إدارة خاصاً ضمن شبكة الاختبار/VPN.'] },
      CA_FILE_UNREADABLE: { title: 'تعذر قراءة شهادة CA', explanation: 'لم يتمكن التطبيق من قراءة ملف CA المحدد.', checks: ['تحقق من المسار وصلاحية قراءة الملف ثم أعد الاختبار.'] },
      TIMEOUT: { title: 'انتهت مهلة اتصال MikroTik', explanation: 'لم يصل رد HTTPS خلال المهلة المحددة.', checks: ['تحقق من المسار وACL وجدار الحماية وخدمة www-ssl.'] },
      REDIRECT_REJECTED: { title: 'تم رفض إعادة توجيه HTTPS', explanation: 'لا يتبع الوكيل أي تحويل لتجنب تسريب بيانات Basic Auth.', checks: ['استخدم عنوان HTTPS النهائي الصحيح.'] },
      INVALID_RESPONSE: { title: 'استجابة RouterOS غير صالحة', explanation: 'لم تكن استجابة REST JSON بالشكل المتوقع.', checks: ['تحقق من إصدار RouterOS ومسارات REST المتاحة.'] },
      NETWORK_OR_TLS_ERROR: { title: 'تعذر الوصول الآمن إلى MikroTik', explanation: 'فشل الاتصال أو التحقق من شهادة TLS.', checks: ['تحقق من www-ssl والمسار وقواعد firewall وشهادة CA.', 'لا تعطّل التحقق من الشهادة ولا تستخدم HTTP.'] },
    };
    const match = descriptions[code] || { title: 'تعذر قراءة حالة MikroTik', explanation: 'فشل الفحص دون تنفيذ أي تغيير على جهاز الشبكة.', checks: ['راجع اتصال الإدارة وسجلات التطبيق.'] };
    return { code: 'MIKROTIK_' + code, severity: code === 'AUTHENTICATION_FAILED' ? 'CRITICAL' : 'WARNING', title: match.title, explanation: match.explanation, recommendedChecks: match.checks, sources: [REST_DOC, USER_DOC] };
  }
}
