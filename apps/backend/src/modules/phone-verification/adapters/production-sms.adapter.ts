import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ISmsGatewayAdapter, SendSmsResult } from './sms-gateway.interface';

/**
 * Fail-closed production SMS adapter.
 *
 * A provider contract, signed integration, endpoint semantics, credentials and delivery
 * verification have not been supplied/certified yet. This adapter intentionally performs
 * no simulated network call and never returns a fabricated successful message ID.
 */
@Injectable()
export class ProductionSmsAdapter implements ISmsGatewayAdapter {
  readonly providerCode = 'PRODUCTION_SMS';
  private readonly logger = new Logger(ProductionSmsAdapter.name);

  async sendVerificationSms(_phone: string, _code: string): Promise<SendSmsResult> {
    this.logger.error('Production SMS delivery is disabled: no certified provider adapter is configured.');
    throw new ServiceUnavailableException(
      'إرسال OTP الإنتاجي غير متاح حتى اكتمال عقد مزود SMS وتنفيذ الربط الحقيقي واختبار تسليم الرسالة. لم يتم إرسال رسالة.',
    );
  }
}
