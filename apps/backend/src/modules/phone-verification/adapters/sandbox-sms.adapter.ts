import { Injectable, Logger } from '@nestjs/common';
import { ISmsGatewayAdapter, SendSmsResult } from './sms-gateway.interface';

@Injectable()
export class SandboxSmsAdapter implements ISmsGatewayAdapter {
  readonly providerCode = 'SANDBOX_SMS';
  private readonly logger = new Logger(SandboxSmsAdapter.name);

  // In-memory record of sent sandbox messages for inspection/testing
  private sentMessages: Array<{ phone: string; code: string; sentAt: Date }> = [];

  async sendVerificationSms(phone: string, code: string): Promise<SendSmsResult> {
    const isProd = process.env.NODE_ENV === 'production';
    if (isProd) {
      this.logger.warn(`SandboxSmsAdapter invoked in production environment for ${phone}.`);
    }

    this.logger.log(`[SANDBOX SMS GATEWAY] To: ${phone} | Verification Code: ${code} | (Simulated Delivery)`);
    this.sentMessages.push({ phone, code, sentAt: new Date() });

    return {
      success: true,
      messageId: `SANDBOX-MSG-${Date.now()}`,
      simulated: true,
    };
  }

  getLastCodeForPhone(phone: string): string | undefined {
    const found = [...this.sentMessages].reverse().find((m) => m.phone === phone);
    return found?.code;
  }
}
