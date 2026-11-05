import { Injectable } from '@nestjs/common';

export interface AccountLinkEvaluationContext {
  userId: string;
  serviceSlug: string;
  accountIdentifier: string;
  isPhoneVerified: boolean;
  userAccountAgeDays: number;
  completedOrdersCount: number;
  recentLinkAttempts24h: number;
  hasPriorRevocations: boolean;
  hasExplicitConsent: boolean;
}

export interface RuleEvaluationResult {
  ruleId: string;
  passed: boolean;
  weight: number;
  descriptionAr: string;
}

@Injectable()
export class DeterministicRulesEngine {
  /**
   * Runs deterministic hard rules against linking context.
   */
  evaluate(context: AccountLinkEvaluationContext): {
    rules: RuleEvaluationResult[];
    totalRiskPenalty: number;
    hardReject: boolean;
    rejectReason?: string;
  } {
    const rules: RuleEvaluationResult[] = [];
    let totalRiskPenalty = 0;
    let hardReject = false;
    let rejectReason: string | undefined;

    // Rule 1: Explicit Consent Mandatory
    if (!context.hasExplicitConsent) {
      hardReject = true;
      rejectReason = 'موافقة العميل الصريحة مطلوبة لحفظ وربط الحساب (Consent Required)';
      rules.push({
        ruleId: 'RULE_CONSENT_MANDATORY',
        passed: false,
        weight: 100,
        descriptionAr: 'رفض إلزامي: لم يتم منح موافقة المستخدم الصريحة',
      });
      return { rules, totalRiskPenalty: 100, hardReject, rejectReason };
    }

    // Rule 2: Basic Identifier Format Integrity (Player ID must be 5 to 15 alphanumeric characters)
    const sanitizedId = context.accountIdentifier.trim();
    const idRegex = /^[a-zA-Z0-9_\-\.]{5,20}$/;
    const validFormat = idRegex.test(sanitizedId);

    rules.push({
      ruleId: 'RULE_IDENTIFIER_FORMAT',
      passed: validFormat,
      weight: 35,
      descriptionAr: validFormat
        ? 'صيغة المعرف صحيحة ومطابقة للمواصفات'
        : 'صيغة معرف الحساب غير معتادة أو لا تطابق التعبير النمطي للخدمة',
    });
    if (!validFormat) {
      totalRiskPenalty += 35;
    }

    // Rule 3: Suspicious Mock/Test Identifier Patterns
    const isSuspicious =
      sanitizedId.startsWith('9999') ||
      sanitizedId === '00000000' ||
      sanitizedId.toLowerCase().includes('script') ||
      sanitizedId.toLowerCase().includes('select');

    rules.push({
      ruleId: 'RULE_SUSPICIOUS_PAYLOAD',
      passed: !isSuspicious,
      weight: 45,
      descriptionAr: !isSuspicious
        ? 'المعرف لا يحتوي على أنماط مشبوهة'
        : 'المعرف يحتوي على نمط مشبوه أو تجريبي',
    });
    if (isSuspicious) {
      totalRiskPenalty += 45;
    }

    // Rule 4: Phone Ownership Verification
    rules.push({
      ruleId: 'RULE_PHONE_VERIFIED',
      passed: context.isPhoneVerified,
      weight: 25,
      descriptionAr: context.isPhoneVerified
        ? 'تم التحقق من حيازة رقم الهاتف اليمني عبر SMS'
        : 'رقم هاتف العميل غير مؤكد عبر رسائل SMS',
    });
    if (!context.isPhoneVerified) {
      totalRiskPenalty += 25;
    }

    // Rule 5: Velocity Limits (Max 5 linking attempts in 24h)
    const normalVelocity = context.recentLinkAttempts24h <= 5;
    rules.push({
      ruleId: 'RULE_LINK_VELOCITY',
      passed: normalVelocity,
      weight: 30,
      descriptionAr: normalVelocity
        ? 'معدل ربط الحسابات ضمن الحدود الطبيعية'
        : 'محاولات متكررة لربط الحسابات خلال 24 ساعة (Velocity Threshold Exceeded)',
    });
    if (!normalVelocity) {
      totalRiskPenalty += 30;
    }

    // Rule 6: Prior Revocations
    if (context.hasPriorRevocations) {
      rules.push({
        ruleId: 'RULE_PRIOR_REVOCATION',
        passed: false,
        weight: 15,
        descriptionAr: 'يوجد سوابق إلغاء ربط لهذا المعرف',
      });
      totalRiskPenalty += 15;
    }

    return {
      rules,
      totalRiskPenalty,
      hardReject,
      rejectReason,
    };
  }
}
