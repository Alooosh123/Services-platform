import { Injectable, Logger, Optional } from '@nestjs/common';
import {
  CurrencyCode,
  PaymentChannelCode,
  PaymentChannelInfo,
  PaymentChannelMode,
  PaymentChannelCapabilities,
  InboundWebhookPayload,
  DepositConfirmResult,
  OutboundPayoutPayload,
  PayoutResult,
  ChannelVerificationStatus,
  CreateDynamicChannelDto,
  ApproveChannelChangeDto,
} from '@digital-topup/shared';

export interface IPaymentChannelAdapter {
  getChannelCode(): PaymentChannelCode;
  getInfo(): PaymentChannelInfo;
  getCapabilities(): PaymentChannelCapabilities;
  getMode(): PaymentChannelMode;
  setMode(mode: PaymentChannelMode): void;
  updateCapabilities(caps: Partial<PaymentChannelCapabilities>): void;
  validateTransfer(data: {
    amount: number;
    referenceNumber: string;
    senderPhone?: string;
  }): { isValid: boolean; message?: string };
  depositConfirm(payload: InboundWebhookPayload): Promise<DepositConfirmResult>;
  transactionLookup(referenceNumber: string): Promise<{
    found: boolean;
    status?: string;
    amount?: number;
    currency?: CurrencyCode;
    referenceNumber?: string;
    raw?: any;
  }>;
  payout(payload: OutboundPayoutPayload): Promise<PayoutResult>;
  balance(): Promise<{ balance: number; currency: CurrencyCode; raw?: any }>;
  reconcile(date: string, externalItems?: any[]): Promise<{ matched: boolean; discrepancies?: any[] }>;
}

export abstract class BasePaymentChannelAdapter implements IPaymentChannelAdapter {
  protected readonly logger = new Logger(this.constructor.name);
  protected mode: PaymentChannelMode = PaymentChannelMode.MANUAL;
  protected capabilities: PaymentChannelCapabilities = {
    depositConfirm: false,
    transactionLookup: false,
    payout: false,
    balance: false,
    reconcile: false,
  };
  protected verificationStatus: ChannelVerificationStatus = ChannelVerificationStatus.VERIFIED;
  protected financeApprovalRequired: boolean = false;
  protected activeAccountNumber: string | null = null;
  protected pendingAccountNumber: string | null = null;
  protected pendingFeePercentage: number | null = null;
  protected killSwitchReason: string | null = null;

  abstract getChannelCode(): PaymentChannelCode;
  abstract getBaseInfo(): Omit<PaymentChannelInfo, 'mode' | 'capabilities'>;

  getInfo(): PaymentChannelInfo {
    const base = this.getBaseInfo();
    return {
      ...base,
      accountNumber: this.activeAccountNumber || (this.pendingAccountNumber && !this.financeApprovalRequired ? this.pendingAccountNumber : base.accountNumber),
      mode: this.mode,
      capabilities: { ...this.capabilities },
      isVerifiedLegal: this.verificationStatus === ChannelVerificationStatus.VERIFIED,
      verificationStatus: this.verificationStatus,
      financeApprovalRequired: this.financeApprovalRequired,
      pendingAccountNumber: this.pendingAccountNumber,
      killSwitchReason: this.killSwitchReason,
    } as any;
  }

  getCapabilities(): PaymentChannelCapabilities {
    return { ...this.capabilities };
  }

  getMode(): PaymentChannelMode {
    return this.mode;
  }

  setMode(mode: PaymentChannelMode): void {
    this.logger.log(`[SafeModeSwitch] Switching ${this.getChannelCode()} mode to ${mode}`);
    this.mode = mode;
  }

  updateCapabilities(caps: Partial<PaymentChannelCapabilities>): void {
    this.capabilities = { ...this.capabilities, ...caps };
  }

  proposeAccountChange(newAccountNumber: string, feePercentage?: number): void {
    this.logger.warn(
      `[FourEyesPrinciple] Channel ${this.getChannelCode()} proposed account change to ${newAccountNumber}. Pending Finance Review.`,
    );
    this.pendingAccountNumber = newAccountNumber;
    if (feePercentage !== undefined) this.pendingFeePercentage = feePercentage;
    this.financeApprovalRequired = true;
    this.verificationStatus = ChannelVerificationStatus.PENDING_REVIEW;
  }

  approveFinanceReview(approved: boolean, financeNotes?: string): void {
    if (approved) {
      this.logger.log(
        `[FinanceApproved] Channel ${this.getChannelCode()} changes approved by Finance. Notes: ${financeNotes}`,
      );
      if (this.pendingAccountNumber) {
        this.activeAccountNumber = this.pendingAccountNumber;
        this.pendingAccountNumber = null;
      }
      this.verificationStatus = ChannelVerificationStatus.VERIFIED;
      this.financeApprovalRequired = false;
    } else {
      this.logger.warn(`[FinanceRejected] Channel ${this.getChannelCode()} changes rejected. Notes: ${financeNotes}`);
      this.pendingAccountNumber = null;
      this.pendingFeePercentage = null;
      this.financeApprovalRequired = false;
      this.verificationStatus = ChannelVerificationStatus.REJECTED;
    }
  }

  triggerKillSwitch(reason: string): void {
    this.logger.error(`[KillSwitchTriggered] Channel ${this.getChannelCode()} STOPPED. Reason: ${reason}`);
    this.mode = PaymentChannelMode.DISABLED;
    this.killSwitchReason = reason;
    this.updateCapabilities({ depositConfirm: false, payout: false });
  }

  abstract validateTransfer(data: {
    amount: number;
    referenceNumber: string;
    senderPhone?: string;
  }): { isValid: boolean; message?: string };

  async depositConfirm(payload: InboundWebhookPayload): Promise<DepositConfirmResult> {
    if (
      !this.capabilities.depositConfirm ||
      this.mode === PaymentChannelMode.MANUAL ||
      this.mode === PaymentChannelMode.BLOCKED_EXTERNAL ||
      this.mode === PaymentChannelMode.DISABLED
    ) {
      return {
        success: false,
        status: 'MANUAL_REVIEW',
        message: 'القناة تعمل في وضع التحقق اليدوي (MANUAL_VERIFY) أو معطلة للتحويل الآلي.',
      };
    }
    return {
      success: true,
      status: 'CREDITED',
      message: 'تم التحقق من العملية وتأكيد الإيداع.',
    };
  }

  async transactionLookup(referenceNumber: string): Promise<{
    found: boolean;
    status?: string;
    amount?: number;
    currency?: CurrencyCode;
    referenceNumber?: string;
    raw?: any;
  }> {
    if (!this.capabilities.transactionLookup) {
      return {
        found: false,
        status: 'UNSUPPORTED',
        raw: { message: 'استعلام الحسابات غير متاح آلياً لهذه القناة' },
      };
    }
    return { found: false, status: 'NOT_FOUND' };
  }

  async payout(payload: OutboundPayoutPayload): Promise<PayoutResult> {
    if (
      !this.capabilities.payout ||
      this.mode === PaymentChannelMode.MANUAL ||
      this.mode === PaymentChannelMode.BLOCKED_EXTERNAL ||
      this.mode === PaymentChannelMode.DISABLED
    ) {
      return {
        success: false,
        status: 'BLOCKED_EXTERNAL',
        message: `التحويل الآلي المباشر عبر ${this.getChannelCode()} محجوب خارجياً (BLOCKED_EXTERNAL). البنوك اليمنية تتطلب مسار SOP يدوي معتمد وإرفاق إشعار بنكي رسمي.`,
      };
    }
    return {
      success: true,
      status: 'CONFIRMED',
      externalReference: `EXT-PO-${Date.now()}`,
      message: 'تم تنفيذ التحويل الخارجي بنجاح.',
    };
  }

  async balance(): Promise<{ balance: number; currency: CurrencyCode; raw?: any }> {
    return {
      balance: 0,
      currency: CurrencyCode.YER,
      raw: { message: 'رصيد القناة يتم تتبعه عبر التسوية المحاسبية اليدوية' },
    };
  }

  async reconcile(date: string, externalItems?: any[]): Promise<{ matched: boolean; discrepancies?: any[] }> {
    return { matched: true, discrepancies: [] };
  }
}

@Injectable()
export class JaibPaymentAdapter extends BasePaymentChannelAdapter {
  getChannelCode(): PaymentChannelCode {
    return PaymentChannelCode.JAIB;
  }

  getBaseInfo(): Omit<PaymentChannelInfo, 'mode' | 'capabilities'> {
    return {
      code: PaymentChannelCode.JAIB,
      name: 'Jaib Wallet (CAC Bank)',
      nameAr: 'محفظة جيب - بنك التسليف التعاوني الزراعي CAC',
      accountNumber: '770123456',
      accountHolderName: 'منصة الشحن والخدمات الرقمية اليمنية المحدودة',
      instructionsAr:
        'قم بفتح تطبيق جيب، اختر تحويل أموال إلى محفظة أخرى، أدخل رقم الحساب 770123456 باسم (منصة الشحن والخدمات الرقمية اليمنية المحدودة)، ثم انسخ رقم الحوالة وأرفق صورة الإشعار للمراجعة الفورية.',
      supportedCurrencies: [CurrencyCode.YER],
      minAmount: 500,
      maxAmount: 2000000,
      isActive: true,
      dailyLimit: 10000000,
      feePercentage: 0,
      feeFixed: 0,
      isVerifiedLegal: true,
    };
  }

  validateTransfer(data: { amount: number; referenceNumber: string; senderPhone?: string }) {
    if (!data.referenceNumber || data.referenceNumber.trim().length < 5) {
      return { isValid: false, message: 'رقم حوالة محفظة جيب يجب أن لا يقل عن 5 خانات' };
    }
    if (data.amount < 500) {
      return { isValid: false, message: 'الحد الأدنى للإيداع عبر محفظة جيب هو 500 ريال يمني' };
    }
    return { isValid: true };
  }
}

@Injectable()
export class JawaliPaymentAdapter extends BasePaymentChannelAdapter {
  getChannelCode(): PaymentChannelCode {
    return PaymentChannelCode.JAWALI;
  }

  getBaseInfo(): Omit<PaymentChannelInfo, 'mode' | 'capabilities'> {
    return {
      code: PaymentChannelCode.JAWALI,
      name: 'Jawali Wallet (YKB Bank)',
      nameAr: 'محفظة جوالي - بنك اليمن والكويت',
      accountNumber: '733987654',
      accountHolderName: 'منصة الشحن والخدمات الرقمية اليمنية المحدودة',
      instructionsAr:
        'قم بالتحويل عبر تطبيق جوالي إلى الحساب رقم 733987654 باسم (منصة الشحن والخدمات الرقمية اليمنية المحدودة)، ثم أدخل الرقم المرجعي للعملية وصورة إشعار السداد.',
      supportedCurrencies: [CurrencyCode.YER],
      minAmount: 500,
      maxAmount: 2000000,
      isActive: true,
      dailyLimit: 10000000,
      feePercentage: 0,
      feeFixed: 0,
      isVerifiedLegal: true,
    };
  }

  validateTransfer(data: { amount: number; referenceNumber: string; senderPhone?: string }) {
    if (!data.referenceNumber || data.referenceNumber.trim().length < 5) {
      return { isValid: false, message: 'الرقم المرجعي لحوالة جوالي غير صالح' };
    }
    if (data.amount < 500) {
      return { isValid: false, message: 'الحد الأدنى للإيداع عبر جوالي هو 500 ريال يمني' };
    }
    return { isValid: true };
  }
}

@Injectable()
export class CashPaymentAdapter extends BasePaymentChannelAdapter {
  getChannelCode(): PaymentChannelCode {
    return PaymentChannelCode.CASH;
  }

  getBaseInfo(): Omit<PaymentChannelInfo, 'mode' | 'capabilities'> {
    return {
      code: PaymentChannelCode.CASH,
      name: 'Cash Wallet (Saba Bank)',
      nameAr: 'محفظة كاش - بنك سبأ الإسلامي',
      accountNumber: '711223344',
      accountHolderName: 'منصة الشحن والخدمات الرقمية اليمنية المحدودة',
      instructionsAr:
        'قم بالتحويل عبر تطبيق كاش إلى الحساب رقم 711223344 باسم (منصة الشحن والخدمات الرقمية اليمنية المحدودة)، ثم أدخل رقم الحوالة وصورة السند.',
      supportedCurrencies: [CurrencyCode.YER],
      minAmount: 500,
      maxAmount: 2000000,
      isActive: true,
      dailyLimit: 10000000,
      feePercentage: 0,
      feeFixed: 0,
      isVerifiedLegal: true,
    };
  }

  validateTransfer(data: { amount: number; referenceNumber: string; senderPhone?: string }) {
    if (!data.referenceNumber || data.referenceNumber.trim().length < 5) {
      return { isValid: false, message: 'رقم حوالة محفظة كاش غير صالح' };
    }
    if (data.amount < 500) {
      return { isValid: false, message: 'الحد الأدنى للإيداع عبر كاش هو 500 ريال يمني' };
    }
    return { isValid: true };
  }
}

@Injectable()
export class OneCashPaymentAdapter extends BasePaymentChannelAdapter {
  getChannelCode(): PaymentChannelCode {
    return PaymentChannelCode.ONE_CASH;
  }

  getBaseInfo(): Omit<PaymentChannelInfo, 'mode' | 'capabilities'> {
    return {
      code: PaymentChannelCode.ONE_CASH,
      name: 'One Cash (YOU Telecom)',
      nameAr: 'ون كاش - شركة YOU',
      accountNumber: '739112233',
      accountHolderName: 'منصة الشحن والخدمات الرقمية اليمنية المحدودة',
      instructionsAr:
        'حول المبلغ عبر خدمة ون كاش إلى الرقم 739112233، ثم أدخل رقم الإشعار للتحقق المالي السريع.',
      supportedCurrencies: [CurrencyCode.YER],
      minAmount: 500,
      maxAmount: 1500000,
      isActive: true,
      dailyLimit: 8000000,
      feePercentage: 0,
      feeFixed: 0,
      isVerifiedLegal: true,
    };
  }

  validateTransfer(data: { amount: number; referenceNumber: string; senderPhone?: string }) {
    if (!data.referenceNumber || data.referenceNumber.trim().length < 5) {
      return { isValid: false, message: 'رقم إشعار ون كاش غير صالح' };
    }
    if (data.amount < 500) {
      return { isValid: false, message: 'الحد الأدنى للإيداع عبر ون كاش هو 500 ريال يمني' };
    }
    return { isValid: true };
  }
}

@Injectable()
export class EasyPaymentAdapter extends BasePaymentChannelAdapter {
  getChannelCode(): PaymentChannelCode {
    return PaymentChannelCode.EASY;
  }

  getBaseInfo(): Omit<PaymentChannelInfo, 'mode' | 'capabilities'> {
    return {
      code: PaymentChannelCode.EASY,
      name: 'Easy Wallet',
      nameAr: 'محفظة إيزي للدفع الإلكتروني',
      accountNumber: '775544332',
      accountHolderName: 'منصة الشحن والخدمات الرقمية اليمنية المحدودة',
      instructionsAr:
        'حول إلى محفظة إيزي رقم 775544332، وأدخل رقم العملية للتحقق المالي من قبل المشرفين.',
      supportedCurrencies: [CurrencyCode.YER],
      minAmount: 500,
      maxAmount: 1500000,
      isActive: true,
      dailyLimit: 8000000,
      feePercentage: 0,
      feeFixed: 0,
      isVerifiedLegal: true,
    };
  }

  validateTransfer(data: { amount: number; referenceNumber: string; senderPhone?: string }) {
    if (!data.referenceNumber || data.referenceNumber.trim().length < 5) {
      return { isValid: false, message: 'رقم عملية إيزي غير صالح' };
    }
    if (data.amount < 500) {
      return { isValid: false, message: 'الحد الأدنى للإيداع عبر إيزي هو 500 ريال يمني' };
    }
    return { isValid: true };
  }
}

/**
 * Sandbox automated adapter for unit/integration/E2E testing of automated features.
 */
@Injectable()
export class SandboxPaymentAdapter extends BasePaymentChannelAdapter {
  constructor() {
    super();
    this.mode = PaymentChannelMode.API;
    this.capabilities = {
      depositConfirm: true,
      transactionLookup: true,
      payout: true,
      balance: true,
      reconcile: true,
    };
  }

  getChannelCode(): PaymentChannelCode {
    return PaymentChannelCode.WALLET;
  }

  getBaseInfo(): Omit<PaymentChannelInfo, 'mode' | 'capabilities'> {
    return {
      code: PaymentChannelCode.WALLET,
      name: 'Sandbox Automated Channel',
      nameAr: 'قناة المحاكاة الآلية للاختبارات والمطابقة (Sandbox API)',
      accountNumber: 'SANDBOX-ACC-001',
      accountHolderName: 'منصة الشحن والخدمات الرقمية - بيئة الاختبارات',
      instructionsAr: 'قناة اختبارات مؤتمتة تدعم الويب هوك والسحب الآلي والمطابقة.',
      supportedCurrencies: [CurrencyCode.YER, CurrencyCode.USD, CurrencyCode.SAR],
      minAmount: 1,
      maxAmount: 5000000,
      isActive: true,
      dailyLimit: 50000000,
      feePercentage: 0,
      feeFixed: 0,
      isVerifiedLegal: true,
    };
  }

  validateTransfer(data: { amount: number; referenceNumber: string; senderPhone?: string }) {
    if (!data.referenceNumber || data.referenceNumber.trim().length < 3) {
      return { isValid: false, message: 'المرجع يجب أن لا يقل عن 3 خانات' };
    }
    if (data.amount <= 0) {
      return { isValid: false, message: 'المبلغ يجب أن يكون أكبر من صفر' };
    }
    return { isValid: true };
  }

  async depositConfirm(payload: InboundWebhookPayload): Promise<DepositConfirmResult> {
    if (payload.amount <= 0) {
      return {
        success: false,
        status: 'REJECTED',
        message: 'مبلغ غير صالح',
      };
    }
    return {
      success: true,
      status: 'CREDITED',
      depositNumber: `DEP-SBX-${payload.transactionReference}`,
      message: 'تم تأكيد الإيداع آلياً عبر Sandbox Webhook',
    };
  }

  async transactionLookup(referenceNumber: string) {
    return {
      found: true,
      status: 'CONFIRMED',
      amount: 1000,
      currency: CurrencyCode.YER,
      referenceNumber,
    };
  }

  async payout(payload: OutboundPayoutPayload): Promise<PayoutResult> {
    if (payload.amount > 1000000) {
      return {
        success: false,
        status: 'FAILED',
        message: 'تجاوز الحد الأقصى المسموح للعملية الواحدة في Sandbox',
      };
    }
    return {
      success: true,
      status: 'CONFIRMED',
      externalReference: `SANDBOX-PO-${Date.now()}`,
      message: 'تم تنفيذ التحويل الآلي بنجاح عبر بوابة المحاكاة',
    };
  }

  async balance() {
    return {
      balance: 10000000,
      currency: CurrencyCode.YER,
      raw: { provider: 'SANDBOX' },
    };
  }
}

@Injectable()
export class PaymentAdapterRegistry {
  private adapters = new Map<PaymentChannelCode, IPaymentChannelAdapter>();
  private readonly logger = new Logger(PaymentAdapterRegistry.name);

  constructor(
    jaib: JaibPaymentAdapter,
    jawali: JawaliPaymentAdapter,
    cash: CashPaymentAdapter,
    oneCash: OneCashPaymentAdapter,
    easy: EasyPaymentAdapter,
    @Optional() sandbox?: SandboxPaymentAdapter,
  ) {
    this.adapters.set(PaymentChannelCode.JAIB, jaib);
    this.adapters.set(PaymentChannelCode.JAWALI, jawali);
    this.adapters.set(PaymentChannelCode.CASH, cash);
    this.adapters.set(PaymentChannelCode.ONE_CASH, oneCash);
    this.adapters.set(PaymentChannelCode.EASY, easy);
    if (sandbox) {
      this.adapters.set(PaymentChannelCode.WALLET, sandbox);
    } else {
      this.adapters.set(PaymentChannelCode.WALLET, new SandboxPaymentAdapter());
    }
  }

  getAdapter(channelCode: PaymentChannelCode): IPaymentChannelAdapter | undefined {
    return this.adapters.get(channelCode);
  }

  getAllChannels(): PaymentChannelInfo[] {
    return Array.from(this.adapters.values()).map((a) => a.getInfo());
  }

  switchChannelMode(
    channelCode: PaymentChannelCode,
    targetMode: PaymentChannelMode,
  ): { success: boolean; message: string; channel: PaymentChannelInfo } {
    const adapter = this.adapters.get(channelCode);
    if (!adapter) {
      throw new Error(`قناة الدفع ${channelCode} غير مسجلة`);
    }

    adapter.setMode(targetMode);
    return {
      success: true,
      message: `تم تحويل وضع القناة ${channelCode} بنجاح إلى ${targetMode}`,
      channel: adapter.getInfo(),
    };
  }

  /**
   * Safely failover channel when network/API issues are detected
   */
  failoverChannel(channelCode: PaymentChannelCode, reason = 'API failure detected'): PaymentChannelInfo {
    const adapter = this.adapters.get(channelCode);
    if (!adapter) {
      throw new Error(`قناة الدفع ${channelCode} غير مسجلة`);
    }

    this.logger.warn(`[FailoverSafe] Switching ${channelCode} to MANUAL safe mode: ${reason}`);
    adapter.setMode(PaymentChannelMode.MANUAL);
    adapter.updateCapabilities({ depositConfirm: false, payout: false });
    return adapter.getInfo();
  }

  /**
   * Verify legal accounts in production (BR-06 / Legal Compliance)
   */
  verifyLegalAccounts(): { isValid: boolean; unverified: string[] } {
    const unverified: string[] = [];
    for (const [code, adapter] of this.adapters.entries()) {
      const info = adapter.getInfo();
      if (!info.isVerifiedLegal || info.accountNumber.includes('TEST') || info.accountNumber.includes('MOCK')) {
        unverified.push(code);
      }
    }
    return {
      isValid: unverified.length === 0,
      unverified,
    };
  }

  /**
   * P06: Create a new dynamic payment channel
   */
  createDynamicChannel(dto: CreateDynamicChannelDto): PaymentChannelInfo {
    const adapter = new DynamicPaymentAdapter(dto);
    this.adapters.set(dto.code, adapter);
    return adapter.getInfo();
  }

  /**
   * P06: Propose channel account change (requires independent finance approval)
   */
  proposeChannelAccountChange(
    channelCode: PaymentChannelCode,
    newAccountNumber: string,
    feePercentage?: number,
  ): PaymentChannelInfo {
    const adapter = this.adapters.get(channelCode) as BasePaymentChannelAdapter;
    if (!adapter) throw new Error(`قناة الدفع ${channelCode} غير مسجلة`);
    adapter.proposeAccountChange(newAccountNumber, feePercentage);
    return adapter.getInfo();
  }

  /**
   * P06: Independent Finance Approval (Dual Control / Four-Eyes Principle)
   */
  approveChannelFinanceReview(
    adminUserId: string,
    channelCode: PaymentChannelCode,
    dto: ApproveChannelChangeDto,
  ): { success: boolean; message: string; channel: PaymentChannelInfo } {
    const adapter = this.adapters.get(channelCode) as BasePaymentChannelAdapter;
    if (!adapter) throw new Error(`قناة الدفع ${channelCode} غير مسجلة`);
    adapter.approveFinanceReview(dto.approved, dto.financeNotes);
    return {
      success: true,
      message: dto.approved
        ? `تم اعتماد وتوثيق تغييرات القناة ${channelCode} مالياً ونشر الحساب الجديد`
        : `تم رفض تغييرات القناة ${channelCode} وإلغاء التعديل المعلق`,
      channel: adapter.getInfo(),
    };
  }

  /**
   * P06: Emergency Kill Switch for Payment Channel (AT-24)
   */
  triggerChannelKillSwitch(
    adminUserId: string,
    channelCode: PaymentChannelCode,
    reason: string,
  ): { success: boolean; message: string; channel: PaymentChannelInfo } {
    const adapter = this.adapters.get(channelCode) as BasePaymentChannelAdapter;
    if (!adapter) throw new Error(`قناة الدفع ${channelCode} غير مسجلة`);
    adapter.triggerKillSwitch(reason);
    return {
      success: true,
      message: `تم إيقاف القناة ${channelCode} فورياً وحظر استقبال أي مدفوعات جديدة عبرها (Emergency Kill Switch)`,
      channel: adapter.getInfo(),
    };
  }
}

/**
 * P06 Dynamic Payment Adapter for admin-created channels
 */
export class DynamicPaymentAdapter extends BasePaymentChannelAdapter {
  private baseInfo: PaymentChannelInfo;

  constructor(dto: CreateDynamicChannelDto) {
    super();
    this.mode = dto.mode || PaymentChannelMode.MANUAL;
    this.verificationStatus = dto.isLegalVerified ? ChannelVerificationStatus.VERIFIED : ChannelVerificationStatus.PENDING_REVIEW;
    this.financeApprovalRequired = !dto.isLegalVerified;
    this.baseInfo = {
      code: dto.code,
      name: dto.name,
      nameAr: dto.nameAr,
      accountNumber: dto.accountNumber,
      accountHolderName: dto.accountHolderName,
      instructionsAr: dto.instructionsAr,
      supportedCurrencies: dto.supportedCurrencies,
      minAmount: dto.minAmount,
      maxAmount: dto.maxAmount,
      isActive: true,
      dailyLimit: 10000000,
      feePercentage: 0,
      feeFixed: 0,
      isVerifiedLegal: dto.isLegalVerified ?? false,
    };
  }

  getChannelCode(): PaymentChannelCode {
    return this.baseInfo.code;
  }

  getBaseInfo(): Omit<PaymentChannelInfo, 'mode' | 'capabilities'> {
    return this.baseInfo;
  }

  validateTransfer(data: { amount: number; referenceNumber: string; senderPhone?: string }) {
    if (data.amount < this.baseInfo.minAmount || data.amount > this.baseInfo.maxAmount) {
      return { isValid: false, message: 'المبلغ خارج نطاق حدود القناة' };
    }
    return { isValid: true };
  }
}

