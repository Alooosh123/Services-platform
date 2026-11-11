import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UserRole } from '@digital-topup/shared';
import * as argon2 from 'argon2';
import { CreateSubAgentDto } from './dto/create-sub-agent.dto';
import { SetAgentPriceDto } from './dto/set-agent-price.dto';
import { UpdateSubAgentDto } from './dto/update-sub-agent.dto';

@Injectable()
export class SubAgentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(parentAgentId: string, dto: CreateSubAgentDto) {
    await this.requireReseller(parentAgentId);
    if (!dto.email && !dto.phone) {
      throw new ConflictException('A sub-agent must have an email address or phone number.');
    }
    const duplicate = await this.prisma.user.findFirst({
      where: {
        OR: [
          ...(dto.email ? [{ email: dto.email }] : []),
          ...(dto.phone ? [{ phone: dto.phone }] : []),
        ],
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException('An account with this email or phone already exists.');
    }

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    return this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        email: dto.email || null,
        phone: dto.phone || null,
        passwordHash,
        role: UserRole.SUB_AGENT,
        parentAgentId,
        isVerified: true,
        isActive: true,
        agentPricingMode: dto.pricingMode,
        parentAgentCommissionPercent: dto.parentCommissionPercent ?? 0,
        wallets: {
          create: [
            { currency: 'YER' },
            { currency: 'USD' },
            { currency: 'SAR' },
          ],
        },
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        parentAgentId: true,
        agentPricingMode: true,
        parentAgentCommissionPercent: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async list(parentAgentId: string) {
    await this.requireReseller(parentAgentId);
    return this.prisma.user.findMany({
      where: { parentAgentId, role: UserRole.SUB_AGENT },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        tierId: true,
        agentPricingMode: true,
        parentAgentCommissionPercent: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async update(parentAgentId: string, subAgentId: string, dto: UpdateSubAgentDto) {
    await this.requireOwnedSubAgent(parentAgentId, subAgentId);
    return this.prisma.user.update({
      where: { id: subAgentId },
      data: {
        ...(dto.pricingMode !== undefined && { agentPricingMode: dto.pricingMode }),
        ...(dto.parentCommissionPercent !== undefined && {
          parentAgentCommissionPercent: dto.parentCommissionPercent,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      select: {
        id: true,
        fullName: true,
        role: true,
        parentAgentId: true,
        agentPricingMode: true,
        parentAgentCommissionPercent: true,
        isActive: true,
      },
    });
  }

  async setCustomPrice(parentAgentId: string, subAgentId: string, dto: SetAgentPriceDto) {
    const subAgent = await this.requireOwnedSubAgent(parentAgentId, subAgentId);
    const basePrice = await this.prisma.productPrice.findFirst({
      where: { productId: dto.productId, currency: dto.currency },
      select: { retailPrice: true, costPrice: true, isAvailable: true },
    });
    if (!basePrice || !basePrice.isAvailable) {
      throw new NotFoundException('Available base price for this product and currency was not found.');
    }
    if (Number(basePrice.retailPrice) <= 0) {
      throw new ConflictException('Base product price must be positive.');
    }
    if (dto.retailPrice < Number(basePrice.costPrice)) {
      throw new ConflictException('Custom branch price cannot be below the product cost.');
    }

    const price = await this.prisma.agentProductPrice.upsert({
      where: {
        subAgentUserId_productId_currency: {
          subAgentUserId: subAgent.id,
          productId: dto.productId,
          currency: dto.currency,
        },
      },
      create: {
        subAgentUserId: subAgent.id,
        productId: dto.productId,
        currency: dto.currency,
        retailPrice: dto.retailPrice,
      },
      update: { retailPrice: dto.retailPrice, isActive: true },
    });
    await this.prisma.user.update({
      where: { id: subAgentId },
      data: { agentPricingMode: 'CUSTOM_PRICE' },
    });
    return price;
  }

  async reports(parentAgentId: string) {
    await this.requireReseller(parentAgentId);
    const branches = await this.prisma.user.findMany({
      where: { parentAgentId, role: UserRole.SUB_AGENT },
      select: { id: true, fullName: true, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    const branchIds = branches.map((branch) => branch.id);
    if (branchIds.length === 0) {
      return { branches: [], totals: { completedOrders: 0, sales: 0, commissions: 0 } };
    }
    const [orders, completedOrders] = await Promise.all([
      this.prisma.order.groupBy({
        by: ['userId'],
        where: { userId: { in: branchIds }, status: 'Completed' },
        _count: { _all: true },
        _sum: { snapshotRetailPrice: true, agentCommissionAmount: true },
      }),
      this.prisma.order.count({
        where: { userId: { in: branchIds }, status: 'Completed' },
      }),
    ]);

    const reportByUser = new Map(orders.map((row) => [row.userId, row]));
    const result = branches.map((branch) => {
      const report = reportByUser.get(branch.id);
      return {
        ...branch,
        orders: report?._count._all ?? 0,
        sales: Number(report?._sum.snapshotRetailPrice ?? 0),
        commissions: Number(report?._sum.agentCommissionAmount ?? 0),
      };
    });
    return {
      branches: result,
      totals: {
        completedOrders,
        sales: result.reduce((sum, branch) => sum + branch.sales, 0),
        commissions: result.reduce((sum, branch) => sum + branch.commissions, 0),
      },
    };
  }

  private async requireReseller(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, isActive: true },
    });
    if (!user || !user.isActive || user.role !== UserRole.RESELLER) {
      throw new ForbiddenException('An active reseller account is required.');
    }
    return user;
  }

  private async requireOwnedSubAgent(parentAgentId: string, subAgentId: string) {
    await this.requireReseller(parentAgentId);
    const branch = await this.prisma.user.findFirst({
      where: {
        id: subAgentId,
        parentAgentId,
        role: UserRole.SUB_AGENT,
      },
      select: { id: true, parentAgentId: true },
    });
    if (!branch) {
      throw new NotFoundException('Sub-agent not found under this reseller.');
    }
    return branch;
  }
}
