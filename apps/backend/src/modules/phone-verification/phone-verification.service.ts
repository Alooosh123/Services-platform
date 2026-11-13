import {
  Injectable,
  BadRequestException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../database/prisma.service';
import { PhoneNormalizer, YemeniPhoneInfo } from './utils/phone-normalizer.util';
import { SandboxSmsAdapter } from './adapters/sandbox-sms.adapter';
import { ProductionSmsAdapter } from './adapters/production-sms.adapter';
import { ISmsGatewayAdapter } from './adapters/sms-gateway.interface';
import { SendPhoneOtpDto } from './dto/send-otp.dto';
import { VerifyPhoneOtpDto } from './dto/verify-otp.dto';

interface ActiveOtpChallenge {
  id: string;
  phone: string;
  userId?: string;
  otpHash: string;
  attempts: number;
  expiresAt: Date;
  isUsed: boolean;
  ipAddress?: string;
  createdAt: Date;
}

@Injectable()
export class PhoneVerificationService {
  private readonly logger = new Logger(PhoneVerificationService.name);
  private smsAdapter: ISmsGatewayAdapter;

  // Active in-memory challenges store
  private challenges = new Map<string, ActiveOtpChallenge>();

  // Rate Limiting trackers to prevent OTP Pumping and SMS toll fraud
  private phoneRequestTimestamps = new Map<string, number[]>(); // phone -> [timestamp, ...]
  private ipRequestTimestamps = new Map<string, number[]>();    // ip -> [timestamp, ...]

  constructor(
    private prisma: PrismaService,
    private sandboxSms: SandboxSmsAdapter,
    private productionSms: ProductionSmsAdapter,
  ) {
    // Select adapter based on environment
    this.smsAdapter =
      process.env.NODE_ENV === 'production' ? this.productionSms : this.sandboxSms;
  }

  /**
   * Sets custom SMS adapter (for automated security test suites).
   */
  setSmsAdapter(adapter: ISmsGatewayAdapter) {
    this.smsAdapter = adapter;
  }

  /**
   * Sends a secure 6-digit OTP to a normalized Yemeni mobile number with rate-limiting.
   */
  async sendOtp(dto: SendPhoneOtpDto, userId?: string, ipAddress = '127.0.0.1') {
    const phoneInfo = PhoneNormalizer.normalizeYemeniPhone(dto.phone);
    const phone = phoneInfo.normalizedE164;

    // Rate Limiting 1: Max 3 OTP requests per phone in 15 minutes
    this.checkPhoneRateLimit(phone);

    // Rate Limiting 2: Max 10 OTP requests per IP in 60 minutes
    this.checkIpRateLimit(ipAddress);

    // Generate secure random 6-digit code
    const rawCode = crypto.randomInt(100000, 999999).toString();
    const otpHash = crypto.createHash('sha256').update(rawCode).digest('hex');

    const challengeId = uuidv4();
    const challenge: ActiveOtpChallenge = {
      id: challengeId,
      phone,
      userId,
      otpHash,
      attempts: 0,
      expiresAt: new Date(Date.now() + 3 * 60 * 1000), // 3 minutes TTL
      isUsed: false,
      ipAddress,
      createdAt: new Date(),
    };

    this.challenges.set(challengeId, challenge);

    // Record timestamps for rate limiting
    this.recordPhoneRequest(phone);
    this.recordIpRequest(ipAddress);

    // Send SMS via active adapter. If dispatch fails, invalidate the challenge;
    // never leave a usable OTP behind when the customer was not notified.
    let smsResult;
    try {
      smsResult = await this.smsAdapter.sendVerificationSms(phone, rawCode);
    } catch (error) {
      this.challenges.delete(challengeId);
      throw error;
    }
    const isDev = process.env.NODE_ENV !== 'production';

    return {
      success: true,
      challengeId,
      phone: phoneInfo.normalizedE164,
      carrier: phoneInfo.carrierAr,
      expiresInSeconds: 180,
      simulated: smsResult.simulated ?? false,
      devSandboxOtp: isDev ? rawCode : undefined,
      disclaimer: 'تأكيد امتلاك رقم الهاتف هو عامل حيازة تقني ولا يُعد KYC أو إثبات هوية رسمي.',
      message: `تم إرسال رمز التحقق إلى الرقم ${phoneInfo.normalizedE164} (${phoneInfo.carrierAr})`,
    };
  }

  /**
   * Verifies an OTP code with single-use enforcement, anti-replay, and brute-force lockout.
   */
  async verifyOtp(dto: VerifyPhoneOtpDto, callerUserId?: string) {
    const phoneInfo = PhoneNormalizer.normalizeYemeniPhone(dto.phone);
    const phone = phoneInfo.normalizedE164;

    // Find the latest active unused challenge for this phone
    const challenge = this.findLatestChallengeForPhone(phone);
    if (!challenge || challenge.isUsed) {
      throw new BadRequestException('لا يوجد طلب تحقق نشط لهذا الرقم، يرجى طلب رمز جديد');
    }

    // Check expiration
    if (new Date() > challenge.expiresAt) {
      this.challenges.delete(challenge.id);
      throw new BadRequestException('انتهت صلاحية رمز التحقق (3 دقائق). يرجى طلب رمز جديد.');
    }

    // Brute-Force lockout: Max 3 failed attempts
    if (challenge.attempts >= 3) {
      this.challenges.delete(challenge.id);
      throw new BadRequestException('تم تجاوز الحد الأقصى للمحاولات (3 محاولات فاشلة). تم إبطال التحدي لأسباب أمنية.');
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const submittedHash = crypto.createHash('sha256').update(dto.code.trim()).digest('hex');

    // Timing-safe hash comparison
    const isCodeValid = crypto.timingSafeEqual(
      Buffer.from(submittedHash),
      Buffer.from(challenge.otpHash),
    );

    if (!isCodeValid) {
      challenge.attempts += 1;
      const remainingAttempts = 3 - challenge.attempts;

      if (challenge.attempts >= 3) {
        this.challenges.delete(challenge.id);
        throw new BadRequestException('تم تجاوز الحد الأقصى للمحاولات (3 محاولات فاشلة). تم إبطال التحدي.');
      }

      throw new BadRequestException(`رمز التحقق غير صحيح. المتبقي: ${remainingAttempts} محاولات`);
    }

    // SUCCESS: Single-use invalidation
    challenge.isUsed = true;
    this.challenges.delete(challenge.id);

    const verifiedAt = new Date();
    const targetUserId = callerUserId || challenge.userId;

    // Update database user record if available
    if (targetUserId) {
      try {
        await this.prisma.user.update({
          where: { id: targetUserId },
          data: {
            phoneVerifiedAt: verifiedAt,
          },
        });
      } catch (err: any) {
        this.logger.warn(`Could not update User.phoneVerifiedAt in DB: ${err?.message}`);
      }
    }

    return {
      success: true,
      phone: phoneInfo.normalizedE164,
      carrier: phoneInfo.carrierAr,
      verifiedAt,
      verificationMethod: 'SMS_OTP',
      message: 'تم تأكيد ملكية رقم الهاتف بنجاح',
      disclaimer: 'تأكيد حيازة رقم الهاتف هو إجراء أمني لإثبات ملكية الشريحة ولا يُعد إثباتاً قانونياً شاملاً للهوية (KYC).',
    };
  }

  /**
   * Retrieves phone verification status for a user or phone number
   */
  async getStatus(userId?: string, rawPhone?: string) {
    let user: any = null;
    if (userId) {
      try {
        user = await this.prisma.user.findUnique({ where: { id: userId } });
      } catch {}
    }

    const isVerified = Boolean(user?.phoneVerifiedAt);

    return {
      userId,
      phone: user?.phone || rawPhone || null,
      isVerified,
      phoneVerifiedAt: user?.phoneVerifiedAt || null,
      verificationMethod: isVerified ? 'SMS_OTP' : null,
      disclaimer: 'تأكيد حيازة رقم الهاتف هو إثبات لحيازة الشريحة (Possession Factor) ولا يُعد إثبات هوية رسمية.',
    };
  }

  private findLatestChallengeForPhone(phone: string): ActiveOtpChallenge | undefined {
    let latest: ActiveOtpChallenge | undefined;
    for (const c of this.challenges.values()) {
      if (c.phone === phone && !c.isUsed) {
        if (!latest || c.createdAt > latest.createdAt) {
          latest = c;
        }
      }
    }
    return latest;
  }

  private checkPhoneRateLimit(phone: string) {
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes
    const timestamps = (this.phoneRequestTimestamps.get(phone) || []).filter(
      (t) => now - t < windowMs,
    );

    if (timestamps.length >= 3) {
      throw new BadRequestException('تم تجاوز الحد الأقصى لطلب رموز التحقق لهذا الرقم (3 مرات خلال 15 دقيقة). يرجى الانتظار.');
    }
  }

  private checkIpRateLimit(ip: string) {
    const now = Date.now();
    const windowMs = 60 * 60 * 1000; // 60 minutes
    const timestamps = (this.ipRequestTimestamps.get(ip) || []).filter(
      (t) => now - t < windowMs,
    );

    if (timestamps.length >= 10) {
      throw new BadRequestException('تم تجاوز الحد الأقصى للطلبات من هذا العنوان. يرجى المحاولة لاحقاً (Anti-OTP Pumping).');
    }
  }

  private recordPhoneRequest(phone: string) {
    const now = Date.now();
    const timestamps = (this.phoneRequestTimestamps.get(phone) || []).filter(
      (t) => now - t < 15 * 60 * 1000,
    );
    timestamps.push(now);
    this.phoneRequestTimestamps.set(phone, timestamps);
  }

  private recordIpRequest(ip: string) {
    const now = Date.now();
    const timestamps = (this.ipRequestTimestamps.get(ip) || []).filter(
      (t) => now - t < 60 * 60 * 1000,
    );
    timestamps.push(now);
    this.ipRequestTimestamps.set(ip, timestamps);
  }
}
