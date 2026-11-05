import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AssignTierDto } from './dto/assign-tier.dto';
import { CreateTierDto } from './dto/create-tier.dto';
import { UpdateTierDto } from './dto/update-tier.dto';
import { SetTierProductPriceDto } from './dto/set-tier-product-price.dto';

@Injectable()
export class TiersService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.tier.findMany({
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      include: { _count: { select: { users: true, productPrices: true } } },
    });
  }

  async create(dto: CreateTierDto) {
    try {
      return await this.prisma.tier.create({ data: dto });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(`Tier code "${dto.code}" already exists.`);
      }
      throw error;
    }
  }

  async update(tierId: string, dto: UpdateTierDto) {
    await this.requireTier(tierId);
    try {
      return await this.prisma.tier.update({ where: { id: tierId }, data: dto });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(`Tier code "${dto.code}" already exists.`);
      }
      throw error;
    }
  }

  async assignUser(userId: string, dto: AssignTierDto) {
    await this.requireTier(dto.tierId);
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: { tierId: dto.tierId },
      select: { id: true, fullName: true, email: true, phone: true, role: true, tierId: true },
    });
  }

  async listProductPrices(tierId: string) {
    await this.requireTier(tierId);
    return this.prisma.productTierPrice.findMany({
      where: { tierId },
      include: {
        product: { select: { id: true, sku: true, name: true, nameAr: true } },
      },
      orderBy: [{ productId: 'asc' }, { currency: 'asc' }],
    });
  }

  async setProductPrice(tierId: string, dto: SetTierProductPriceDto) {
    const tier = await this.requireTier(tierId);
    if (!tier.isActive) {
      throw new ConflictException('Cannot configure prices for an inactive tier.');
    }

    const basePrice = await this.prisma.productPrice.findUnique({
      where: {
        productId_currency: {
          productId: dto.productId,
          currency: dto.currency,
        },
      },
      select: { costPrice: true, isAvailable: true },
    });
    if (!basePrice || !basePrice.isAvailable) {
      throw new NotFoundException('Available base price for this product and currency was not found.');
    }
    if (dto.retailPrice < Number(basePrice.costPrice)) {
      throw new ConflictException('Tier price cannot be below the product cost.');
    }

    return this.prisma.productTierPrice.upsert({
      where: {
        productId_tierId_currency: {
          productId: dto.productId,
          tierId,
          currency: dto.currency,
        },
      },
      create: {
        productId: dto.productId,
        tierId,
        currency: dto.currency,
        retailPrice: dto.retailPrice,
        agentCommissionPercent: dto.agentCommissionPercent ?? 0,
      },
      update: {
        retailPrice: dto.retailPrice,
        agentCommissionPercent: dto.agentCommissionPercent ?? 0,
        isActive: true,
      },
    });
  }

  private async requireTier(tierId: string) {
    const tier = await this.prisma.tier.findUnique({ where: { id: tierId } });
    if (!tier) {
      throw new NotFoundException('Tier not found.');
    }
    return tier;
  }

  private isUniqueViolation(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error &&
      (error as { code?: string }).code === 'P2002';
  }
}
