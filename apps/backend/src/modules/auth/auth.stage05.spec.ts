import * as argon2 from 'argon2';
import { HttpException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service';
import { EncryptionService } from '../../security/encryption.service';
import { RedisIdempotencyStore } from '../../security/redis-idempotency.store';
import { AuthService } from './auth.service';
import { TotpUtil } from './utils/totp.util';

describe('Stage 05 authentication controls', () => {
  const originalEncryptionKey = process.env.ENCRYPTION_KEY;
  let attempts: number;
  let user: any;
  let prisma: any;
  let redis: any;
  let auth: AuthService;

  beforeEach(async () => {
    process.env.ENCRYPTION_KEY = 'c'.repeat(64);
    attempts = 0;
    user = {
      id: 'user-pin-test',
      email: 'pin-test@example.com',
      phone: null,
      role: 'CUSTOMER',
      isActive: true,
      passwordHash: await argon2.hash('current-password'),
      transactionPinHash: await argon2.hash('482615'),
      transactionPinFailedAttempts: 0,
      transactionPinLockedUntil: null,
      wallets: [],
    };
    prisma = {
      user: {
        findUnique: jest.fn(({ select }: any) => {
          if (select?.transactionPinFailedAttempts) {
            return Promise.resolve({ transactionPinFailedAttempts: attempts });
          }
          return Promise.resolve(user);
        }),
        update: jest.fn(({ data }: any) => {
          if (data.transactionPinFailedAttempts?.increment) {
            attempts += data.transactionPinFailedAttempts.increment;
          }
          if (data.transactionPinFailedAttempts === 0) {
            attempts = 0;
          }
          Object.assign(user, data);
          return Promise.resolve(user);
        }),
      },
      session: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    redis = {
      createRefreshSession: jest.fn().mockResolvedValue(undefined),
      getRefreshSession: jest.fn().mockResolvedValue(JSON.stringify({ userId: user.id })),
      revokeRefreshSession: jest.fn().mockResolvedValue(undefined),
      revokeUserRefreshSessions: jest.fn().mockResolvedValue(undefined),
    };
    const jwt = {
      signAsync: jest.fn().mockResolvedValueOnce('access-token').mockResolvedValueOnce('refresh-token'),
      verifyAsync: jest.fn().mockResolvedValue({
        sub: user.id,
        identifier: user.email,
        role: user.role,
      }),
    };
    auth = new AuthService(
      prisma as PrismaService,
      jwt as unknown as JwtService,
      redis as RedisIdempotencyStore,
      new EncryptionService(),
    );
  });

  afterAll(() => {
    if (originalEncryptionKey === undefined) {
      delete process.env.ENCRYPTION_KEY;
    } else {
      process.env.ENCRYPTION_KEY = originalEncryptionKey;
    }
  });

  it('stores TOTP secrets encrypted after successful enrollment', async () => {
    const secret = TotpUtil.generateSecret();
    await auth.enableMfa(user.id, {
      secret,
      code: TotpUtil.generateCode(secret),
    });

    expect(user.twoFactorSecret).not.toBe(secret);
    expect(user.twoFactorSecret).toMatch(/^v1:/);
    expect(new EncryptionService().decrypt(user.twoFactorSecret)).toBe(secret);
  });

  it('sets the transaction PIN only after confirming the current password', async () => {
    await auth.setTransactionPin(user.id, {
      currentPassword: 'current-password',
      pin: '123456',
    } as any);

    expect(user.transactionPinHash).not.toBe('123456');
    expect(await argon2.verify(user.transactionPinHash, '123456')).toBe(true);
  });

  it('locks financial PIN verification after five failures for fifteen minutes', async () => {
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await expect(auth.verifyTransactionPin(user.id, '000000')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    }
    let lockError: unknown;
    try {
      await auth.verifyTransactionPin(user.id, '000000');
    } catch (error) {
      lockError = error;
    }
    expect(lockError).toBeInstanceOf(HttpException);
    if (!(lockError instanceof HttpException)) {
      throw new Error('Expected the fifth invalid PIN attempt to trigger a rate limit.');
    }
    expect(lockError.getStatus()).toBe(429);
    expect(user.transactionPinLockedUntil.getTime()).toBeGreaterThan(Date.now() + 14 * 60 * 1000);
    await expect(auth.verifyTransactionPin(user.id, '482615')).rejects.toBeInstanceOf(HttpException);
  }, 15000);

  it('rotates refresh tokens and refuses tokens that no longer exist in Redis', async () => {
    const tokens = await auth.refreshSession({ refreshToken: 'old-refresh-token' } as any);
    expect(tokens.accessToken).toBe('access-token');
    expect(tokens.refreshToken).toBe('refresh-token');
    expect(redis.revokeRefreshSession).toHaveBeenCalledWith(
      user.id,
      expect.stringMatching(/^[a-f0-9]{64}$/),
    );
    expect(redis.createRefreshSession).toHaveBeenCalledTimes(1);

    redis.getRefreshSession.mockResolvedValueOnce(null);
    await expect(auth.refreshSession({ refreshToken: 'revoked-token' } as any)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
