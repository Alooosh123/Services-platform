import { Test, TestingModule } from '@nestjs/testing';
import { PhoneVerificationService } from './phone-verification.service';
import { PhoneNormalizer } from './utils/phone-normalizer.util';
import { SandboxSmsAdapter } from './adapters/sandbox-sms.adapter';
import { ProductionSmsAdapter } from './adapters/production-sms.adapter';
import { PrismaService } from '../../database/prisma.service';
import { RedisIdempotencyStore } from '../../security/redis-idempotency.store';
import { BadRequestException } from '@nestjs/common';

describe('PhoneVerificationModule (Phase 4 - Module 01)', () => {
  let service: PhoneVerificationService;
  let sandboxAdapter: SandboxSmsAdapter;

  const mockPrisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({ id: 'u-1', phone: '+967770123456', phoneVerifiedAt: null }),
      update: jest.fn().mockResolvedValue({ id: 'u-1', phoneVerifiedAt: new Date() }),
    },
  };

  const redisValues = new Map<string, string>();
  const mockRedisStore = {
    get: jest.fn(async (key: string) => redisValues.get(key) ?? null),
    setValue: jest.fn(async (key: string, value: string) => { redisValues.set(key, value); }),
    deleteValue: jest.fn(async (key: string) => { redisValues.delete(key); }),
    consumeOnce: jest.fn(async (key: string) => {
      if (redisValues.has(key)) return false;
      redisValues.set(key, '1');
      return true;
    }),
    incrementWithTtl: jest.fn(async (key: string) => {
      const next = Number(redisValues.get(key) || 0) + 1;
      redisValues.set(key, String(next));
      return next;
    }),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PhoneVerificationService,
        SandboxSmsAdapter,
        ProductionSmsAdapter,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: RedisIdempotencyStore,
          useValue: mockRedisStore,
        },
      ],
    }).compile();

    service = module.get<PhoneVerificationService>(PhoneVerificationService);
    sandboxAdapter = module.get<SandboxSmsAdapter>(SandboxSmsAdapter);
  });

  describe('Production shared challenge store', () => {
    it('persists OTP in Redis, shares attempts, and consumes a successful challenge exactly once', async () => {
      const previousNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      redisValues.clear();
      const deliveredCodes: string[] = [];
      service.setSmsAdapter({
        providerCode: 'TEST_CERTIFIED_SMS',
        sendVerificationSms: async (_phone: string, code: string) => {
          deliveredCodes.push(code);
          return { success: true, simulated: false, messageId: 'provider-msg-001' };
        },
      } as any);
      try {
        const sent = await service.sendOtp({ phone: '770123456' }, 'u-1', '192.0.2.10');
        expect(sent.success).toBe(true);
        expect(sent.devSandboxOtp).toBeUndefined();
        expect(mockRedisStore.setValue).toHaveBeenCalledTimes(2);

        const verified = await service.verifyOtp({ phone: '770123456', code: deliveredCodes[0] }, 'u-1');
        expect(verified.success).toBe(true);
        expect(mockPrisma.user.update).toHaveBeenCalled();
        await expect(service.verifyOtp({ phone: '770123456', code: deliveredCodes[0] }, 'u-1'))
          .rejects.toThrow('لا يوجد طلب تحقق نشط لهذا الرقم');
      } finally {
        service.setSmsAdapter(sandboxAdapter);
        if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = previousNodeEnv;
      }
    });

    it('never reports production SMS delivery success before the provider adapter does', async () => {
      const previousNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      service.setSmsAdapter({
        providerCode: 'TEST_SMS_FAIL',
        sendVerificationSms: async (_phone: string, _code: string) => {
          throw new Error('SMS gateway is not available');
        },
      } as any);
      const previousSetCalls = mockRedisStore.setValue.mock.calls.length;
      try {
        await expect(service.sendOtp({ phone: '770123456' }, 'u-1', '192.0.2.11'))
          .rejects.toThrow('SMS gateway is not available');
        expect(mockRedisStore.setValue).toHaveBeenCalledTimes(previousSetCalls);
      } finally {
        service.setSmsAdapter(sandboxAdapter);
        if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = previousNodeEnv;
      }
    });
  });

  describe('Yemeni Phone Normalization (E.164)', () => {
    it('should normalize local 9-digit Yemen Mobile number (770123456)', () => {
      const res = PhoneNormalizer.normalizeYemeniPhone('770123456');
      expect(res.normalizedE164).toBe('+967770123456');
      expect(res.carrier).toBe('Yemen Mobile');
      expect(res.carrierAr).toContain('يمن موبايل');
    });

    it('should normalize local number with leading zero (0733987654)', () => {
      const res = PhoneNormalizer.normalizeYemeniPhone('0733987654');
      expect(res.normalizedE164).toBe('+967733987654');
      expect(res.carrier).toBe('YOU Telecom (MTN)');
    });

    it('should normalize international format (+967711223344) and Sabafon carrier', () => {
      const res = PhoneNormalizer.normalizeYemeniPhone('+967711223344');
      expect(res.normalizedE164).toBe('+967711223344');
      expect(res.carrier).toBe('Sabafon');
    });

    it('should reject invalid non-Yemeni prefixes or wrong length', () => {
      expect(() => PhoneNormalizer.normalizeYemeniPhone('12345')).toThrow(BadRequestException);
      expect(() => PhoneNormalizer.normalizeYemeniPhone('790123456')).toThrow('بادئة الرقم (79) غير معتمدة');
      expect(() => PhoneNormalizer.normalizeYemeniPhone('')).toThrow(BadRequestException);
    });
  });

  describe('OTP Lifecycle, Rate Limiting & Anti-Pumping', () => {
    const testPhone = '771999888';

    it('should send OTP via sandbox adapter with simulated delivery and 3 min TTL', async () => {
      const res = await service.sendOtp({ phone: testPhone }, 'user-cust-1', '127.0.0.1');
      expect(res.success).toBe(true);
      expect(res.phone).toBe('+967771999888');
      expect(res.expiresInSeconds).toBe(180);
      expect(res.simulated).toBe(true);

      const code = sandboxAdapter.getLastCodeForPhone('+967771999888');
      expect(code).toBeDefined();
      expect(code?.length).toBe(6);
    });

    it('should successfully verify valid OTP and mark phone as verified', async () => {
      const code = sandboxAdapter.getLastCodeForPhone('+967771999888')!;
      const verifyRes = await service.verifyOtp({ phone: testPhone, code }, 'user-cust-1');

      expect(verifyRes.success).toBe(true);
      expect(verifyRes.phone).toBe('+967771999888');
      expect(verifyRes.verificationMethod).toBe('SMS_OTP');
      expect(verifyRes.disclaimer).toContain('لا يُعد إثبات هوية رسمي شامل');
    });

    it('should enforce Single-Use: forbid verifying the same OTP challenge twice (Anti-Replay)', async () => {
      const code = sandboxAdapter.getLastCodeForPhone('+967771999888')!;
      await expect(
        service.verifyOtp({ phone: testPhone, code }, 'user-cust-1'),
      ).rejects.toThrow('لا يوجد طلب تحقق نشط لهذا الرقم');
    });

    it('should enforce Brute-Force lockout after 3 failed verification attempts', async () => {
      const phoneBrute = '772111222';
      await service.sendOtp({ phone: phoneBrute }, 'user-cust-2', '127.0.0.2');

      // Attempt 1: Fail
      await expect(
        service.verifyOtp({ phone: phoneBrute, code: '000001' }),
      ).rejects.toThrow('رمز التحقق غير صحيح. المتبقي: 2 محاولات');

      // Attempt 2: Fail
      await expect(
        service.verifyOtp({ phone: phoneBrute, code: '000002' }),
      ).rejects.toThrow('رمز التحقق غير صحيح. المتبقي: 1 محاولات');

      // Attempt 3: Fail & Lockout
      await expect(
        service.verifyOtp({ phone: phoneBrute, code: '000003' }),
      ).rejects.toThrow('تم تجاوز الحد الأقصى للمحاولات (3 محاولات فاشلة). تم إبطال التحدي.');

      // Any further attempt even with real code is destroyed
      const realCode = sandboxAdapter.getLastCodeForPhone('+967772111222')!;
      await expect(
        service.verifyOtp({ phone: phoneBrute, code: realCode }),
      ).rejects.toThrow('لا يوجد طلب تحقق نشط لهذا الرقم');
    });

    it('should enforce Phone Rate Limit (Max 3 OTP requests in 15 minutes)', async () => {
      const floodPhone = '775555444';
      // Request 1
      await service.sendOtp({ phone: floodPhone }, 'u-flood', '127.0.0.1');
      // Request 2
      await service.sendOtp({ phone: floodPhone }, 'u-flood', '127.0.0.1');
      // Request 3
      await service.sendOtp({ phone: floodPhone }, 'u-flood', '127.0.0.1');

      // Request 4 MUST be blocked
      await expect(
        service.sendOtp({ phone: floodPhone }, 'u-flood', '127.0.0.1'),
      ).rejects.toThrow('تم تجاوز الحد الأقصى لطلب رموز التحقق لهذا الرقم');
    });
  });
});
