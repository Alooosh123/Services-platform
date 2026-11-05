import { Injectable, Logger } from '@nestjs/common';
import {
  AiRecommendation,
  RiskLevel,
} from '@digital-topup/shared';
import {
  DeterministicRulesEngine,
  AccountLinkEvaluationContext,
} from './deterministic-rules.engine';

export interface AiEvaluationReport {
  recommendation: AiRecommendation;
  riskLevel: RiskLevel;
  riskScore: number; // 0 - 100 (0 = Lowest Risk, 100 = Highest Risk)
  ruleIds: string[];
  reasons: string[];
  reasonsAr: string[];
  needsHumanReview: boolean;
  sanitizedIdentifier: string;
  evaluatedAt: string;
  modelVersion: string;
  financialImpact: 'NONE'; // Strict barrier: zero financial impact
}

@Injectable()
export class AiRiskEvaluatorService {
  private readonly logger = new Logger(AiRiskEvaluatorService.name);
  private static readonly MODEL_VERSION = 'risk-engine-v1.0';

  constructor(private rulesEngine: DeterministicRulesEngine) {}

  /**
   * Evaluates linking risk with prompt-injection defense and explainable structured output.
   */
  evaluate(context: AccountLinkEvaluationContext): AiEvaluationReport {
    // 1. Sanitize untrusted user text against Prompt Injection attacks
    const sanitizedId = this.sanitizePromptInjection(context.accountIdentifier);
    const safeContext: AccountLinkEvaluationContext = {
      ...context,
      accountIdentifier: sanitizedId,
    };

    // 2. Run Deterministic Hard Rules
    const { rules, totalRiskPenalty, hardReject, rejectReason } =
      this.rulesEngine.evaluate(safeContext);

    if (hardReject) {
      return {
        recommendation: AiRecommendation.REJECT,
        riskLevel: RiskLevel.HIGH,
        riskScore: 100,
        ruleIds: rules.map((r) => r.ruleId),
        reasons: ['Hard rule failure: ' + (rejectReason || 'Unknown')],
        reasonsAr: [rejectReason || 'تم الرفض بواسطة القواعد الحتمية الصارمة'],
        needsHumanReview: false,
        sanitizedIdentifier: sanitizedId,
        evaluatedAt: new Date().toISOString(),
        modelVersion: AiRiskEvaluatorService.MODEL_VERSION,
        financialImpact: 'NONE',
      };
    }

    // 3. Compute baseline risk score (bounded between 0 and 100)
    let score = Math.min(100, Math.max(0, totalRiskPenalty));

    // Trust factors that lower the risk
    if (context.isPhoneVerified && context.completedOrdersCount > 2) {
      score = Math.max(0, score - 15);
    }
    if (context.userAccountAgeDays > 30) {
      score = Math.max(0, score - 10);
    }

    // 4. Derive Risk Level and Recommendation
    let riskLevel = RiskLevel.LOW;
    let recommendation = AiRecommendation.AUTO_APPROVE;
    let needsHumanReview = false;

    if (score >= 60) {
      riskLevel = RiskLevel.HIGH;
      recommendation = AiRecommendation.HUMAN_REVIEW;
      needsHumanReview = true;
    } else if (score >= 25) {
      riskLevel = RiskLevel.MEDIUM;
      recommendation = AiRecommendation.HUMAN_REVIEW;
      needsHumanReview = true;
    } else {
      riskLevel = RiskLevel.LOW;
      // Low risk non-financial linking can be approved automatically
      recommendation = AiRecommendation.AUTO_APPROVE;
      needsHumanReview = false;
    }

    // 5. Build explainable Arabic and English reasons
    const reasonsAr: string[] = [];
    const reasons: string[] = [];

    for (const rule of rules) {
      if (!rule.passed) {
        reasonsAr.push(`تنبيه: ${rule.descriptionAr}`);
        reasons.push(`Warning: ${rule.ruleId} failed`);
      }
    }

    if (context.isPhoneVerified) {
      reasonsAr.push('عامل ثقة: تم تأكيد ملكية رقم الهاتف اليمني عبر SMS');
      reasons.push('Trust signal: Verified Yemeni phone ownership via SMS');
    }

    if (recommendation === AiRecommendation.AUTO_APPROVE) {
      reasonsAr.push('توصية النظام: مؤشرات الأمان مكتملة ومنخفضة الخطورة، تم اعتماد الحساب المرجعي.');
      reasons.push('Recommendation: Low risk indicators, auto-approval granted.');
    } else {
      reasonsAr.push('توصية النظام: تحويل الحالة لطابور المراجعة البشرية للتأكد من هوية الحساب.');
      reasons.push('Recommendation: Queued for Human Review due to elevated risk signals.');
    }

    return {
      recommendation,
      riskLevel,
      riskScore: score,
      ruleIds: rules.map((r) => r.ruleId),
      reasons,
      reasonsAr,
      needsHumanReview,
      sanitizedIdentifier: sanitizedId,
      evaluatedAt: new Date().toISOString(),
      modelVersion: AiRiskEvaluatorService.MODEL_VERSION,
      financialImpact: 'NONE',
    };
  }

  /**
   * Sanitizes input to defend against prompt injection and malicious script vectors.
   */
  private sanitizePromptInjection(rawInput: string): string {
    if (!rawInput || typeof rawInput !== 'string') {
      return '';
    }

    let cleaned = rawInput.trim();

    // Strip out prompt injection attack patterns
    const injectionPatterns = [
      /ignore\s+(previous|all|prior)\s+(instructions|rules|prompts)/gi,
      /you\s+are\s+now\s+in\s+developer\s+mode/gi,
      /system\s*:/gi,
      /assistant\s*:/gi,
      /admin\s*override/gi,
      /bypass\s+security/gi,
      /approve\s+immediately/gi,
      /<\s*script[^>]*>.*?<\s*\/\s*script\s*>/gi,
      /['";]/g, // SQL / command injection chars
    ];

    for (const pattern of injectionPatterns) {
      cleaned = cleaned.replace(pattern, '');
    }

    // Limit length to 30 characters
    return cleaned.slice(0, 30).trim();
  }
}
