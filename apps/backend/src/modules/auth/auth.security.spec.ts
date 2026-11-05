import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../../database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { TotpUtil } from './utils/totp.util';
import * as bcrypt from 'bcrypt';
import { RedisIdempotencyStore } from '../../security/redis-idempotency.store';
import { EncryptionService } from '../../security/encryption.service';

describe('AuthSecurityGate (SG-01 & SG-02)', () => {
  let authService: AuthService;
  let jwtService: JwtService;

  const mockPrismaService = {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    session: {
      create: jest.fn().mockResolvedValue({ id: 'sess-1' }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    },
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockImplementation((payload) => Promise.resolve(`mock-jwt-${JSON.stringify(payload)}`)),
            verifyAsync: jest.fn().mockImplementation((token) => {
              if (token.startsWith('mock-jwt-')) {
                return Promise.resolve(JSON.parse(token.slice(9)));
              }
              if (token === 'expired-token') {
                return Promise.reject(new Error('jwt expired'));
              }
              return Promise.resolve({ sub: 'user-admin-001', purpose: 'mfa_pending', role: 'SUPER_ADMIN', jti: 'nonce-1' });
            }),
          },
        },
        {
          provide: RedisIdempotencyStore,
          useValue: {
            createRefreshSession: jest.fn().mockResolvedValue(undefined),
            getRefreshSession: jest.fn().mockResolvedValue(JSON.stringify({ userId: 'user-admin-001' })),
            revokeRefreshSession: jest.fn().mockResolvedValue(undefined),
            revokeUserRefreshSessions: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: EncryptionService,
          useValue: {
            encrypt: jest.fn((value: string) => value),
            decrypt: jest.fn((value: string) => value),
            encryptJson: jest.fn((value: unknown) => JSON.stringify(value)),
            decryptJson: jest.fn((value: string) => JSON.parse(value)),
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
  });

  describe('SG-01: Zero Password Bypass & Pure Bcrypt Verification', () => {
    it('should reject login with wrong password even if it tries legacy variants', async () => {
      // Trying wrong password on admin user
      await expect(
        authService.adminLogin({
          identifier: 'admin@digitaltopup.com',
          password: 'WrongPassword@999',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should successfully authenticate when correct password matching bcrypt hash is provided', async () => {
      const res = await authService.adminLogin({
        identifier: 'admin@digitaltopup.com',
        password: 'Admin@123456',
      });

      expect(res.requiresMfa).toBe(true);
      expect(res.tempToken).toBeDefined();
    });

    it('should revoke all active sessions for a user upon request', async () => {
      const res = await authService.revokeAllSessions('user-admin-001');
      expect(res.success).toBe(true);
      expect(mockPrismaService.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-admin-001' },
      });
    });
  });

  describe('SG-02: Authentic RFC 6238 TOTP, Anti-Replay & Rate Limiting', () => {
    it('should reject static MFA code 123456 when user has TOTP secret configured', async () => {
      const tempToken = 'mock-jwt-' + JSON.stringify({
        sub: 'user-admin-001',
        purpose: 'mfa_pending',
        role: 'SUPER_ADMIN',
        jti: 'test-nonce-fail',
      });

      // user-admin-001 has twoFactorSecret configured ('JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP')
      // Static code '123456' must be rejected
      await expect(
        authService.verifyAdminMfa({
          tempToken,
          code: '123456',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should accept valid authentic RFC 6238 TOTP code', async () => {
      const adminSecret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
      const validCode = TotpUtil.generateCode(adminSecret);

      const tempToken = 'mock-jwt-' + JSON.stringify({
        sub: 'user-admin-001',
        purpose: 'mfa_pending',
        role: 'SUPER_ADMIN',
        jti: 'test-nonce-success-1',
      });

      const res = await authService.verifyAdminMfa({
        tempToken,
        code: validCode,
      });

      expect(res.success).toBe(true);
      expect(res.tokens).toBeDefined();
    });

    it('should enforce Anti-Replay: forbid reusing the same challenge token twice', async () => {
      const adminSecret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
      const validCode = TotpUtil.generateCode(adminSecret);

      const tempToken = 'mock-jwt-' + JSON.stringify({
        sub: 'user-admin-001',
        purpose: 'mfa_pending',
        role: 'SUPER_ADMIN',
        jti: 'test-nonce-replay-target',
      });

      // First verification succeeds
      const firstResult = await authService.verifyAdminMfa({
        tempToken,
        code: validCode,
      });
      expect(firstResult.success).toBe(true);

      // Second verification using EXACT SAME challenge token MUST be rejected (Replay Attack)
      await expect(
        authService.verifyAdminMfa({
          tempToken,
          code: validCode,
        }),
      ).rejects.toThrow('Challenge Replay Blocked');
    });

    it('should lock out MFA challenge after 3 failed attempts (Brute-Force Protection)', async () => {
      const targetUser = 'user-finance-002'; // Finance officer
      const tempToken = 'mock-jwt-' + JSON.stringify({
        sub: targetUser,
        purpose: 'mfa_pending',
        role: 'FINANCE',
        jti: 'test-brute-force',
      });

      // Attempt 1: Fail
      await expect(
        authService.verifyAdminMfa({ tempToken, code: '000001' }),
      ).rejects.toThrow('رمز التحقق (TOTP) غير صحيح. المتبقي: 2 محاولات');

      // Attempt 2: Fail
      await expect(
        authService.verifyAdminMfa({ tempToken, code: '000002' }),
      ).rejects.toThrow('رمز التحقق (TOTP) غير صحيح. المتبقي: 1 محاولات');

      // Attempt 3: Fail & Lockout
      await expect(
        authService.verifyAdminMfa({ tempToken, code: '000003' }),
      ).rejects.toThrow('تم تجاوز الحد الأقصى للمحاولات (3 محاولات فاشلة)');

      // Subsequent attempt with even correct code MUST be rejected due to challenge invalidation
      const financeSecret = 'KRSXG5CTMVRXEZLUKRSXG5CTMVRXEZLU';
      const validCode = TotpUtil.generateCode(financeSecret);
      await expect(
        authService.verifyAdminMfa({ tempToken, code: validCode }),
      ).rejects.toThrow();
    });

    it('should generate valid TOTP setup secret and otpauth URI', async () => {
      const setup = await authService.setupMfa('user-admin-001');
      expect(setup.secret).toBeDefined();
      expect(setup.otpAuthUri).toContain('otpauth://totp/');
      expect(setup.otpAuthUri).toContain(setup.secret);
    });
  });
});
