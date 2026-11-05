export interface SendSmsResult {
  success: boolean;
  messageId?: string;
  simulated?: boolean;
  errorMessage?: string;
}

export interface ISmsGatewayAdapter {
  readonly providerCode: string;
  sendVerificationSms(phone: string, code: string): Promise<SendSmsResult>;
}
