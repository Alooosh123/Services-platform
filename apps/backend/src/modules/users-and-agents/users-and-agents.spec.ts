import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TiersService } from './tiers.service';
import { SubAgentsService } from './sub-agents.service';
import { PrismaService } from '../../database/prisma.service';
import { CurrencyCode, UserRole } from '@digital-topup/shared';
import * as argon2 from 'argon2';

jest.mock('argon2', () => ({
  hash: jest.fn().mockResolvedValue('mocked_argon2_hash'),
  argon2id: 2,
}));

describe('Stage 06 — User Tiers & Sub-Agents Architecture', () => {
  let tiersService: TiersService;
  let subAgentsService: SubAgentsService;

  const mockPrisma = {
    tier: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    productPrice: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    productTierPrice: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    agentProductPrice: {
      upsert: jest.fn(),
    },
    order: {
      groupBy: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TiersService,
        SubAgentsService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    tiersService = module.get<TiersService>(TiersService);
    subAgentsService = module.get<SubAgentsService>(SubAgentsService);
  });

  describe('TiersService', () => {
    it('should list all tiers ordered by displayOrder', async () => {
      mockPrisma.tier.findMany.mockResolvedValue([
        { id: 't1', code: 'VIP', name: 'VIP Resellers', displayOrder: 1 },
      ]);

      const result = await tiersService.list();
      expect(result).toHaveLength(1);
      expect(mockPrisma.tier.findMany).toHaveBeenCalledWith({
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
        include: { _count: { select: { users: true, productPrices: true } } },
      });
    });

    it('should create a tier with valid data', async () => {
      const dto = {
        code: 'GOLD',
        name: 'Gold Tier',
        nameAr: 'الشريحة الذهبية',
        displayOrder: 2,
        defaultDiscountPercent: 5,
        dailyTransactionLimit: 1000000,
      };
      mockPrisma.tier.create.mockResolvedValue({ id: 't-gold', ...dto });

      const result = await tiersService.create(dto);
      expect(result.id).toBe('t-gold');
      expect(mockPrisma.tier.create).toHaveBeenCalledWith({ data: dto });
    });

    it('should throw ConflictException if tier code is duplicated', async () => {
      mockPrisma.tier.create.mockRejectedValue({ code: 'P2002' });
      await expect(
        tiersService.create({
          code: 'GOLD',
          name: 'Gold',
          nameAr: 'ذهب',
          defaultDiscountPercent: 0,
          displayOrder: 1,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if setting price below product cost', async () => {
      mockPrisma.tier.findUnique.mockResolvedValue({ id: 't1', isActive: true });
      mockPrisma.productPrice.findFirst.mockResolvedValue({
        costPrice: 10,
        retailPrice: 12,
        isAvailable: true,
      });

      await expect(
        tiersService.setProductPrice('t1', {
          productId: 'p1',
          currency: CurrencyCode.USD,
          retailPrice: 9.5, // Below cost price of 10
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should upsert tier product price successfully when valid', async () => {
      mockPrisma.tier.findUnique.mockResolvedValue({ id: 't1', isActive: true });
      mockPrisma.productPrice.findFirst.mockResolvedValue({
        costPrice: 10,
        retailPrice: 12,
        isAvailable: true,
      });
      mockPrisma.productTierPrice.findFirst.mockResolvedValue(null);
      mockPrisma.productTierPrice.create.mockResolvedValue({
        id: 'ptp-1',
        productId: 'p1',
        tierId: 't1',
        currency: 'USD',
        retailPrice: 11,
      });

      const res = await tiersService.setProductPrice('t1', {
        productId: 'p1',
        currency: CurrencyCode.USD,
        retailPrice: 11,
      });

      expect(res.id).toBe('ptp-1');
      expect(mockPrisma.productTierPrice.create).toHaveBeenCalled();
    });
  });

  describe('SubAgentsService', () => {
    const parentAgentId = 'reseller-uuid-001';

    it('should reject creation if caller is not an active RESELLER', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: parentAgentId,
        role: UserRole.CUSTOMER, // Not reseller!
        isActive: true,
      });

      await expect(
        subAgentsService.create(parentAgentId, {
          fullName: 'Sub Branch 1',
          email: 'sub1@branch.com',
          password: 'Password123!',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create sub-agent linked to parent reseller with default wallets', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: parentAgentId,
        role: UserRole.RESELLER,
        isActive: true,
      });
      mockPrisma.user.findFirst.mockResolvedValue(null); // No duplicate email/phone
      mockPrisma.user.create.mockResolvedValue({
        id: 'subagent-001',
        fullName: 'Sub Branch 1',
        email: 'sub1@branch.com',
        role: UserRole.SUB_AGENT,
        parentAgentId,
        isActive: true,
      });

      const result = await subAgentsService.create(parentAgentId, {
        fullName: 'Sub Branch 1',
        email: 'sub1@branch.com',
        password: 'SecureBranchPassword123!',
        parentCommissionPercent: 2.5,
      });

      expect(result.id).toBe('subagent-001');
      expect(result.role).toBe(UserRole.SUB_AGENT);
      expect(result.parentAgentId).toBe(parentAgentId);
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: UserRole.SUB_AGENT,
            parentAgentId,
            passwordHash: 'mocked_argon2_hash',
            wallets: {
              create: [
                { currency: 'YER' },
                { currency: 'USD' },
                { currency: 'SAR' },
              ],
            },
          }),
        }),
      );
    });

    it('should enforce data isolation: reseller cannot update or see another reseller sub-agent', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: parentAgentId,
        role: UserRole.RESELLER,
        isActive: true,
      });
      // Branch does NOT belong to this reseller
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        subAgentsService.update(parentAgentId, 'foreign-subagent-999', {
          isActive: false,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should set custom branch price above cost and switch pricing mode', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: parentAgentId,
        role: UserRole.RESELLER,
        isActive: true,
      });
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'subagent-001',
        parentAgentId,
      });
      mockPrisma.productPrice.findUnique.mockResolvedValue({
        costPrice: 5.0,
        retailPrice: 6.0,
        isAvailable: true,
      });
      mockPrisma.agentProductPrice.upsert.mockResolvedValue({
        id: 'app-001',
        subAgentUserId: 'subagent-001',
        productId: 'prod-uc-60',
        currency: 'USD',
        retailPrice: 5.5,
      });

      const res = await subAgentsService.setCustomPrice(parentAgentId, 'subagent-001', {
        productId: 'prod-uc-60',
        currency: CurrencyCode.USD,
        retailPrice: 5.5,
      });

      expect(res.id).toBe('app-001');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'subagent-001' },
        data: { agentPricingMode: 'CUSTOM_PRICE' },
      });
    });

    it('should calculate reports strictly for this reseller branches only', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: parentAgentId,
        role: UserRole.RESELLER,
        isActive: true,
      });
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'sub-1', fullName: 'Branch Sanaa', isActive: true },
        { id: 'sub-2', fullName: 'Branch Aden', isActive: true },
      ]);
      mockPrisma.order.groupBy.mockResolvedValue([
        {
          userId: 'sub-1',
          _count: { _all: 10 },
          _sum: { snapshotRetailPrice: 150.0, agentCommissionAmount: 7.5 },
        },
      ]);
      mockPrisma.order.count.mockResolvedValue(10);

      const report = await subAgentsService.reports(parentAgentId);
      expect(report.branches).toHaveLength(2);
      expect(report.branches[0].orders).toBe(10);
      expect(report.branches[0].sales).toBe(150.0);
      expect(report.branches[0].commissions).toBe(7.5);
      expect(report.branches[1].orders).toBe(0);
      expect(report.totals.completedOrders).toBe(10);
      expect(report.totals.sales).toBe(150.0);
      expect(report.totals.commissions).toBe(7.5);
    });
  });
});
