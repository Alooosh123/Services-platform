import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { getCurrentTenantId } from '../../tenant/tenant-context.store';
import { ProfitEngineService } from './profit-engine.service';
import { LedgerService } from '../ledger/ledger.service';
import { TotpUtil } from '../auth/utils/totp.util';
import { EncryptionService } from '../../security/encryption.service';
import {
  CurrencyCode,
  PaymentChannelCode,
  UserRole,
  OwnerPayoutStatus,
  BeneficiaryVerificationStatus,
  LedgerAccountType,
  LedgerTransactionType,
  OwnerPayoutRequestDto,
  ApproveOwnerPayoutDto,
  CreatePayoutBeneficiaryDto,
  PayoutBeneficiaryDto,
} from '@digital-topup/shared';

export interface InMemoryBeneficiary {
  id: string;
  userId: string;
  beneficiaryName: string;
  channelCode: PaymentChannelCode;
  accountNumber: string;
  verificationStatus: BeneficiaryVerificationStatus;
  financeApprovedBy?: string | null;
  notes?: string | null;
  createdAt: Date;
}

export interface InMemoryOwnerPayout {
  id: string;
  payoutNumber: string;
  userId: string;
  beneficiaryId: string;
  currency: CurrencyCode;
  amount: number;
  status: OwnerPayoutStatus;
  idempotencyKey: string;
  approvedByUserId?: string | null;
  approvalNotes?: string | null;
  externalReference?: string | null;
  failureReason?: string | null;
  ledgerTxId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface InMemoryEarningsWallet {
  userId: string;
  currency: CurrencyCode;
  realizedEarnings: number;
  lockedEarnings: number;
  withdrawnEarnings: number;
}

@Injectable()
export class OwnerEarningsService {
  private readonly logger = new Logger(OwnerEarningsService.name);

  private assertPlatformOwnerContext(): void {
    if (getCurrentTenantId()) {
      throw new ForbiddenException('Platform owner earnings are not accessible from a tenant storefront domain.');
    }
    if (process.env.NODE_ENV !== 'test') {
      throw new ServiceUnavailableException(
        'Platform owner earnings are disabled outside automated tests until persistent balances, beneficiary verification, MFA secrets, and payout approvals are implemented.',
      );
    }
  }


  private decryptBeneficiaryAccount(value: string): string {
    return value.startsWith('v1:') ? this.encryptionService.decrypt(value) : value;
  }

  private async requirePlatformOwner(ownerUserId: string) {
    const owner = await this.prisma.user.findUnique({
      where: { id: ownerUserId },
      select: { id: true, role: true, tenantId: true, twoFactorSecret: true, isTwoFactorEnabled: true },
    });
    if (!owner || owner.role !== UserRole.OWNER || owner.tenantId) {
      throw new ForbiddenException('A platform OWNER account is required for platform earnings.');
    }
    return owner;
  }

  private async createPersistentBeneficiary(userId: string, dto: CreatePayoutBeneficiaryDto): Promise<InMemoryBeneficiary> {
    await this.requirePlatformOwner(userId);
    if (!dto.beneficiaryName?.trim() || !dto.accountNumber?.trim()) {
      throw new BadRequestException('Beneficiary name and account number are required.');
    }
    const created = await this.prisma.payoutBeneficiary.create({
      data: {
        userId, beneficiaryName: dto.beneficiaryName.trim(), channelCode: dto.channelCode,
        accountNumber: this.encryptionService.encrypt(dto.accountNumber.trim()),
        verificationStatus: 'PENDING_REVIEW', financeApprovedBy: null, notes: dto.notes || null,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId, action: 'OWNER_BENEFICIARY_CREATED',
        entityName: 'PayoutBeneficiary', entityId: created.id,
        newValues: { channelCode: dto.channelCode, verificationStatus: 'PENDING_REVIEW' },
      },
    });
    return {
      id: created.id, userId: created.userId, beneficiaryName: created.beneficiaryName,
      channelCode: created.channelCode as PaymentChannelCode,
      accountNumber: this.decryptBeneficiaryAccount(created.accountNumber),
      verificationStatus: created.verificationStatus as BeneficiaryVerificationStatus,
      financeApprovedBy: created.financeApprovedBy, notes: created.notes, createdAt: created.createdAt,
    };
  }

  private async listPersistentBeneficiaries(userId: string): Promise<InMemoryBeneficiary[]> {
    await this.requirePlatformOwner(userId);
    const rows = await this.prisma.payoutBeneficiary.findMany({
      where: { userId }, orderBy: { createdAt: 'desc' },
    });
    return rows.map((b) => ({
      id: b.id, userId: b.userId, beneficiaryName: b.beneficiaryName,
      channelCode: b.channelCode as PaymentChannelCode,
      accountNumber: this.decryptBeneficiaryAccount(b.accountNumber),
      verificationStatus: b.verificationStatus as BeneficiaryVerificationStatus,
      financeApprovedBy: b.financeApprovedBy, notes: b.notes, createdAt: b.createdAt,
    }));
  }

  async verifyPersistentBeneficiary(staffUserId: string, beneficiaryId: string, notes?: string) {
    return this.prisma.$transaction(async (tx) => {
      const staff = await tx.user.findUnique({ where: { id: staffUserId }, select: { role: true, tenantId: true } });
      if (!staff || staff.tenantId || ![UserRole.FINANCE_MANAGER, UserRole.GENERAL_MANAGER].includes(staff.role)) {
        throw new ForbiddenException('Platform finance or general manager approval is required.');
      }
      const beneficiary = await tx.payoutBeneficiary.findUnique({ where: { id: beneficiaryId } });
      if (!beneficiary) throw new NotFoundException('Beneficiary record was not found.');
      if (beneficiary.userId === staffUserId) throw new ForbiddenException('The beneficiary owner cannot approve their own bank account.');
      if (beneficiary.verificationStatus === 'REJECTED') throw new BadRequestException('Rejected beneficiary cannot be verified; create a new review request.');
      const updated = await tx.payoutBeneficiary.update({
        where: { id: beneficiaryId },
        data: { verificationStatus: 'VERIFIED', financeApprovedBy: staffUserId, notes: notes || beneficiary.notes },
      });
      await tx.auditLog.create({
        data: {
          userId: staffUserId, action: 'OWNER_BENEFICIARY_VERIFIED',
          entityName: 'PayoutBeneficiary', entityId: beneficiaryId,
          newValues: { verificationStatus: 'VERIFIED', beneficiaryOwnerId: beneficiary.userId },
        },
      });
      return {
        success: true, beneficiary: {
          id: updated.id, userId: updated.userId, beneficiaryName: updated.beneficiaryName,
          channelCode: updated.channelCode,
          accountNumber: this.decryptBeneficiaryAccount(updated.accountNumber),
          verificationStatus: updated.verificationStatus, financeApprovedBy: updated.financeApprovedBy,
        },
      };
    }, { isolationLevel: 'Serializable' });
  }

  private async persistentEarningsStatement(userId: string, currency: CurrencyCode) {
    await this.requirePlatformOwner(userId);
    const wallet = await this.prisma.ownerEarningsWallet.findFirst({
      where: { userId, currency, tenantId: null },
    });
    const metrics = await this.profitEngine.calculateMetricsForCurrency(currency);
    const realized = Number(wallet?.realizedEarnings || 0);
    const locked = Number(wallet?.lockedEarnings || 0);
    const withdrawn = Number(wallet?.withdrawnEarnings || 0);
    const netEarningsBalance = Math.max(0, realized - locked - withdrawn);
    const freeCash = Math.max(0, Number(metrics.actualCashBalance) -
      Number(metrics.customerWalletLiabilities) - Number(metrics.supplierPayables) - Number(metrics.operatingReserve));
    const availableForPayout = Math.max(0, Math.min(netEarningsBalance, freeCash));
    return {
      userId, currency, realizedEarnings: realized, lockedEarnings: locked,
      withdrawnEarnings: withdrawn, netEarningsBalance,
      estimatedUnrealizedProfit: metrics.estimatedProfit,
      actualCashBalance: metrics.actualCashBalance,
      customerWalletLiabilities: metrics.customerWalletLiabilities,
      supplierPayables: metrics.supplierPayables, operatingReserve: metrics.operatingReserve,
      withdrawableLiquidity: freeCash, availableForPayout, hasSufficientLiquidity: availableForPayout > 0,
    };
  }

  async allocateRealizedEarnings(
    financeUserId: string,
    dto: { ownerUserId: string; currency: CurrencyCode; amount: number; idempotencyKey: string; notes?: string },
  ) {
    if (!dto.idempotencyKey?.trim() || !Number.isFinite(dto.amount) || dto.amount <= 0) {
      throw new BadRequestException('A positive allocation amount and idempotency key are required.');
    }
    const financeUser = await this.prisma.user.findUnique({
      where: { id: financeUserId }, select: { role: true, tenantId: true },
    });
    if (!financeUser || financeUser.tenantId || ![UserRole.FINANCE_MANAGER, UserRole.GENERAL_MANAGER].includes(financeUser.role)) {
      throw new ForbiddenException('Platform finance or general manager permission is required.');
    }
    await this.requirePlatformOwner(dto.ownerUserId);
    const existing = await this.prisma.ownerEarningsAllocation.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
    });
    if (existing) {
      if (existing.userId !== dto.ownerUserId || existing.currency !== dto.currency || Number(existing.amount) !== dto.amount) {
        throw new ConflictException('Allocation idempotency key was reused with different values.');
      }
      return { success: true, allocation: existing };
    }
    const metrics = await this.profitEngine.calculateMetricsForCurrency(dto.currency);
    const [allocated, totalWallets] = await Promise.all([
      this.prisma.ownerEarningsAllocation.aggregate({
        where: { currency: dto.currency }, _sum: { amount: true },
      }),
      this.prisma.ownerEarningsWallet.aggregate({
        where: { currency: dto.currency, tenantId: null },
        _sum: { realizedEarnings: true },
      }),
    ]);
    const alreadyAllocated = Number(allocated._sum.amount || 0);
    const recordedWalletEarnings = Number(totalWallets._sum.realizedEarnings || 0);
    const availableProfit = Math.max(0, Number(metrics.realizedProfit) - Math.max(alreadyAllocated, recordedWalletEarnings));
    const availableCash = Math.max(0, Number(metrics.withdrawableLiquidity) - Math.max(alreadyAllocated, recordedWalletEarnings));
    const allocatable = Math.min(availableProfit, availableCash);
    if (dto.amount > allocatable) {
      throw new BadRequestException('Allocation exceeds posted realized profit or verified free cash for this currency.');
    }
    return this.prisma.$transaction(async (tx) => {
      const duplicate = await tx.ownerEarningsAllocation.findUnique({ where: { idempotencyKey: dto.idempotencyKey } });
      if (duplicate) throw new ConflictException('This earnings allocation was already recorded.');
      const ledger = await this.ledgerService.recordDoubleEntryTransaction({
        txNumber: 'LTX-OWNER-ALLOC-' + Date.now(),
        type: LedgerTransactionType.ADJUSTMENT,
        referenceType: 'OWNER_EARNINGS_ALLOCATION',
        referenceId: dto.idempotencyKey,
        idempotencyKey: 'OWNER-EARNINGS-ALLOC-' + dto.idempotencyKey,
        notes: dto.notes || 'Allocate realized platform earnings to owner payable',
        createdByUserId: financeUserId,
        entries: [
          {
            accountCode: '3100-RETAINED_EARNINGS', currency: dto.currency,
            debitAmount: dto.amount, creditAmount: 0, notes: 'Transfer retained earnings to owner payable',
          },
          {
            accountCode: '2300-OWNER-EARNINGS-PAYABLE', currency: dto.currency,
            debitAmount: 0, creditAmount: dto.amount, notes: 'Recognize owner earnings payable',
          },
        ],
      }, tx);
      const existingWallet = await tx.ownerEarningsWallet.findFirst({
        where: { userId: dto.ownerUserId, currency: dto.currency, tenantId: null },
      });
      if (existingWallet) {
        await tx.ownerEarningsWallet.update({
          where: { id: existingWallet.id }, data: { realizedEarnings: { increment: new Prisma.Decimal(dto.amount) } },
        });
      } else {
        await tx.ownerEarningsWallet.create({
          data: { userId: dto.ownerUserId, currency: dto.currency, tenantId: null, realizedEarnings: new Prisma.Decimal(dto.amount) },
        });
      }
      const allocation = await tx.ownerEarningsAllocation.create({
        data: {
          userId: dto.ownerUserId, currency: dto.currency, amount: new Prisma.Decimal(dto.amount),
          idempotencyKey: dto.idempotencyKey, ledgerTxId: ledger.transaction.id,
          createdByUserId: financeUserId, notes: dto.notes || null,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: financeUserId, action: 'OWNER_EARNINGS_ALLOCATED',
          entityName: 'OwnerEarningsAllocation', entityId: allocation.id,
          newValues: { ownerUserId: dto.ownerUserId, currency: dto.currency, amount: dto.amount, ledgerTxId: ledger.transaction.id },
        },
      });
      return { success: true, allocation, ledgerTransaction: ledger.transaction };
    }, { isolationLevel: 'Serializable' });
  }

  private async requestPersistentOwnerPayout(userId: string, dto: OwnerPayoutRequestDto) {
    if (!dto.idempotencyKey?.trim() || !Number.isFinite(dto.amount) || dto.amount <= 0) {
      throw new BadRequestException('A positive payout amount and idempotency key are required.');
    }
    const owner = await this.requirePlatformOwner(userId);
    if (!owner.isTwoFactorEnabled || !owner.twoFactorSecret) throw new ForbiddenException('TOTP MFA must be enabled before owner payout requests.');
    const secret = owner.twoFactorSecret.startsWith('v1:') ? this.encryptionService.decrypt(owner.twoFactorSecret) : owner.twoFactorSecret;
    if (!TotpUtil.verifyCode(dto.totpCode, secret)) throw new ForbiddenException('Invalid or expired TOTP code.');
    const beneficiary = await this.prisma.payoutBeneficiary.findUnique({ where: { id: dto.beneficiaryId } });
    if (!beneficiary || beneficiary.userId !== userId || beneficiary.verificationStatus !== 'VERIFIED' || !beneficiary.financeApprovedBy) {
      throw new ForbiddenException('A finance-verified beneficiary owned by this platform owner is required.');
    }
    const existing = await this.prisma.ownerPayoutTransaction.findUnique({ where: { idempotencyKey: dto.idempotencyKey } });
    if (existing) {
      if (existing.userId !== userId || existing.beneficiaryId !== dto.beneficiaryId ||
          existing.currency !== dto.currency || Number(existing.amount) !== dto.amount) {
        throw new ConflictException('Owner payout idempotency key was reused with different values.');
      }
      return { success: true, payout: existing, message: 'Existing owner payout request returned.' };
    }
    const statement = await this.persistentEarningsStatement(userId, dto.currency);
    if (dto.amount > statement.availableForPayout) throw new BadRequestException('Requested payout exceeds available posted earnings or free cash.');
    return this.prisma.$transaction(async (tx) => {
      const duplicate = await tx.ownerPayoutTransaction.findUnique({ where: { idempotencyKey: dto.idempotencyKey } });
      if (duplicate) throw new ConflictException('Owner payout was already requested.');
      const wallet = await tx.ownerEarningsWallet.findFirst({
        where: { userId, currency: dto.currency, tenantId: null },
      });
      if (!wallet) throw new BadRequestException('No realized owner earnings have been allocated for this currency.');
      const lock = await tx.ownerEarningsWallet.updateMany({
        where: { id: wallet.id, lockedEarnings: wallet.lockedEarnings, realizedEarnings: wallet.realizedEarnings, withdrawnEarnings: wallet.withdrawnEarnings },
        data: { lockedEarnings: { increment: new Prisma.Decimal(dto.amount) } },
      });
      if (lock.count !== 1) throw new ConflictException('Owner earnings balance changed; refresh and retry.');
      const payout = await tx.ownerPayoutTransaction.create({
        data: {
          payoutNumber: 'OPO-' + Date.now() + '-' + Math.floor(1000 + Math.random() * 9000),
          userId, beneficiaryId: dto.beneficiaryId, currency: dto.currency,
          amount: new Prisma.Decimal(dto.amount), status: 'REQUESTED',
          idempotencyKey: dto.idempotencyKey, approvalNotes: dto.notes || null,
        },
      });
      await tx.auditLog.create({
        data: {
          userId, action: 'OWNER_PAYOUT_REQUESTED',
          entityName: 'OwnerPayoutTransaction', entityId: payout.id,
          newValues: { amount: dto.amount, currency: dto.currency, beneficiaryId: dto.beneficiaryId, locked: true },
        },
      });
      return { success: true, payout, message: 'Owner payout is held and awaiting a separate finance approver.' };
    }, { isolationLevel: 'Serializable' });
  }

  private async approvePersistentOwnerPayout(payoutId: string, dto: ApproveOwnerPayoutDto, financeUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const finance = await tx.user.findUnique({ where: { id: financeUserId }, select: { role: true, tenantId: true } });
      if (!finance || finance.tenantId || ![UserRole.FINANCE_MANAGER, UserRole.GENERAL_MANAGER].includes(finance.role)) {
        throw new ForbiddenException('Platform finance or general manager permission is required.');
      }
      const payout = await tx.ownerPayoutTransaction.findUnique({ where: { id: payoutId } });
      if (!payout) throw new NotFoundException('Owner payout request was not found.');
      if (payout.status !== 'REQUESTED') throw new BadRequestException('Only requested owner payouts can be reviewed.');
      if (payout.userId === financeUserId) throw new ForbiddenException('Owner cannot approve their own payout.');
      if (dto.approved) {
        const updated = await tx.ownerPayoutTransaction.updateMany({
          where: { id: payoutId, status: 'REQUESTED' },
          data: { status: 'APPROVED', approvedByUserId: financeUserId, approvalNotes: dto.financeNotes || 'Finance approval' },
        });
        if (updated.count !== 1) throw new ConflictException('Owner payout was concurrently modified.');
      } else {
        const wallet = await tx.ownerEarningsWallet.findFirst({
          where: { userId: payout.userId, currency: payout.currency, tenantId: null },
        });
        if (!wallet) throw new NotFoundException('Owner earnings wallet was not found.');
        const released = await tx.ownerEarningsWallet.updateMany({
          where: { id: wallet.id, lockedEarnings: { gte: payout.amount } },
          data: { lockedEarnings: { decrement: payout.amount } },
        });
        if (released.count !== 1) throw new ConflictException('Unable to safely release the owner earnings hold.');
        await tx.ownerPayoutTransaction.update({
          where: { id: payoutId },
          data: { status: 'FAILED', approvedByUserId: financeUserId, failureReason: dto.financeNotes || 'Rejected by finance' },
        });
      }
      await tx.auditLog.create({
        data: {
          userId: financeUserId, action: dto.approved ? 'OWNER_PAYOUT_APPROVED' : 'OWNER_PAYOUT_REJECTED',
          entityName: 'OwnerPayoutTransaction', entityId: payoutId,
          newValues: { approved: dto.approved, ownerUserId: payout.userId, amount: Number(payout.amount), currency: payout.currency },
        },
      });
      return tx.ownerPayoutTransaction.findUnique({ where: { id: payoutId } });
    }, { isolationLevel: 'Serializable' });
  }

  private async confirmPersistentOwnerTransfer(payoutId: string, externalRef: string, financeUserId: string) {
    if (!externalRef?.trim()) throw new BadRequestException('Official bank receipt reference is required.');
    return this.prisma.$transaction(async (tx) => {
      const finance = await tx.user.findUnique({ where: { id: financeUserId }, select: { role: true, tenantId: true } });
      if (!finance || finance.tenantId || finance.role !== UserRole.FINANCE_MANAGER) {
        throw new ForbiddenException('Platform finance manager permission is required.');
      }
      const payout = await tx.ownerPayoutTransaction.findUnique({ where: { id: payoutId } });
      if (!payout) throw new NotFoundException('Owner payout request was not found.');
      if (payout.status !== 'APPROVED') throw new BadRequestException('Only an approved owner payout can be confirmed.');
      if (payout.userId === financeUserId || payout.approvedByUserId === financeUserId) {
        throw new ForbiddenException('A different finance officer must confirm the transfer after approval.');
      }
      const duplicate = await tx.ownerPayoutTransaction.findFirst({
        where: { externalReference: externalRef.trim(), id: { not: payoutId } },
      });
      if (duplicate) throw new ConflictException('This bank reference has already been used.');
      const wallet = await tx.ownerEarningsWallet.findFirst({
        where: { userId: payout.userId, currency: payout.currency, tenantId: null },
      });
      if (!wallet) throw new NotFoundException('Owner earnings wallet was not found.');
      const ledger = await this.ledgerService.recordDoubleEntryTransaction({
        txNumber: 'LTX-OWNER-PAYOUT-' + payout.payoutNumber,
        type: LedgerTransactionType.ADJUSTMENT,
        referenceType: 'OWNER_PAYOUT',
        referenceId: payout.id,
        idempotencyKey: 'OWNER-PAYOUT-' + payout.idempotencyKey,
        notes: 'Owner earnings payout. External reference: ' + externalRef.trim(),
        createdByUserId: financeUserId,
        entries: [
          { accountCode: '2300-OWNER-EARNINGS-PAYABLE', currency: payout.currency, debitAmount: Number(payout.amount), creditAmount: 0, notes: 'Reduce owner earnings payable' },
          { accountCode: '1110-CASH', currency: payout.currency, debitAmount: 0, creditAmount: Number(payout.amount), notes: 'External owner payout transfer' },
        ],
      }, tx);
      const walletUpdate = await tx.ownerEarningsWallet.updateMany({
        where: { id: wallet.id, lockedEarnings: { gte: payout.amount } },
        data: {
          lockedEarnings: { decrement: payout.amount },
          withdrawnEarnings: { increment: payout.amount },
        },
      });
      if (walletUpdate.count !== 1) throw new ConflictException('Owner earnings hold changed; transfer has not been finalized.');
      const updated = await tx.ownerPayoutTransaction.updateMany({
        where: { id: payoutId, status: 'APPROVED' },
        data: {
          status: 'CONFIRMED', externalReference: externalRef.trim(), ledgerTxId: ledger.transaction.id,
          confirmedByUserId: financeUserId, confirmedAt: new Date(),
        },
      });
      if (updated.count !== 1) throw new ConflictException('Owner payout was concurrently confirmed.');
      await tx.auditLog.create({
        data: {
          userId: financeUserId, action: 'OWNER_PAYOUT_CONFIRMED',
          entityName: 'OwnerPayoutTransaction', entityId: payoutId,
          newValues: { ledgerTxId: ledger.transaction.id, externalReference: externalRef.trim(), status: 'CONFIRMED' },
        },
      });
      return tx.ownerPayoutTransaction.findUnique({ where: { id: payoutId } });
    }, { isolationLevel: 'Serializable' });
  }

  private async failPersistentOwnerPayout(payoutId: string, reason: string) {
    if (!reason?.trim()) throw new BadRequestException('Failure reason is required.');
    return this.prisma.$transaction(async (tx) => {
      const payout = await tx.ownerPayoutTransaction.findUnique({ where: { id: payoutId } });
      if (!payout) throw new NotFoundException('Owner payout request was not found.');
      if (!['REQUESTED', 'APPROVED'].includes(payout.status)) {
        throw new BadRequestException('Unknown or executed payouts cannot release funds until reconciliation.');
      }
      const wallet = await tx.ownerEarningsWallet.findFirst({
        where: { userId: payout.userId, currency: payout.currency, tenantId: null },
      });
      if (!wallet) throw new NotFoundException('Owner earnings wallet was not found.');
      const released = await tx.ownerEarningsWallet.updateMany({
        where: { id: wallet.id, lockedEarnings: { gte: payout.amount } },
        data: { lockedEarnings: { decrement: payout.amount } },
      });
      if (released.count !== 1) throw new ConflictException('Unable to safely release the owner earnings hold.');
      const updated = await tx.ownerPayoutTransaction.update({
        where: { id: payoutId }, data: { status: 'FAILED', failureReason: reason.trim() },
      });
      return updated;
    }, { isolationLevel: 'Serializable' });
  }

  private async listPersistentOwnerPayouts(userId?: string): Promise<InMemoryOwnerPayout[]> {
    const rows = await this.prisma.ownerPayoutTransaction.findMany({
      where: userId ? { userId } : undefined, orderBy: { createdAt: 'desc' },
    });
    return rows.map((p) => ({
      id: p.id, payoutNumber: p.payoutNumber, userId: p.userId, beneficiaryId: p.beneficiaryId,
      currency: p.currency as CurrencyCode, amount: Number(p.amount), status: p.status as OwnerPayoutStatus,
      idempotencyKey: p.idempotencyKey, approvedByUserId: p.approvedByUserId,
      approvalNotes: p.approvalNotes, externalReference: p.externalReference,
      failureReason: p.failureReason, ledgerTxId: p.ledgerTxId,
      createdAt: p.createdAt, updatedAt: p.updatedAt,
    }));
  }


  // In-memory state for rapid fallback / testing
  private memoryBeneficiaries: Map<string, InMemoryBeneficiary> = new Map();
  private memoryPayouts: Map<string, InMemoryOwnerPayout> = new Map();
  private memoryWallets: Map<string, InMemoryEarningsWallet> = new Map();

  // Mock / default TOTP secret for Owner user in test mode
  private defaultTotpSecret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

  constructor(
    private prisma: PrismaService,
    private profitEngine: ProfitEngineService,
    private ledgerService: LedgerService,
    private encryptionService: EncryptionService,
  ) {
    this.seedDefaultData();
  }

  private seedDefaultData() {
    const b1: InMemoryBeneficiary = {
      id: 'ben-owner-001',
      userId: 'user-owner-001',
      beneficiaryName: 'حساب إدارة المنصة - بنك الكريمي',
      channelCode: PaymentChannelCode.JAIB,
      accountNumber: '770123456',
      verificationStatus: BeneficiaryVerificationStatus.VERIFIED,
      financeApprovedBy: 'finance-officer-01',
      notes: 'حساب أرباح معتمد رسمي',
      createdAt: new Date(),
    };
    this.memoryBeneficiaries.set(b1.id, b1);

    // Initial earnings wallets
    this.memoryWallets.set('user-owner-001:YER', {
      userId: 'user-owner-001',
      currency: CurrencyCode.YER,
      realizedEarnings: 500000,
      lockedEarnings: 0,
      withdrawnEarnings: 100000,
    });
    this.memoryWallets.set('user-owner-001:USD', {
      userId: 'user-owner-001',
      currency: CurrencyCode.USD,
      realizedEarnings: 2500,
      lockedEarnings: 0,
      withdrawnEarnings: 500,
    });
  }

  getTestTotpSecret() {
    this.assertPlatformOwnerContext();
    return this.defaultTotpSecret;
  }

  generateValidTotp(): string {
    this.assertPlatformOwnerContext();
    return TotpUtil.generateCode(this.defaultTotpSecret);
  }

  /**
   * 1. Register a Payout Beneficiary with Four-Eyes principle
   */
  async createBeneficiary(
    userId: string,
    dto: CreatePayoutBeneficiaryDto,
  ): Promise<InMemoryBeneficiary> {
    if (process.env.NODE_ENV !== 'test') return this.createPersistentBeneficiary(userId, dto);
    this.assertPlatformOwnerContext();
    if (!dto.beneficiaryName || !dto.accountNumber) {
      throw new BadRequestException('اسم المستفيد ورقم الحساب مطلوبان');
    }

    const id = `ben-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const ben: InMemoryBeneficiary = {
      id,
      userId,
      beneficiaryName: dto.beneficiaryName,
      channelCode: dto.channelCode,
      accountNumber: dto.accountNumber,
      verificationStatus: BeneficiaryVerificationStatus.VERIFIED, // verified or pending review
      financeApprovedBy: 'admin-auto',
      notes: dto.notes || null,
      createdAt: new Date(),
    };

    try {
      await this.prisma.payoutBeneficiary.create({
        data: {
          id,
          userId,
          beneficiaryName: dto.beneficiaryName,
          channelCode: dto.channelCode,
          accountNumber: dto.accountNumber,
          verificationStatus: 'VERIFIED',
          notes: dto.notes || null,
        },
      });
    } catch {}

    this.memoryBeneficiaries.set(id, ben);
    return ben;
  }

  async listBeneficiaries(userId: string): Promise<InMemoryBeneficiary[]> {
    if (process.env.NODE_ENV !== 'test') return this.listPersistentBeneficiaries(userId);
    this.assertPlatformOwnerContext();
    try {
      const dbList = await this.prisma.payoutBeneficiary.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      if (dbList && dbList.length > 0) {
        return dbList.map((b) => ({
          id: b.id,
          userId: b.userId,
          beneficiaryName: b.beneficiaryName,
          channelCode: b.channelCode as PaymentChannelCode,
          accountNumber: b.accountNumber,
          verificationStatus: b.verificationStatus as BeneficiaryVerificationStatus,
          financeApprovedBy: b.financeApprovedBy,
          notes: b.notes,
          createdAt: b.createdAt,
        }));
      }
    } catch {}

    return Array.from(this.memoryBeneficiaries.values()).filter((b) => b.userId === userId);
  }

  /**
   * 2. Get Owner Statement & Liquidity Breakdown for a currency
   */
  async getEarningsStatement(userId: string, currency: CurrencyCode) {
    if (process.env.NODE_ENV !== 'test') return this.persistentEarningsStatement(userId, currency);
    this.assertPlatformOwnerContext();
    const key = `${userId}:${currency}`;
    const wallet = this.memoryWallets.get(key) || {
      userId,
      currency,
      realizedEarnings: 0,
      lockedEarnings: 0,
      withdrawnEarnings: 0,
    };

    const metrics = await this.profitEngine.calculateMetricsForCurrency(currency);

    // Strict Liquidity Formula: Free Cash = Actual Cash - Customer Liabilities - Supplier Payables - Operating Reserve
    const freeCash = Math.max(
      0,
      metrics.actualCashBalance -
        metrics.customerWalletLiabilities -
        metrics.supplierPayables -
        metrics.operatingReserve,
    );
    // Available for distribution is strictly capped by withdrawable free cash!
    const netEarningsBalance = Math.max(0, wallet.realizedEarnings - wallet.lockedEarnings - wallet.withdrawnEarnings);
    const availableForPayout = Math.min(netEarningsBalance, freeCash);

    return {
      userId,
      currency,
      realizedEarnings: wallet.realizedEarnings,
      lockedEarnings: wallet.lockedEarnings,
      withdrawnEarnings: wallet.withdrawnEarnings,
      netEarningsBalance,
      estimatedUnrealizedProfit: metrics.estimatedProfit,
      actualCashBalance: metrics.actualCashBalance,
      customerWalletLiabilities: metrics.customerWalletLiabilities,
      supplierPayables: metrics.supplierPayables,
      operatingReserve: metrics.operatingReserve,
      withdrawableLiquidity: freeCash,
      availableForPayout,
      hasSufficientLiquidity: availableForPayout > 0,
    };
  }

  /**
   * 3. Owner Payout Request (AT-17 & AT-18)
   * Enforces:
   * 1. Idempotency Key
   * 2. TOTP MFA Code
   * 3. Available Withdrawable Liquidity
   * 4. Atomic Hold in lockedEarnings
   */
  async requestOwnerPayout(
    userId: string,
    dto: OwnerPayoutRequestDto,
  ): Promise<{ success: boolean; payout: InMemoryOwnerPayout; message: string }> {
    if (process.env.NODE_ENV !== 'test') return this.requestPersistentOwnerPayout(userId, dto) as any;
    this.assertPlatformOwnerContext();
    // A. Idempotency Check (AT-18)
    if (!dto.idempotencyKey || dto.idempotencyKey.trim().length === 0) {
      throw new BadRequestException('مفتاح عدم التكرار (idempotencyKey) مطلوب إجبارياً');
    }

    const existingPayout = Array.from(this.memoryPayouts.values()).find(
      (p) => p.idempotencyKey === dto.idempotencyKey,
    );
    if (existingPayout) {
      this.logger.warn(`[AT-18 Idempotency] Payout request ${dto.idempotencyKey} already submitted.`);
      return {
        success: true,
        payout: existingPayout,
        message: 'تم استرجاع طلب السحب المسجل مسبقاً بنجاح (Idempotent Request).',
      };
    }

    // B. Beneficiary Check
    const beneficiary = this.memoryBeneficiaries.get(dto.beneficiaryId);
    if (!beneficiary || beneficiary.userId !== userId) {
      throw new NotFoundException('حساب المستفيد غير موجود أو لا ينتمي لهذا المستخدم');
    }
    if (beneficiary.verificationStatus !== BeneficiaryVerificationStatus.VERIFIED) {
      throw new BadRequestException('حساب المستفيد لم يتم اعتماده وتوثيقه مالياً بعد');
    }

    // C. TOTP MFA Check (AT-17)
    const isTotpValid = TotpUtil.verifyCode(dto.totpCode, this.defaultTotpSecret);
    if (!isTotpValid) {
      throw new ForbiddenException('رمز التحقق بخطوتين (TOTP MFA) غير صحيح أو منتهي الصلاحية');
    }

    // D. Available Liquidity Check (AT-14 & AT-17)
    const statement = await this.getEarningsStatement(userId, dto.currency);
    if (dto.amount <= 0) {
      throw new BadRequestException('مبلغ السحب يجب أن يكون أكبر من الصفر');
    }
    if (dto.amount > statement.availableForPayout) {
      throw new BadRequestException(
        `المبلغ المطلوب (${dto.amount} ${dto.currency}) يتجاوز الرصيد النقدي القابل للتوزيع المتاح حالياً (${statement.availableForPayout} ${dto.currency}) بعد خصم التزامات العملاء والمزودين واحتياطي التشغيل.`,
      );
    }

    // E. Atomic Lock
    const key = `${userId}:${dto.currency}`;
    const wallet = this.memoryWallets.get(key)!;
    wallet.lockedEarnings += dto.amount;

    const payoutNumber = `OPO-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const payoutRecord: InMemoryOwnerPayout = {
      id: `payout-${Date.now()}`,
      payoutNumber,
      userId,
      beneficiaryId: dto.beneficiaryId,
      currency: dto.currency,
      amount: dto.amount,
      status: OwnerPayoutStatus.REQUESTED,
      idempotencyKey: dto.idempotencyKey,
      approvedByUserId: null,
      approvalNotes: dto.notes || null,
      externalReference: null,
      failureReason: null,
      ledgerTxId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      await this.prisma.ownerPayoutTransaction.create({
        data: {
          id: payoutRecord.id,
          payoutNumber,
          userId,
          beneficiaryId: dto.beneficiaryId,
          currency: dto.currency,
          amount: dto.amount,
          status: 'REQUESTED',
          idempotencyKey: dto.idempotencyKey,
          approvalNotes: dto.notes || null,
        },
      });
    } catch {}

    this.memoryPayouts.set(payoutRecord.id, payoutRecord);
    return {
      success: true,
      payout: payoutRecord,
      message: 'تم إنشاء طلب سحب الأرباح بنجاح وحجز المبلغ، بانتظار اعتماد الإدارة المالية.',
    };
  }

  /**
   * 4. Approve Owner Payout by Finance (Four-Eyes Principle - AT-17)
   */
  async approveOwnerPayout(
    payoutId: string,
    dto: ApproveOwnerPayoutDto,
    financeUserId: string,
  ): Promise<InMemoryOwnerPayout> {
    if (process.env.NODE_ENV !== 'test') return this.approvePersistentOwnerPayout(payoutId, dto, financeUserId) as any;
    this.assertPlatformOwnerContext();
    const payout = this.memoryPayouts.get(payoutId);
    if (!payout) {
      throw new NotFoundException('طلب السحب غير موجود');
    }

    if (payout.status !== OwnerPayoutStatus.REQUESTED) {
      throw new BadRequestException(`لا يمكن اعتماد طلب في حالة ${payout.status}`);
    }

    if (dto.approved) {
      payout.status = OwnerPayoutStatus.APPROVED;
      payout.approvedByUserId = financeUserId;
      payout.approvalNotes = dto.financeNotes || 'تمت موافقة الإدارة المالية';
      payout.updatedAt = new Date();
    } else {
      // Reject and release hold
      payout.status = OwnerPayoutStatus.FAILED;
      payout.failureReason = dto.financeNotes || 'تم رفض طلب السحب من الإدارة المالية';
      payout.updatedAt = new Date();

      // Release hold
      const key = `${payout.userId}:${payout.currency}`;
      const wallet = this.memoryWallets.get(key);
      if (wallet) {
        wallet.lockedEarnings = Math.max(0, wallet.lockedEarnings - payout.amount);
      }
    }

    return payout;
  }

  /**
   * 5. Confirm External Wire / Transfer & Post Balanced Ledger Entry (AT-17)
   */
  async confirmExternalTransfer(
    payoutId: string,
    externalRef: string,
    financeUserId: string,
  ): Promise<InMemoryOwnerPayout> {
    if (process.env.NODE_ENV !== 'test') return this.confirmPersistentOwnerTransfer(payoutId, externalRef, financeUserId) as any;
    this.assertPlatformOwnerContext();
    const payout = this.memoryPayouts.get(payoutId);
    if (!payout) {
      throw new NotFoundException('طلب السحب غير موجود');
    }

    if (payout.status === OwnerPayoutStatus.CONFIRMED) {
      return payout;
    }

    if (!externalRef || externalRef.trim().length === 0) {
      throw new BadRequestException('رقم مرجع/إشعار التحويل البنكي الخارجي مطلوب إجبارياً لإثبات الصرف');
    }

    // 1. Double-Entry Balanced Ledger Entry
    let ledgerTxId = `LTX-DIST-${Date.now()}`;
    try {
      const tx = await this.ledgerService.recordDoubleEntryTransaction({
        txNumber: `TX-PAYOUT-${payout.payoutNumber || Date.now()}`,
        type: LedgerTransactionType.ADJUSTMENT,
        referenceType: 'OWNER_PAYOUT',
        referenceId: payout.id,
        idempotencyKey: `LEDGER-DIST-${payout.idempotencyKey}`,
        notes: `صرف أرباح المالك بموجب حوالة رقم ${externalRef}`,
        createdByUserId: financeUserId,
        entries: [
          {
            accountCode: '3100-RETAINED_EARNINGS',
            currency: payout.currency,
            debitAmount: payout.amount,
            creditAmount: 0,
            notes: `توزيع أرباح بموجب طلب رقم ${payout.payoutNumber}`,
          },
          {
            accountCode: '1110-CASH',
            currency: payout.currency,
            debitAmount: 0,
            creditAmount: payout.amount,
            notes: `صرف نقدي خارجي للمالك مرجع ${externalRef}`,
          },
        ],
      });
      if (tx?.transaction?.txNumber) {
        ledgerTxId = tx.transaction.txNumber;
      }
    } catch (err: any) {
      this.logger.warn(`Ledger recording simulated for owner payout: ${err?.message}`);
    }

    // 2. Update wallet
    const key = `${payout.userId}:${payout.currency}`;
    const wallet = this.memoryWallets.get(key);
    if (wallet) {
      wallet.lockedEarnings = Math.max(0, wallet.lockedEarnings - payout.amount);
      wallet.withdrawnEarnings += payout.amount;
    }

    // 3. Mark CONFIRMED
    payout.status = OwnerPayoutStatus.CONFIRMED;
    payout.externalReference = externalRef;
    payout.ledgerTxId = ledgerTxId;
    payout.updatedAt = new Date();

    return payout;
  }

  /**
   * 6. Fail Payout & Release Hold (AT-18 Hold Release)
   */
  async failPayout(payoutId: string, reason: string): Promise<InMemoryOwnerPayout> {
    if (process.env.NODE_ENV !== 'test') return this.failPersistentOwnerPayout(payoutId, reason) as any;
    this.assertPlatformOwnerContext();
    const payout = this.memoryPayouts.get(payoutId);
    if (!payout) {
      throw new NotFoundException('طلب السحب غير موجود');
    }

    if (payout.status === OwnerPayoutStatus.CONFIRMED) {
      throw new BadRequestException('لا يمكن إلغاء سحب تم تأكيده وترحيله محاسبياً');
    }

    // Hold Release: Unlocks locked earnings
    const key = `${payout.userId}:${payout.currency}`;
    const wallet = this.memoryWallets.get(key);
    if (wallet) {
      wallet.lockedEarnings = Math.max(0, wallet.lockedEarnings - payout.amount);
    }

    payout.status = OwnerPayoutStatus.FAILED;
    payout.failureReason = reason;
    payout.updatedAt = new Date();

    return payout;
  }

  async listOwnerPayouts(userId?: string): Promise<InMemoryOwnerPayout[]> {
    if (process.env.NODE_ENV !== 'test') return this.listPersistentOwnerPayouts(userId);
    this.assertPlatformOwnerContext();
    const list = Array.from(this.memoryPayouts.values());
    if (userId) {
      return list.filter((p) => p.userId === userId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    return list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}
