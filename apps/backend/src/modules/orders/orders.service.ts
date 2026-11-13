import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { ProductsService } from '../products/products.service';
import { FulfillmentService } from '../providers/fulfillment.service';
import { PilotService } from '../pilot/pilot.service';
import { CreateOrderDto, RetryOrderDto } from './dto/create-order.dto';
import {
  OrderStatus,
  CurrencyCode,
  PaymentChannelCode,
  UserRole,
  ManualFulfillmentDto,
  OrderRefundDto,
} from '@digital-topup/shared';
import { Prisma } from '@prisma/client';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private readonly userOrderTimestamps = new Map<string, number[]>();

  constructor(
    private prisma: PrismaService,
    private ledgerService: LedgerService,
    private productsService: ProductsService,
    private fulfillmentService: FulfillmentService,
    @Optional() private pilotService?: PilotService,
  ) {}

  /**
   * Complete topup checkout flow with atomic balance hold, immutable snapshotting, and decoupled fulfillment.
   */
  async createOrder(userId: string, dto: CreateOrderDto) {
    // Anti-Fraud Velocity Limit: Max 10 orders per minute
    const now = Date.now();
    const timestamps = (this.userOrderTimestamps.get(userId) || []).filter((t) => now - t < 60000);
    if (timestamps.length >= 10) {
      throw new BadRequestException(
        'تم تجاوز حد السرعة المسموح للطلبات (أقصى حد: 10 طلبات في الدقيقة). يرجى الانتظار قليلاً.',
      );
    }
    timestamps.push(now);
    this.userOrderTimestamps.set(userId, timestamps);

    // 1. Idempotency Check: Return existing order if identical key was already submitted
    const existingOrder = await this.prisma.order.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
      include: {
        product: true,
        service: true,
        statusHistory: { orderBy: { createdAt: 'desc' } },
        manualFulfillment: true,
      },
    });

    if (existingOrder) {
      this.logger.warn(`Duplicate order attempt suppressed via idempotency key: ${dto.idempotencyKey}`);
      return existingOrder;
    }

    // 2. Fetch Product, Prices, and Service
    const targetProductId = dto.productId || dto.packageId;
    if (!targetProductId) {
      throw new BadRequestException('productId must be specified');
    }

    const product = await this.prisma.product.findUnique({
      where: { id: targetProductId },
      include: {
        prices: true,
        service: {
          include: { fields: true },
        },
      },
    });

    if (!product || !product.isAvailable) {
      throw new NotFoundException('Selected product is unavailable');
    }

    const currency = dto.currency || CurrencyCode.YER;
    const priceConfig = product.prices.find((p) => p.currency === currency && p.isAvailable);
    if (!priceConfig) {
      throw new BadRequestException(`Price not configured for currency ${currency}`);
    }

    const checkoutUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        tierId: true,
        tier: { select: { defaultDiscountPercent: true, isActive: true } },
        parentAgentId: true,
        agentPricingMode: true,
        parentAgentCommissionPercent: true,
        parentAgent: { select: { id: true, tierId: true, isActive: true } },
      },
    });
    if (!checkoutUser) {
      throw new NotFoundException('Customer account not found');
    }

    const [tierPrice, branchPrice, parentTierPrice] = await Promise.all([
      checkoutUser.tierId
        ? this.prisma.productTierPrice.findFirst({
            where: { productId: product.id, tierId: checkoutUser.tierId, currency },
          })
        : Promise.resolve(null),
      checkoutUser.role === UserRole.SUB_AGENT && checkoutUser.agentPricingMode === 'CUSTOM_PRICE'
        ? this.prisma.agentProductPrice.findUnique({
            where: {
              subAgentUserId_productId_currency: {
                subAgentUserId: userId,
                productId: product.id,
                currency,
              },
            },
          })
        : Promise.resolve(null),
      checkoutUser.parentAgent?.tierId
        ? this.prisma.productTierPrice.findFirst({
            where: { productId: product.id, tierId: checkoutUser.parentAgent.tierId, currency },
          })
        : Promise.resolve(null),
    ]);

    if (tierPrice && !tierPrice.isActive) {
      throw new BadRequestException('The assigned tier price is currently unavailable.');
    }
    if (checkoutUser.tier && !checkoutUser.tier.isActive) {
      throw new BadRequestException('The assigned customer tier is inactive.');
    }
    if (
      checkoutUser.role === UserRole.SUB_AGENT &&
      checkoutUser.agentPricingMode === 'CUSTOM_PRICE' &&
      (!branchPrice || !branchPrice.isActive)
    ) {
      throw new BadRequestException('A custom branch price is not configured for this product and currency.');
    }

    // 3. Dynamic Field Validation (Zero Trust on client submitted data)
    this.productsService.validateSubmittedPlayerFields(product.service.fields, dto.playerFields);

    // Pricing is resolved from server-side Decimal values; never use JS floating point.
    const zero = new Prisma.Decimal(0);
    const hundred = new Prisma.Decimal(100);
    const costPriceDecimal = new Prisma.Decimal(priceConfig.costPrice);
    const configuredRetailPrice = new Prisma.Decimal(priceConfig.retailPrice);
    const discountPercent = new Prisma.Decimal(checkoutUser.tier?.defaultDiscountPercent ?? 0);
    if (discountPercent.isNegative() || discountPercent.greaterThan(100)) {
      throw new BadRequestException('Customer tier discount must be between 0 and 100 percent.');
    }

    const tierRetailPriceDecimal = tierPrice
      ? new Prisma.Decimal(tierPrice.retailPrice)
      : configuredRetailPrice
          .mul(hundred.minus(discountPercent))
          .div(hundred)
          .toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
    const retailPriceDecimal = branchPrice
      ? new Prisma.Decimal(branchPrice.retailPrice)
      : tierRetailPriceDecimal;
    const profitDecimal = retailPriceDecimal.minus(costPriceDecimal);

    if (
      !retailPriceDecimal.isFinite() ||
      !costPriceDecimal.isFinite() ||
      !retailPriceDecimal.greaterThan(0) ||
      costPriceDecimal.isNegative() ||
      retailPriceDecimal.decimalPlaces() > 4 ||
      costPriceDecimal.decimalPlaces() > 4 ||
      retailPriceDecimal.greaterThan('99999999999999.9999') ||
      costPriceDecimal.greaterThan('99999999999999.9999') ||
      profitDecimal.isNegative()
    ) {
      throw new BadRequestException('Configured tier or branch price cannot be below product cost or exceed DECIMAL(18,4).');
    }

    let agentCommissionAmountDecimal = zero;
    const agentParentUserId =
      checkoutUser.role === UserRole.SUB_AGENT && checkoutUser.parentAgent?.isActive
        ? checkoutUser.parentAgent.id
        : null;
    if (agentParentUserId && profitDecimal.greaterThan(0)) {
      if (branchPrice) {
        const parentRetailPriceDecimal = parentTierPrice?.isActive
          ? new Prisma.Decimal(parentTierPrice.retailPrice)
          : configuredRetailPrice;
        const branchPremium = retailPriceDecimal.minus(parentRetailPriceDecimal);
        if (branchPremium.greaterThan(0)) {
          agentCommissionAmountDecimal = branchPremium.greaterThan(profitDecimal)
            ? profitDecimal
            : branchPremium;
        }
      } else {
        const commissionPercent = parentTierPrice?.isActive
          ? new Prisma.Decimal(parentTierPrice.agentCommissionPercent)
          : new Prisma.Decimal(checkoutUser.parentAgentCommissionPercent ?? 0);
        if (commissionPercent.isNegative() || commissionPercent.greaterThan(100)) {
          throw new BadRequestException('Reseller commission percent must be between 0 and 100.');
        }
        agentCommissionAmountDecimal = profitDecimal
          .mul(commissionPercent)
          .div(hundred)
          .toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
      }
    }
    const paymentMethod = dto.paymentMethod || PaymentChannelCode.WALLET;

    // Phase 11 Pilot Enforcement: Validate order amount and cohort restrictions
    if (this.pilotService) {
      await this.pilotService.validateOrderAgainstPilot(
        userId,
        retailPriceDecimal.toString(),
        currency,
        product.id,
        paymentMethod,
      );
    }

    // 4. Generate Internal Order Number
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `ORD-${Date.now()}-${randomSuffix}`;

    let walletRecord: any = null;

    // 5. Payment Validation & Atomic Balance Reservation
    if (paymentMethod === PaymentChannelCode.WALLET) {
      // Find customer wallet for this currency
      walletRecord = await this.prisma.wallet.findUnique({
        where: {
          userId_currency: {
            userId,
            currency,
          },
        },
      });

      if (!walletRecord) {
        throw new BadRequestException(`Customer wallet not found for currency ${currency}`);
      }

      // Atomically hold balance in lockedBalance (prevents double-spending & validates freezing/balance)
      await this.ledgerService.holdWalletBalance(walletRecord.id, retailPriceDecimal.toString());
    }

    const initialStatus = paymentMethod === PaymentChannelCode.WALLET
      ? OrderStatus.Queued
      : OrderStatus.AwaitingPayment;

    // 6. Create Order with Immutable Snapshots
    const order = await this.prisma.order.create({
      data: {
        orderNumber,
        userId,
        serviceId: product.serviceId,
        productId: product.id,
        status: initialStatus,
        snapshotServiceName: product.service.name,
        snapshotServiceNameAr: product.service.nameAr,
        snapshotProductName: product.name,
        snapshotProductNameAr: product.nameAr,
        snapshotRetailPrice: retailPriceDecimal,
        snapshotCostPrice: costPriceDecimal,
        snapshotProfit: profitDecimal,
        snapshotCurrency: currency,
        snapshotBeneficiaryFields: dto.playerFields as any,
        snapshotPaymentMethodCode: paymentMethod,
        agentParentUserId,
        agentCommissionAmount: agentCommissionAmountDecimal,
        idempotencyKey: dto.idempotencyKey,
        statusHistory: {
          create: {
            oldStatus: OrderStatus.AwaitingPayment,
            newStatus: initialStatus,
            reason: paymentMethod === PaymentChannelCode.WALLET
              ? 'Wallet funds reserved in locked balance. Enqueued for fulfillment.'
              : `Awaiting payment confirmation via ${paymentMethod}`,
            changedByUserId: userId,
          },
        },
      },
      include: {
        service: true,
        product: true,
        statusHistory: true,
      },
    });

    // 7. If paid via WALLET, dispatch through fulfillment engine
    if (paymentMethod === PaymentChannelCode.WALLET) {
      await this.fulfillmentService.dispatchOrder(order.id);
    }

    // Return the latest refreshed order record
    return this.prisma.order.findUnique({
      where: { id: order.id },
      include: {
        service: true,
        product: true,
        manualFulfillment: true,
        statusHistory: { orderBy: { createdAt: 'desc' } },
      },
    });
  }

  /**
   * Get single order by ID or orderNumber with strict customer isolation.
   */
  async getOrderById(userId: string, orderIdentifier: string, isStaff = false) {
    const order = await this.prisma.order.findFirst({
      where: {
        OR: [
          { id: orderIdentifier },
          { orderNumber: orderIdentifier },
        ],
      },
      include: {
        service: true,
        product: true,
        manualFulfillment: {
          include: { assignedOperator: { select: { fullName: true } } },
        },
        statusHistory: { orderBy: { createdAt: 'asc' } },
        user: { select: { id: true, fullName: true, email: true, phone: true } },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderIdentifier} not found`);
    }

    if (!isStaff && order.userId !== userId) {
      try {
        await this.prisma.auditLog.create({
          data: {
            userId,
            action: 'BOLA_VIOLATION_ATTEMPT',
            entityName: 'Order',
            entityId: orderIdentifier,
            newValues: { attemptedBy: userId, actualOwner: order.userId },
          },
        });
      } catch {}
      throw new ForbiddenException('ليس لديك صلاحية لعرض هذا الطلب');
    }

    return order;
  }

  /**
   * Customer order history with status filter and pagination.
   */
  async getMyOrders(userId: string, page = 1, limit = 20, status?: OrderStatus) {
    const skip = (page - 1) * limit;
    const where: Prisma.OrderWhereInput = { userId };
    if (status) where.status = status;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          service: true,
          product: true,
          manualFulfillment: true,
          statusHistory: { orderBy: { createdAt: 'desc' } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Admin order list with comprehensive filters
   */
  async getAdminOrders(params: {
    status?: OrderStatus;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {};
    if (params.status) where.status = params.status;
    if (params.search) {
      where.OR = [
        { orderNumber: { contains: params.search, mode: 'insensitive' } },
        { user: { email: { contains: params.search, mode: 'insensitive' } } },
        { user: { phone: { contains: params.search, mode: 'insensitive' } } },
        { user: { fullName: { contains: params.search, mode: 'insensitive' } } },
      ];
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, fullName: true, email: true, phone: true } },
          service: true,
          product: true,
          manualFulfillment: {
            include: { assignedOperator: { select: { fullName: true } } },
          },
          statusHistory: { orderBy: { createdAt: 'desc' } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Admin manual fulfillment of an order with voucher code and screenshot proof.
   */
  async adminManualFulfill(staffId: string, orderId: string, dto: ManualFulfillmentDto) {
    return this.fulfillmentService.fulfillManualOrder(staffId, orderId, dto);
  }

  /**
   * Admin refund order with double-entry reversal.
   */
  async adminRefundOrder(staffId: string, orderId: string, dto: OrderRefundDto) {
    return this.fulfillmentService.refundOrder(staffId, orderId, dto);
  }

  /**
   * Admin retry execution for failed or unknown orders.
   */
  async adminRetryOrder(staffUserId: string, orderId: string, dto: RetryOrderDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { user: { include: { wallets: true } } },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const currency = order.snapshotCurrency as CurrencyCode;
    const wallet = order.user.wallets.find((w) => w.currency === currency);
    if (!wallet) {
      throw new NotFoundException(`Wallet not found for currency ${currency}`);
    }

    // If order was marked as FAILED and balance hold was released, we must hold balance again before retrying
    if (order.status === OrderStatus.Failed) {
      await this.ledgerService.holdWalletBalance(wallet.id, order.snapshotRetailPrice.toString());
    }

    // Re-dispatch through fulfillment engine
    await this.fulfillmentService.dispatchOrder(orderId);

    return this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        service: true,
        product: true,
        manualFulfillment: true,
        statusHistory: { orderBy: { createdAt: 'desc' } },
      },
    });
  }
}
