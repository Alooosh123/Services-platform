/**
 * PII sanitization for an isolated non-production MySQL database.
 * Financial records and ledger rows are immutable and never updated here.
 */
import { Prisma, PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl || !rawUrl.startsWith('mysql://')) {
    throw new Error('DATABASE_URL must target MySQL.');
  }
  const database = decodeURIComponent(new URL(rawUrl).pathname.replace(/^\//, ''));
  if (!/(staging|sandbox|test)/i.test(database) || /(prod|production|live)/i.test(database)) {
    throw new Error('Refusing sanitization: database name must identify staging, sandbox, or test and must not be production.');
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('PII sanitization is prohibited when NODE_ENV=production.');
  }
  if (process.env.CONFIRM_STAGING_SANITIZATION !== 'YES') {
    throw new Error('Set CONFIRM_STAGING_SANITIZATION=YES after confirming this is an isolated, disposable staging database.');
  }

  const users = await prisma.user.findMany({ select: { id: true, role: true } });
  const userUpdates = users.map((user) => {
    const suffix = user.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20);
    const staff = ['OWNER', 'SUPER_ADMIN', 'ADMIN', 'GENERAL_MANAGER', 'FINANCE_MANAGER', 'FINANCE', 'SUPPORT', 'AUDITOR', 'FULFILLMENT_OPERATOR'].includes(user.role);
    return prisma.user.update({
      where: { id: user.id },
      data: {
        email: `staging-${suffix}@invalid.example`,
        phone: null,
        fullName: staff ? 'Staging Staff' : `Staging Customer ${suffix}`,
        fullNameAr: 'حساب تجريبي',
        avatarUrl: null,
        passwordHash: bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 12),
        twoFactorSecret: null,
        isTwoFactorEnabled: false,
        transactionPinHash: null,
        transactionPinFailedAttempts: 0,
        transactionPinLockedUntil: null,
        verificationCode: null,
        resetPasswordToken: null,
        resetPasswordExpires: null,
        emailVerifiedAt: null,
        phoneVerifiedAt: null,
        isVerified: false,
        isActive: false,
      },
    });
  });

  await prisma.$transaction(userUpdates);
  const sessions = await prisma.session.deleteMany({});
  const devices = await prisma.userDevice.deleteMany({});

  const ledgerTotals = await prisma.ledgerEntry.groupBy({
    by: ['currency'],
    _sum: { debitAmount: true, creditAmount: true },
  });
  const imbalances: string[] = [];
  for (const row of ledgerTotals) {
    const debit = row._sum.debitAmount ?? new Prisma.Decimal(0);
    const credit = row._sum.creditAmount ?? new Prisma.Decimal(0);
    const variance = debit.minus(credit).abs();
    if (variance.greaterThan(new Prisma.Decimal('0.0001'))) {
      imbalances.push(`${row.currency}: ${variance.toString()}`);
    }
  }
  if (imbalances.length) {
    throw new Error('Ledger imbalance after sanitization: ' + imbalances.join(', '));
  }

  console.log(`Sanitized ${users.length} user records; revoked ${sessions.count} sessions and removed ${devices.count} trusted device records.`);
  console.log('Per-currency double-entry totals remain balanced. Wallet and ledger amounts were not modified.');
}

main().catch((error: unknown) => {
  console.error('Staging sanitization failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
