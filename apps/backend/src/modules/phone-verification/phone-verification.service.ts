import {
  Injectable,
  BadRequestException,
  Logger,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../database/prisma.service';
import { RedisIdempotencyStore } from '../../security/redis-idempotency.store';
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
    private readonly redisStore: RedisIdempotencyStore,
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
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction) {
      const phoneRequests = await this.redisStore.incrementWithTtl(
        this.rateLimitKey('phone', phone),
        15 * 60 * 1000,
      );
      if (phoneRequests > 3) {
        throw new BadRequestException('تم تجاوز الحد الأقصى لطلب رموز التحقق لهذا الرقم (3 مرات خلال 15 دقيقة). يرجى الانتظار.');
      }
      const ipRequests = await this.redisStore.incrementWithTtl(
        this.rateLimitKey('ip', ipAddress),
        60 * 60 * 1000,
      );
      if (ipRequests > 10) {
        throw new BadRequestException('تم تجاوز الحد الأقصى للطلبات من هذا العنوان. يرجى المحاولة لاحقاً (Anti-OTP Pumping).');
      }
    } else {
      this.checkPhoneRateLimit(phone);
      this.checkIpRateLimit(ipAddress);
    }

    const rawCode = crypto.randomInt(100000, 1000000).toString();
    const otpHash = crypto.createHash('sha256').update(rawCode).digest('hex');
    const challengeId = uuidv4();
    const challenge: ActiveOtpChallenge = {
      id: challengeId,
      phone,
      userId,
      otpHash,
      attempts: 0,
      expiresAt: new Date(Date.now() + 3 * 60 * 1000),
      isUsed: false,
      ipAddress,
      createdAt: new Date(),
    };

    // Deliver first; a challenge is not made verifiable until a real provider reports success.
    const smsResult = await this.smsAdapter.sendVerificationSms(phone, rawCode);
    if (isProduction && (!smsResult.success || smsResult.simulated)) {
      throw new ServiceUnavailableException('لم يؤكد مزود SMS تسليم الرسالة الحقيقية؛ لم يتم إنشاء تحدي تحقق.');
    }

    if (isProduction) {
      const ttlMs = 3 * 60 * 1000;
      try {
        await this.redisStore.setValue(this.challengeKey(challengeId), JSON.stringify(challenge), ttlMs);
        await this.redisStore.setValue(this.latestChallengeKey(phone), challengeId, ttlMs);
      } catch {
        // Do not return a challenge ID that cannot be recovered by all production instances.
        throw new ServiceUnavailableException('تعذر حفظ تحدي OTP في Redis؛ اطلب رمزاً جديداً بعد استعادة الخدمة.');
      }
    } else {
      this.challenges.set(challengeId, challenge);
      this.recordPhoneRequest(phone);
      this.recordIpRequest(ipAddress);
    }

    const isDev = !isProduction;
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

  async verifyOtp(dto: VerifyPhoneOtpDto, callerUserId?: string) {
    const phoneInfo = PhoneNormalizer.normalizeYemeniPhone(dto.phone);
    const phone = phoneInfo.normalizedE164;
    const isProduction = process.env.NODE_ENV === 'production';

    let challenge: ActiveOtpChallenge | undefined;
    let challengeId: string | null = null;
    if (isProduction) {
      challengeId = await this.redisStore.get(this.latestChallengeKey(phone));
      if (challengeId) {
        const serialized = await this.redisStore.get(this.challengeKey(challengeId));
        if (serialized) {
          try {
            challenge = JSON.parse(serialized) as ActiveOtpChallenge;
          } catch {
            await this.redisStore.deleteValue(this.latestChallengeKey(phone));
          }
        }
      }
      if (challenge && (challenge.id !== challengeId || challenge.phone !== phone)) {
        throw new UnauthorizedException('تحدي التحقق غير صالح لهذا الرقم.');
      }
    } else {
      challenge = this.findLatestChallengeForPhone(phone);
      challengeId = challenge?.id || null;
    }

    if (!challenge || challenge.isUsed || !challengeId) {
      throw new BadRequestException('لا يوجد طلب تحقق نشط لهذا الرقم، يرجى طلب رمز جديد');
    }

    const ttlMs = 3 * 60 * 1000;
    const challengeKey = this.challengeKey(challengeId);
    const latestKey = this.latestChallengeKey(phone);
    const attemptsKey = this.attemptsKey(challengeId);
    const usedKey = this.usedChallengeKey(challengeId);

    if (new Date() > challenge.expiresAt) {
      if (isProduction) {
        await this.redisStore.deleteValue(challengeKey);
        await this.redisStore.deleteValue(latestKey);
        await this.redisStore.deleteValue(attemptsKey);
      } else {
        this.challenges.delete(challenge.id);
      }
      throw new BadRequestException('انتهت صلاحية رمز التحقق (3 دقائق). يرجى طلب رمز جديد.');
    }

    const attempts = isProduction
      ? Number(await this.redisStore.get(attemptsKey) || 0)
      : challenge.attempts;
    if (attempts >= 3) {
      if (isProduction) {
        await this.redisStore.consumeOnce(usedKey, ttlMs);
        await this.redisStore.deleteValue(challengeKey);
        await this.redisStore.deleteValue(latestKey);
        await this.redisStore.deleteValue(attemptsKey);
      } else {
        this.challenges.delete(challenge.id);
      }
      throw new BadRequestException('تم تجاوز الحد الأقصى للمحاولات (3 محاولات فاشلة). تم إبطال التحدي لأسباب أمنية.');
    }

    const submittedHash = crypto.createHash('sha256').update(dto.code.trim()).digest('hex');
    const isCodeValid = crypto.timingSafeEqual(
      Buffer.from(submittedHash),
      Buffer.from(challenge.otpHash),
    );

    if (!isCodeValid) {
      const nextAttempts = isProduction
        ? await this.redisStore.incrementWithTtl(attemptsKey, ttlMs)
        : attempts + 1;
      if (isProduction) {
        if (nextAttempts >= 3) {
          await this.redisStore.consumeOnce(usedKey, ttlMs);
          await this.redisStore.deleteValue(challengeKey);
          await this.redisStore.deleteValue(latestKey);
          await this.redisStore.deleteValue(attemptsKey);
          throw new BadRequestException('تم تجاوز الحد الأقصى للمحاولات (3 محاولات فاشلة). تم إبطال التحدي.');
        }
      } else {
        challenge.attempts = nextAttempts;
        if (nextAttempts >= 3) {
          this.challenges.delete(challenge.id);
          throw new BadRequestException('تم تجاوز الحد الأقصى للمحاولات (3 محاولات فاشلة). تم إبطال التحدي.');
        }
      }
      throw new BadRequestException(`رمز التحقق غير صحيح. المتبقي: ${3 - nextAttempts} محاولات`);
    }

    if (isProduction) {
      const consumed = await this.redisStore.consumeOnce(usedKey, ttlMs);
      if (!consumed) {
        throw new BadRequestException('تم استخدام رمز التحقق مسبقاً؛ اطلب رمزاً جديداً.');
      }
      await this.redisStore.deleteValue(challengeKey);
      await this.redisStore.deleteValue(latestKey);
      await this.redisStore.deleteValue(attemptsKey);
    } else {
      challenge.isUsed = true;
      this.challenges.delete(challenge.id);
    }

    const verifiedAt = new Date();
    const targetUserId = callerUserId || challenge.userId;
    if (targetUserId) {
      try {
        await this.prisma.user.update({
          where: { id: targetUserId },
          data: { phoneVerifiedAt: verifiedAt },
        });
      } catch {
        if (isProduction) {
          throw new ServiceUnavailableException('تعذر حفظ حالة توثيق الهاتف في قاعدة البيانات؛ اطلب رمز تحقق جديداً بعد عودة الخدمة.');
        }
        this.logger.warn('Could not update User.phoneVerifiedAt in test/development database.');
      }
    }

    return {
      success: true,
      phone: phoneInfo.normalizedE164,
      carrier: phoneInfo.carrierAr,
      verifiedAt,
      verificationMethod: 'SMS_OTP',
      message: 'تم تأكيد ملكية رقم الهاتف بنجاح',
      disclaimer: 'تأكيد حيازة رقم الهاتف هو إجراء أمني لإثبات ملكية الشريحة ولا يُعد إثبات هوية رسمي شامل.',
    };
  }

  async getStatus(userId?: string, rawPhone?: string) {
    let user: any = null;
    if (userId) {
      try {
        user = await this.prisma.user.findUnique({ where: { id: userId } });
      } catch {
        if (process.env.NODE_ENV === 'production') {
          throw new ServiceUnavailableException('تعذر قراءة حالة توثيق الهاتف من قاعدة البيانات الدائمة.');
        }
      }
    }

    if (process.env.NODE_ENV === 'production' && userId && !user) {
      throw new ServiceUnavailableException('تعذر العثور على حساب المستخدم في قاعدة البيانات الدائمة.');
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

  private hashKeyValue(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  private rateLimitKey(kind: 'phone' | 'ip', value: string): string {
    return `phone-otp:rate:${kind}:${this.hashKeyValue(value)}`;
  }

  private challengeKey(challengeId: string): string {
    return `phone-otp:challenge:${challengeId}`;
  }

  private latestChallengeKey(phone: string): string {
    return `phone-otp:latest:${this.hashKeyValue(phone)}`;
  }

  private attemptsKey(challengeId: string): string {
    return `phone-otp:attempts:${challengeId}`;
  }

  private usedChallengeKey(challengeId: string): string {
    return `phone-otp:used:${challengeId}`;
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
