import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
  NotFoundException,
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { VerifyMfaDto } from './dto/verify-mfa.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { EnableMfaDto } from './dto/enable-mfa.dto';
import { SetTransactionPinDto } from './dto/set-transaction-pin.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UserRole, CurrencyCode } from '@digital-topup/shared';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import * as argon2 from 'argon2';
import { TotpUtil } from './utils/totp.util';
import { EncryptionService } from '../../security/encryption.service';
import { RedisIdempotencyStore } from '../../security/redis-idempotency.store';
import { createHash } from 'crypto';
import { getCurrentTenantId } from '../../tenant/tenant-context.store';

interface InMemoryUser {
  id: string;
  email?: string | null;
  phone?: string | null;
  fullName: string;
  fullNameAr?: string | null;
  passwordHash: string;
  role: UserRole;
  tenantId?: string | null;
  isVerified: boolean;
  isActive: boolean;
  isTwoFactorEnabled: boolean;
  twoFactorSecret?: string | null;
  transactionPinHash?: string | null;
  transactionPinFailedAttempts?: number;
  transactionPinLockedUntil?: Date | null;
  mustChangePassword?: boolean;
  wallets: Array<{
    id: string;
    currency: CurrencyCode;
    balance: number;
    lockedBalance: number;
    isFrozen: boolean;
  }>;
}

// Initial in-memory mock users seeded for offline resilience (only loaded outside production)
const SEED_USERS: InMemoryUser[] = [
  {
    id: 'user-admin-001',
    email: 'admin@digitaltopup.com',
    phone: '+967770000001',
    fullName: 'Super Administrator',
    fullNameAr: 'المدير العام للمنصة',
    // Genuine bcrypt hash of Admin@123456 (salt rounds 10)
    passwordHash: '$2b$10$en56u0lz9W3eBhBKFBPryeqfQunFN4HWjf5RjyvgYqJFZrDyeUZnu',
    role: UserRole.SUPER_ADMIN,
    isVerified: true,
    isActive: true,
    isTwoFactorEnabled: true,
    twoFactorSecret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP', // Base32 test secret for TOTP
    wallets: [
      { id: 'w-admin-yer', currency: CurrencyCode.YER, balance: 0, lockedBalance: 0, isFrozen: false },
      { id: 'w-admin-usd', currency: CurrencyCode.USD, balance: 0, lockedBalance: 0, isFrozen: false },
      { id: 'w-admin-sar', currency: CurrencyCode.SAR, balance: 0, lockedBalance: 0, isFrozen: false },
    ],
  },
  {
    id: 'user-finance-002',
    email: 'finance@digitaltopup.com',
    phone: '+967770000002',
    fullName: 'Chief Financial Officer',
    fullNameAr: 'مدير العمليات والتدقيق المالي',
    // Genuine bcrypt hash of Finance@123456
    passwordHash: '$2b$10$z7P0sJhtwp/vdMokUxapPu/9HDxH.pff3YGJm0/KA.sPwi..L39bK',
    role: UserRole.FINANCE,
    isVerified: true,
    isActive: true,
    isTwoFactorEnabled: true,
    twoFactorSecret: 'KRSXG5CTMVRXEZLUKRSXG5CTMVRXEZLU',
    wallets: [
      { id: 'w-fin-yer', currency: CurrencyCode.YER, balance: 0, lockedBalance: 0, isFrozen: false },
      { id: 'w-fin-usd', currency: CurrencyCode.USD, balance: 0, lockedBalance: 0, isFrozen: false },
      { id: 'w-fin-sar', currency: CurrencyCode.SAR, balance: 0, lockedBalance: 0, isFrozen: false },
    ],
  },
  {
    id: 'user-customer-003',
    email: 'customer@gmail.com',
    phone: '+967770000003',
    fullName: 'Ahmed Mohammed (Test Gamer)',
    fullNameAr: 'أحمد محمد الحاشدي',
    // Genuine bcrypt hash of Customer@123456
    passwordHash: '$2b$10$BPZsjlBLkrPkwFaKrH5AiulrUBoYWUHUqb4h6BFz5TCYdsw6J0hvi',
    role: UserRole.CUSTOMER,
    isVerified: true,
    isActive: true,
    isTwoFactorEnabled: false,
    wallets: [
      { id: 'w-cust-yer', currency: CurrencyCode.YER, balance: 50000, lockedBalance: 0, isFrozen: false },
      { id: 'w-cust-usd', currency: CurrencyCode.USD, balance: 100, lockedBalance: 0, isFrozen: false },
      { id: 'w-cust-sar', currency: CurrencyCode.SAR, balance: 200, lockedBalance: 0, isFrozen: false },
    ],
  },
];

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private memoryUsers: Map<string, InMemoryUser> = new Map();

  // Track user session revocations timestamp (for revoking active JWTs)
  private revokedUsersAt = new Map<string, number>();

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private redisStore: RedisIdempotencyStore,
    private encryptionService: EncryptionService,
  ) {
    // Test fixtures only: never provision fallback identities in development,
    // staging, or production runtimes.
    if (process.env.NODE_ENV === 'test') {
      for (const u of SEED_USERS) {
        this.memoryUsers.set(u.id, u);
      }
    }
  }

  /**
   * Retrieves JWT secret with strict production validation.
   */
  private getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    const defaultPlaceholder = 'digital-topup-jwt-access-token-secret-replace-in-production-key-998877';

    if (process.env.NODE_ENV === 'production') {
      if (!secret || secret === defaultPlaceholder || secret.trim().length < 32) {
        throw new Error('FATAL: A strong JWT_SECRET (>= 32 chars) must be configured in production environment.');
      }
      return secret;
    }

    return secret || defaultPlaceholder;
  }

  /**
   * Retrieves Refresh Token secret with strict production validation.
   */
  private getJwtRefreshSecret(): string {
    const secret = process.env.JWT_REFRESH_SECRET;
    const defaultPlaceholder = 'digital-topup-jwt-refresh-token-secret-replace-in-production-key-112233';

    if (process.env.NODE_ENV === 'production') {
      if (!secret || secret === defaultPlaceholder || secret.trim().length < 32) {
        throw new Error('FATAL: A strong JWT_REFRESH_SECRET (>= 32 chars) must be configured in production environment.');
      }
      return secret;
    }

    return secret || defaultPlaceholder;
  }

  async register(dto: RegisterDto, tenantId?: string) {
    const resolvedTenantId = getCurrentTenantId();
    if (tenantId && resolvedTenantId && tenantId !== resolvedTenantId) {
      throw new ForbiddenException('Tenant registration context is invalid.');
    }
    tenantId = resolvedTenantId || tenantId;

    // Public registration always creates a customer. Ownership is assigned only
    // by the audited Super Admin tenant-owner verification workflow.
    const registrationRole = UserRole.CUSTOMER;
    if (tenantId) {
      try {
        const tenant = await this.prisma.saaSTenant.findUnique({
          where: { id: tenantId },
          select: { id: true, status: true },
        });
        if (!tenant || tenant.status !== 'ACTIVE') {
          throw new ForbiddenException('This store is not active for customer registration.');
        }
      } catch (error: any) {
        if (error instanceof ForbiddenException) throw error;
        this.logger.error(`Tenant registration lookup failed: ${error?.message || error}`);
        throw new ServiceUnavailableException('Store registration is unavailable until the tenant database can be reached.');
      }
    }
    // A null tenant context is allowed only for localhost or an explicitly
    // configured PLATFORM_HOSTS entry; unknown hosts receive the unresolved sentinel.
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Either email or phone number must be provided');
    }

    try {
      const existing = await this.prisma.user.findFirst({
        where: {
          OR: [
            dto.email ? { email: dto.email } : {},
            dto.phone ? { phone: dto.phone } : {},
          ].filter((cond) => Object.keys(cond).length > 0),
        },
      });

      if (existing) {
        throw new ConflictException('User with this email or phone already exists');
      }
    } catch (err: any) {
      if (err instanceof ConflictException) throw err;
      if (process.env.NODE_ENV !== 'test' || tenantId) {
        this.logger.error(`Registration lookup failed: ${err?.message || err}`);
        throw new ServiceUnavailableException('Registration is unavailable because the account database could not be reached.');
      }
      this.logger.warn(`Local unscoped development registration fallback: ${err?.message}`);

      for (const u of this.memoryUsers.values()) {
        if ((dto.email && u.email === dto.email) || (dto.phone && u.phone === dto.phone)) {
          throw new ConflictException('User with this email or phone already exists');
        }
      }
    }

    const passwordHash = await this.hashPassword(dto.password);
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    let createdUser: any = null;

    try {
      createdUser = await this.prisma.user.create({
        data: {
          fullName: dto.fullName,
          email: dto.email || null,
          phone: dto.phone || null,
          passwordHash,
          role: registrationRole,
          tenantId: tenantId || null,
          verificationCode,
          isVerified: false,
          wallets: {
            create: [
              { currency: CurrencyCode.YER, balance: 0, lockedBalance: 0 },
              { currency: CurrencyCode.USD, balance: 0, lockedBalance: 0 },
              { currency: CurrencyCode.SAR, balance: 0, lockedBalance: 0 },
            ],
          },
        },
        include: { wallets: true },
      });
    } catch (err: any) {
      if (process.env.NODE_ENV !== 'test' || tenantId) {
        this.logger.error(`Persistent account creation failed: ${err?.message || err}`);
        throw new ServiceUnavailableException('Account registration failed because the account database is unavailable.');
      }
      this.logger.warn(`Local unscoped development account fallback: ${err?.message}`);

      const newId = `user-cust-${Date.now()}`;
      const memoryUser: InMemoryUser = {
        id: newId,
        fullName: dto.fullName,
        email: dto.email || null,
        phone: dto.phone || null,
        passwordHash,
        role: UserRole.CUSTOMER,
        isVerified: false,
        isActive: true,
        isTwoFactorEnabled: false,
        wallets: [
          { id: `w-${newId}-yer`, currency: CurrencyCode.YER, balance: 0, lockedBalance: 0, isFrozen: false },
          { id: `w-${newId}-usd`, currency: CurrencyCode.USD, balance: 0, lockedBalance: 0, isFrozen: false },
          { id: `w-${newId}-sar`, currency: CurrencyCode.SAR, balance: 0, lockedBalance: 0, isFrozen: false },
        ],
      };

      this.memoryUsers.set(newId, memoryUser);
      createdUser = memoryUser;
    }

    const tokens = await this.generateTokens(
      createdUser.id,
      createdUser.email || createdUser.phone || createdUser.id,
      createdUser.role,
    );

    return {
      message: 'Registration successful',
      user: {
        id: createdUser.id,
        fullName: createdUser.fullName,
        email: createdUser.email,
        phone: createdUser.phone,
        role: createdUser.role,
        tenantId: createdUser.tenantId || null,
        isVerified: createdUser.isVerified,
        wallets: createdUser.wallets,
      },
      tokens,
    };
  }

  async login(dto: LoginDto) {
    let user: any = null;

    try {
      user = await this.prisma.user.findFirst({
        where: {
          OR: [{ email: dto.identifier }, { phone: dto.identifier }],
        },
        include: { wallets: true },
      });
    } catch (err: any) {
      if (process.env.NODE_ENV !== 'test' || getCurrentTenantId()) {
        this.logger.error(`Login database lookup failed: ${err?.message || err}`);
        throw new ServiceUnavailableException('Login is unavailable because the account database could not be reached.');
      }
      this.logger.warn(`Local unscoped development login fallback (${err?.message})`);
    }

    if (!user && !getCurrentTenantId() && process.env.NODE_ENV === 'test') {
      for (const u of this.memoryUsers.values()) {
        if (u.email === dto.identifier || u.phone === dto.identifier) {
          user = u;
          break;
        }
      }
    }

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await this.verifyAndUpgradePassword(user, dto.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Your account has been deactivated');
    }

    const tokens = await this.generateTokens(user.id, user.email || user.phone || user.id, user.role);

    return {
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        wallets: user.wallets,
      },
      tokens,
    };
  }

  /**
   * Dedicated Admin Login endpoint
   * Validates staff/admin credentials and initiates MFA verification flow
   */
  async adminLogin(dto: AdminLoginDto) {
    let user: any = null;

    try {
      user = await this.prisma.user.findFirst({
        where: {
          OR: [{ email: dto.identifier }, { phone: dto.identifier }],
        },
        include: { wallets: true },
      });
    } catch (err: any) {
      if (process.env.NODE_ENV !== 'test' || getCurrentTenantId()) {
        this.logger.error(`Admin login database lookup failed: ${err?.message || err}`);
        throw new ServiceUnavailableException('Administrative login is unavailable because the account database could not be reached.');
      }
      this.logger.warn(`Local unscoped development admin login fallback (${err?.message})`);
    }

    if (!user && !getCurrentTenantId() && process.env.NODE_ENV === 'test') {
      for (const u of this.memoryUsers.values()) {
        if (u.email === dto.identifier || u.phone === dto.identifier) {
          user = u;
          break;
        }
      }
    }

    if (!user) {
      throw new UnauthorizedException('بيانات الدخول الإدارية غير صحيحة');
    }

    const passwordValid = await this.verifyAndUpgradePassword(user, dto.password);
    if (!passwordValid) {
      throw new UnauthorizedException('بيانات الدخول الإدارية غير صحيحة');
    }

    // Strictly forbid CUSTOMER accounts from logging in as staff/admin
    const staffRoles = [
      UserRole.ADMIN,
      UserRole.FINANCE,
      UserRole.SUPER_ADMIN,
      UserRole.OWNER,
      UserRole.FINANCE_MANAGER,
      UserRole.GENERAL_MANAGER,
      UserRole.AUDITOR,
      UserRole.SUPPORT,
    ];

    if (!staffRoles.includes(user.role)) {
      throw new ForbiddenException('حسابات العملاء غير مصرح لها بالدخول إلى لوحة التحكم الإدارية');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('تم تعطيل هذا الحساب الإداري من قبل الإدارة العليا');
    }

    // Generate short-lived unique MFA pending token with nonce (jti)
    const challengeNonce = uuidv4();
    const tempToken = await this.jwtService.signAsync(
      { sub: user.id, purpose: 'mfa_pending', role: user.role, jti: challengeNonce },
      {
        secret: this.getJwtSecret(),
        expiresIn: '5m',
      },
    );

    return {
      requiresMfa: true,
      tempToken,
      userRole: user.role,
      message: 'يرجى إدخال رمز التحقق بخطوتين (MFA) لتسجيل الدخول إلى لوحة الإدارة',
    };
  }

  private getMfaChallengeRedisKey(tempToken: string): string {
    const digest = createHash('sha256').update(tempToken).digest('hex');
    return `auth:mfa:challenge-used:${digest}`;
  }

  private async assertMfaChallengeNotUsed(tempToken: string): Promise<void> {
    const used = await this.redisStore.get(this.getMfaChallengeRedisKey(tempToken));
    if (used) {
      throw new UnauthorizedException(
        'تم استخدام رمز التحدي مسبقاً (Challenge Replay Blocked). يرجى تسجيل الدخول مجدداً.',
      );
    }
  }

  private async consumeMfaChallenge(tempToken: string, userId: string): Promise<void> {
    const consumed = await this.redisStore.acquire(
      this.getMfaChallengeRedisKey(tempToken),
      JSON.stringify({ userId, consumedAt: new Date().toISOString() }),
      5 * 60 * 1000,
    );
    if (!consumed) {
      throw new UnauthorizedException(
        'تم استخدام رمز التحدي مسبقاً (Challenge Replay Blocked). يرجى تسجيل الدخول مجدداً.',
      );
    }
  }

  private async recordMfaChallengeFailure(tempToken: string, userId: string): Promise<number> {
    const digest = createHash('sha256').update(tempToken).digest('hex');
    const { count } = await this.redisStore.incrementRateLimit(
      `auth:mfa:challenge-attempts:${digest}`,
      5 * 60 * 1000,
    );
    if (count >= 3) {
      await this.consumeMfaChallenge(tempToken, userId);
      throw new UnauthorizedException(
        'تم تجاوز الحد الأقصى للمحاولات (3 محاولات فاشلة). تم إبطال التحدي لأسباب أمنية.',
      );
    }
    return 3 - count;
  }

  /**
   * Completes Admin MFA verification using authentic RFC 6238 TOTP with anti-replay and rate limiting.
   */
  async verifyAdminMfa(dto: VerifyMfaDto) {
    if (!dto.tempToken) {
      throw new BadRequestException('رمز الجلسة المؤقت (tempToken) مطلوب');
    }

    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(dto.tempToken, {
        secret: this.getJwtSecret(),
      });
    } catch {
      throw new UnauthorizedException('انتهت صلاحية رمز الجلسة المؤقت، يرجى تسجيل الدخول مجدداً');
    }

    if (payload.purpose !== 'mfa_pending') {
      throw new UnauthorizedException('رمز التحقق غير صالح لعملية التوثيق الثنائي');
    }

    // Redis is the shared anti-replay source for all backend instances.
    await this.assertMfaChallengeNotUsed(dto.tempToken);

    if (!dto.code || dto.code.trim().length !== 6) {
      throw new BadRequestException('يجب أن يتكون رمز التحقق من 6 أرقام');
    }

    const userId = payload.sub;
    const user = await this.findUserById(userId);
    if (!user) {
      throw new UnauthorizedException('المستخدم غير موجود');
    }

    const allowTestMfaBypass =
      process.env.NODE_ENV === 'test' && process.env.DISABLE_MFA_BYPASS !== 'true';
    let isTotpValid = false;

    // Check TOTP if user has a configured secret
    const totpSecret = this.decryptStoredSecret(user.twoFactorSecret);
    if (totpSecret) {
      isTotpValid = TotpUtil.verifyCode(dto.code, totpSecret);
    } else {
      // Real environments must always have a configured TOTP secret.
      if (!allowTestMfaBypass) {
        throw new ForbiddenException('لم يتم إعداد المصادقة الثنائية (MFA) لهذا الحساب بعد. يرجى التواصل مع الإدارة العليا.');
      }

      // A fixed test code is available only to isolated automated test fixtures.
      if (allowTestMfaBypass && dto.code === '123456') {
        isTotpValid = true;
      }
    }

    if (!isTotpValid) {
      const remainingAttempts = await this.recordMfaChallengeFailure(dto.tempToken, userId);
      throw new UnauthorizedException(`رمز التحقق (TOTP) غير صحيح. المتبقي: ${remainingAttempts} محاولات`);
    }

    // Atomically consume the challenge before issuing tokens. If another
    // backend instance already used it, Redis rejects this request.
    await this.consumeMfaChallenge(dto.tempToken, userId);

    const tokens = await this.generateTokens(user.id, user.email || user.phone || user.id, user.role);

    return {
      success: true,
      message: 'تم التحقق بنجاح والدخول للوحة التحكم',
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
      tokens,
    };
  }

  /**
   * Generates a new TOTP secret and setup URI for authenticator app configuration
   */
  async setupMfa(userId: string) {
    const user = await this.findUserById(userId);
    if (!user) {
      throw new UnauthorizedException('المستخدم غير موجود');
    }

    const secret = TotpUtil.generateSecret();
    const otpAuthUri = TotpUtil.generateOtpAuthUri(
      user.email || user.phone || user.id,
      'YemenTopUp Platform',
      secret,
    );

    return {
      secret,
      otpAuthUri,
      message: 'قم بمسح الرابط أو إدخال المفتاح في تطبيق المصادقة (Google Authenticator / Authy)',
    };
  }

  /**
   * Verifies initial TOTP code and activates MFA for user account
   */
  async enableMfa(userId: string, dto: EnableMfaDto) {
    const user = await this.findUserById(userId);
    if (!user) {
      throw new UnauthorizedException('المستخدم غير موجود');
    }

    const isValid = TotpUtil.verifyCode(dto.code, dto.secret);
    if (!isValid) {
      throw new BadRequestException('رمز التحقق غير صحيح، تعذر تفعيل المصادقة الثنائية');
    }

    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          twoFactorSecret: this.encryptionService.encrypt(dto.secret),
          isTwoFactorEnabled: true,
        },
      });
    } catch (error: any) {
      if (process.env.NODE_ENV !== 'test') {
        this.logger.error(`MFA activation could not be persisted for user ${userId}: ${error?.message || error}`);
        throw new ServiceUnavailableException('MFA activation could not be saved to the account database.');
      }
      const memUser = this.memoryUsers.get(userId);
      if (!memUser) throw new NotFoundException('Test account fixture was not found.');
      memUser.twoFactorSecret = dto.secret;
      memUser.isTwoFactorEnabled = true;
    }

    return {
      success: true,
      message: 'تم تفعيل المصادقة الثنائية (TOTP) بنجاح وحماية الحساب',
    };
  }

  /**
   * Revoke all active sessions and refresh tokens for an account (SG-01)
   */
  async revokeAllSessions(userId: string) {
    try {
      await this.redisStore.revokeUserRefreshSessions(userId);
      await this.prisma.session.deleteMany({
        where: { userId },
      });
    } catch (error) {
      this.logger.error(`Unable to revoke sessions for user ${userId}.`);
      throw error;
    }

    this.revokedUsersAt.set(userId, Date.now());

    return {
      success: true,
      message: 'تم إبطال كافة الجلسات النشطة ورموز التحديث بنجاح',
    };
  }

  /**
   * Create staff member (SUPER_ADMIN or OWNER role required)
   */
  async createStaff(callerUserId: string, dto: CreateStaffDto) {
    const caller = await this.findUserById(callerUserId);
    if (!caller || (caller.role !== UserRole.SUPER_ADMIN && caller.role !== UserRole.OWNER)) {
      throw new ForbiddenException('فقط المدير العام أو مالك المتجر يستطيع إنشاء حسابات ضمن نطاق صلاحياته');
    }

    if (caller.role === UserRole.OWNER) {
      const tenantStaffRoles = [
        UserRole.GENERAL_MANAGER,
        UserRole.FINANCE_MANAGER,
        UserRole.SUPPORT,
        UserRole.FULFILLMENT_OPERATOR,
        UserRole.AUDITOR,
      ];
      if (!caller.tenantId || !tenantStaffRoles.includes(dto.role)) {
        throw new ForbiddenException('مالك المتجر لا يستطيع إنشاء حسابات منصة أو منح صلاحية مالك/مدير منصة.');
      }
    }

    const passwordHash = await this.hashPassword(dto.password);
    const initialSecret = TotpUtil.generateSecret();
    const initialPasswordHash = await this.hashPassword(dto.password);

    try {
      const created = await this.prisma.user.create({
        data: {
          fullName: dto.fullName,
          email: dto.email || null,
          phone: dto.phone || null,
          passwordHash,
          role: dto.role,
          tenantId: caller.tenantId || null,
          isVerified: true,
          emailVerifiedAt: new Date(),
          phoneVerifiedAt: new Date(),
          isTwoFactorEnabled: true,
          twoFactorSecret: this.encryptionService.encrypt(initialSecret),
        },
      });

      return {
        id: created.id,
        fullName: created.fullName,
        email: created.email,
        phone: created.phone,
        role: created.role,
        twoFactorSecret: initialSecret,
        createdAt: created.createdAt,
      };
    } catch (err: any) {
      if (process.env.NODE_ENV !== 'test' || caller.tenantId) {
        this.logger.error(`Staff account persistence failed: ${err?.message || err}`);
        throw new ServiceUnavailableException('Staff account creation is unavailable because the account database could not be reached.');
      }
      this.logger.warn(`Local unscoped development staff fallback (${err?.message})`);

      const newId = `user-staff-${Date.now()}`;
      const memoryStaff: InMemoryUser = {
        id: newId,
        fullName: dto.fullName,
        email: dto.email || null,
        phone: dto.phone || null,
        passwordHash,
        role: dto.role,
        isVerified: true,
        isActive: true,
        isTwoFactorEnabled: true,
        twoFactorSecret: this.encryptionService.encrypt(initialSecret),
        wallets: [],
      };
      this.memoryUsers.set(newId, memoryStaff);

      return {
        id: memoryStaff.id,
        fullName: memoryStaff.fullName,
        email: memoryStaff.email,
        phone: memoryStaff.phone,
        role: memoryStaff.role,
        twoFactorSecret: initialSecret,
        createdAt: new Date(),
      };
    }
  }

  async logout(userId: string) {
    await this.redisStore.revokeUserRefreshSessions(userId);
    await this.prisma.session.deleteMany({ where: { userId } });
    return { success: true, message: 'تم تسجيل الخروج وإلغاء الجلسة بنجاح' };
  }

  async refreshSession(dto: RefreshTokenDto) {
    let payload: { sub: string; identifier: string; role: string };
    try {
      payload = await this.jwtService.verifyAsync(dto.refreshToken, {
        secret: this.getJwtRefreshSecret(),
      });
    } catch {
      throw new UnauthorizedException('Refresh token is invalid or expired.');
    }

    if (!payload.sub || !payload.identifier || !payload.role) {
      throw new UnauthorizedException('Refresh token payload is invalid.');
    }

    const oldTokenHash = createHash('sha256').update(dto.refreshToken).digest('hex');
    if (!(await this.redisStore.getRefreshSession(oldTokenHash))) {
      throw new UnauthorizedException('Refresh session has been revoked or expired.');
    }

    const user = await this.findUserById(payload.sub);
    if (!user || user.isActive === false || user.role !== payload.role) {
      await this.redisStore.revokeUserRefreshSessions(payload.sub);
      throw new UnauthorizedException('Account is inactive or no longer authorized.');
    }

    await this.redisStore.revokeRefreshSession(payload.sub, oldTokenHash);
    try {
      await this.prisma.session.deleteMany({ where: { refreshToken: oldTokenHash } });
    } catch (error) {
      this.logger.warn(`Unable to delete rotated refresh session metadata: ${error instanceof Error ? error.message : 'database unavailable'}`);
    }
    return this.generateTokens(payload.sub, payload.identifier, payload.role);
  }

  async setTransactionPin(userId: string, dto: SetTransactionPinDto) {
    const user = await this.findUserById(userId);
    if (!user || !(await this.verifyPassword(dto.currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('Current password is incorrect.');
    }

    const transactionPinHash = await this.hashPassword(dto.pin);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        transactionPinHash,
        transactionPinFailedAttempts: 0,
        transactionPinLockedUntil: null,
      },
    });
    return { success: true, message: 'تم إعداد رمز العمليات المالية بنجاح.' };
  }

  async verifyTransactionPin(userId: string, pin: string): Promise<void> {
    const user = await this.findUserById(userId);
    if (!user || !user.transactionPinHash) {
      throw new ForbiddenException('يجب إعداد رمز العمليات المالية قبل إتمام هذه العملية.');
    }
    if (user.transactionPinLockedUntil && new Date(user.transactionPinLockedUntil) > new Date()) {
      throw new HttpException('تم قفل رمز العمليات مؤقتاً لمدة 15 دقيقة بعد محاولات خاطئة.', HttpStatus.TOO_MANY_REQUESTS);
    }

    if (await this.verifyPassword(pin, user.transactionPinHash)) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { transactionPinFailedAttempts: 0, transactionPinLockedUntil: null },
      });
      return;
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { transactionPinFailedAttempts: { increment: 1 } },
    });
    const updated = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { transactionPinFailedAttempts: true },
    });
    if ((updated?.transactionPinFailedAttempts ?? 0) >= 5) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { transactionPinLockedUntil: new Date(Date.now() + 15 * 60 * 1000) },
      });
      throw new HttpException('تم قفل رمز العمليات لمدة 15 دقيقة بعد 5 محاولات خاطئة.', HttpStatus.TOO_MANY_REQUESTS);
    }
    throw new UnauthorizedException('رمز العمليات المالية غير صحيح.');
  }

  async getProfile(userId: string) {
    const user = await this.findUserById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    const {
      passwordHash,
      twoFactorSecret,
      transactionPinHash,
      transactionPinFailedAttempts,
      transactionPinLockedUntil,
      ...safeUser
    } = user;
    return safeUser;
  }

  async findUserById(userId: string): Promise<any> {
    try {
      const dbUser = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { wallets: true },
      });
      if (dbUser) return dbUser;
      if (process.env.NODE_ENV !== 'test' || getCurrentTenantId()) return null;
    } catch (error: any) {
      if (process.env.NODE_ENV !== 'test' || getCurrentTenantId()) {
        this.logger.error(`Persistent user lookup failed: ${error?.message || error}`);
        throw new ServiceUnavailableException('The authenticated account database is unavailable.');
      }
    }

    return this.memoryUsers.get(userId) || null;
  }

  /**
   * Strictly verifies password using bcrypt. Zero hardcoded bypasses.
   */
  private async verifyPassword(plain: string, hash: string): Promise<boolean> {
    try {
      if (hash.startsWith('$argon2')) {
        return await argon2.verify(hash, plain);
      }
      return await bcrypt.compare(plain, hash);
    } catch {
      return false;
    }
  }

  private async hashPassword(plain: string): Promise<string> {
    return argon2.hash(plain, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
  }

  private async verifyAndUpgradePassword(user: any, plain: string): Promise<boolean> {
    const valid = await this.verifyPassword(plain, user.passwordHash);
    if (!valid || String(user.passwordHash).startsWith('$argon2')) {
      return valid;
    }

    const upgradedHash = await this.hashPassword(plain);
    if (this.memoryUsers.has(user.id)) {
      this.memoryUsers.get(user.id)!.passwordHash = upgradedHash;
    }
    try {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: upgradedHash },
      });
    } catch (error) {
      this.logger.warn(`Password hash upgrade deferred for user ${user.id}: ${error instanceof Error ? error.message : 'database unavailable'}`);
    }
    user.passwordHash = upgradedHash;
    return true;
  }

  private decryptStoredSecret(secret?: string | null): string | null {
    if (!secret) {
      return null;
    }
    return secret.startsWith('v1:') ? this.encryptionService.decrypt(secret) : secret;
  }

  async generateTokens(userId: string, identifier: string, role: string) {
    const payload = { sub: userId, identifier, role };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.getJwtSecret(),
      expiresIn: '15m',
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.getJwtRefreshSecret(),
      expiresIn: '7d',
    });
    const refreshTokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const refreshTtlMs = 7 * 24 * 60 * 60 * 1000;
    await this.redisStore.createRefreshSession(
      userId,
      refreshTokenHash,
      JSON.stringify({ userId, identifier, role }),
      refreshTtlMs,
    );

    try {
      await this.prisma.session.create({
        data: {
          userId,
          refreshToken: refreshTokenHash,
          expiresAt: new Date(Date.now() + refreshTtlMs),
        },
      });
    } catch (error) {
      this.logger.warn(`Unable to persist refresh session metadata for user ${userId}: ${error instanceof Error ? error.message : 'database unavailable'}`);
    }

    return {
      accessToken,
      refreshToken,
      expiresIn: 900,
    };
  }
}
