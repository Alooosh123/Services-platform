import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ISmsGatewayAdapter, SendSmsResult } from './sms-gateway.interface';

/**
 * Fail-closed production SMS adapter.
 *
 * No provider-specific request contract, authentication/signature scheme, or
 * delivery callback has been approved for this deployment. Do not report an
 * OTP as sent merely because placeholder environment variables exist.
 *
 * Replace this adapter only after the contracted SMS gateway supplies its
 * official API specification and sandbox credentials, then add provider
 * contract tests before enabling production phone verification.
 */
@Injectable()
export class ProductionSmsAdapter implements ISmsGatewayAdapter {
  readonly providerCode = 'PRODUCTION_SMS_UNCONFIGURED';

  async sendVerificationSms(_phone: string, _code: string): Promise<SendSmsResult> {
    throw new ServiceUnavailableException(
      'إرسال رسائل التحقق غير مفعّل: لم يتم تركيب محول موثق لمزود SMS. يلزم توفير وثائق API الرسمية وبيانات Sandbox واختبار التسليم قبل تفعيله.',
    );
  }
}
