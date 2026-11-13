import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CurrencyCode, OrderStatus, CurrencyCloseMetrics } from '@digital-topup/shared';

export interface InMemoryOrderRecord {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  currency: CurrencyCode;
  retailPrice: number;
  costPrice: number;
  profit: number;
  channelFee: number;
  createdAt: Date;
}

@Injectable()
export class ProfitEngineService {
  private readonly logger = new Logger(ProfitEngineService.name);
  // Memory injection remains available to isolated unit tests only; it is never seeded.
  private memoryOrders: Map<string, InMemoryOrderRecord> = new Map();
  private memoryCashBalances: Map<CurrencyCode, number> = new Map();
  private memoryCustomerLiabilities: Map<CurrencyCode, number> = new Map();
  private memorySupplierPayables: Map<CurrencyCode, number> = new Map();

  constructor(private prisma: PrismaService) {}

  addMemoryOrder(order: InMemoryOrderRecord) {
    this.memoryOrders.set(order.id, order);
  }

  clearMemoryOrders() {
    this.memoryOrders.clear();
  }

  setMemoryCashBalance(currency: CurrencyCode, amount: number) {
    this.memoryCashBalances.set(currency, amount);
  }

  setMemoryCustomerLiabilities(currency: CurrencyCode, amount: number) {
    this.memoryCustomerLiabilities.set(currency, amount);
  }

  /**
   * Calculate full profit & liquidity metrics for a given currency and optional date filter
   * Strictly enforces:
   * 1. Estimated Profit for unfulfilled orders (Processing / Queued / ManualReview)
   * 2. Realized Profit ONLY for Completed & settled orders
   * 3. Withdrawable Liquidity = min(Realized Profit, Actual Cash - Customer Liabilities - Supplier Payables - Operating Reserve)
   */
  async calculateMetricsForCurrency(
    currency: CurrencyCode,
    dateFilter?: string, // YYYY-MM-DD
  ): Promise<CurrencyCloseMetrics> {
    if (process.env.NODE_ENV !== 'production' &&
        (this.memoryOrders.size > 0 || this.memoryCashBalances.size > 0)) {
      return this.calculateFromMemory(currency, dateFilter);
    }
    try {
      return await this.calculateFromDb(currency, dateFilter);
    } catch (error) {
      this.logger.error(`Profit calculation failed closed: ${(error as Error)?.message || error}`);
      throw error;
    }
  }

  private async calculateFromDb(
    currency: CurrencyCode,
    dateFilter?: string,
  ): Promise<CurrencyCloseMetrics> {
    const whereBase: any = { snapshotCurrency: currency };
    if (dateFilter) {
      const startOfDay = new Date(`${dateFilter}T00:00:00.000Z`);
      const endOfDay = new Date(`${dateFilter}T23:59:59.999Z`);
      whereBase.createdAt = { gte: startOfDay, lte: endOfDay };
    }

    const settledOrderRefs = await this.prisma.ledgerTransaction.findMany({
      where: {
        referenceType: 'ORDER',
        status: 'POSTED',
        referenceId: {
          in: (await this.prisma.order.findMany({
            where: { ...whereBase, status: OrderStatus.Completed },
            select: { orderNumber: true },
          })).map((order) => order.orderNumber),
        },
      },
      select: { referenceId: true },
    });
    const financiallySettledOrderNumbers = [...new Set(settledOrderRefs.map((row) => row.referenceId).filter(Boolean))];
    const [
      totalOrders,
      completedOrders,
      failedOrders,
      pendingOrders,
      completedAgg,
      pendingAgg,
      walletsAgg,
      supplierAccounts,
      customerPayoutsAgg,
    ] = await Promise.all([
      this.prisma.order.count({ where: whereBase }),
      this.prisma.order.count({
        where: {
          ...whereBase,
          status: OrderStatus.Completed,
          orderNumber: { in: financiallySettledOrderNumbers },
        },
      }),
      this.prisma.order.count({
        where: {
          ...whereBase,
          status: { in: [OrderStatus.Failed, OrderStatus.Cancelled] },
        },
      }),
      this.prisma.order.count({
        where: {
          ...whereBase,
          status: {
            in: [
              OrderStatus.Processing,
              OrderStatus.Queued,
              OrderStatus.ManualReview,
              OrderStatus.AwaitingPayment,
              OrderStatus.PaymentReview,
            ],
          },
        },
      }),
      this.prisma.order.aggregate({
        where: {
          ...whereBase,
          status: OrderStatus.Completed,
          orderNumber: { in: financiallySettledOrderNumbers },
        },
        _sum: {
          snapshotRetailPrice: true,
          snapshotCostPrice: true,
          snapshotProfit: true,
        },
      }),
      this.prisma.order.aggregate({
        where: {
          ...whereBase,
          status: {
            in: [
              OrderStatus.Processing,
              OrderStatus.Queued,
              OrderStatus.ManualReview,
              OrderStatus.AwaitingPayment,
              OrderStatus.PaymentReview,
            ],
          },
        },
        _sum: {
          snapshotRetailPrice: true,
          snapshotCostPrice: true,
          snapshotProfit: true,
        },
      }),
      this.prisma.wallet.aggregate({
        where: { currency },
        _sum: { balance: true },
      }),
      this.prisma.supplierAccount.findMany({
        where: { currency, accountType: 'POSTPAID' },
        select: { balance: true },
      }),
      this.prisma.payoutRequest.aggregate({
        where: { currency, status: 'CONFIRMED' },
        _sum: { amount: true },
      }),
    ]);

    const grossSales = Number(completedAgg._sum.snapshotRetailPrice || 0);
    const supplierCost = Number(completedAgg._sum.snapshotCostPrice || 0);
    // snapshotProfit is the immutable profit snapshot captured at checkout.
    // Do not invent a provider/channel fee percentage during reporting.
    const realizedProfit = Number(completedAgg._sum.snapshotProfit || 0);
    const channelFees = Math.round((grossSales - supplierCost - realizedProfit) * 10000) / 10000;

    const estimatedProfit = Number(pendingAgg._sum.snapshotProfit || 0);
    const customerWalletLiabilities = Number(walletsAgg._sum.balance || 0);
    const supplierPayables = supplierAccounts.reduce((total, account) =>
      total + Math.max(0, -Number(account.balance)), 0);
    const operatingReserve = Math.round(grossSales * 0.05 * 100) / 100;
    const cashAccounts = await this.prisma.ledgerAccount.findMany({
      where: {
        currency,
        type: 'ASSET',
        OR: [
          { code: { startsWith: '100' } },
          { code: '1010-CLEARING-USD' },
          { code: '1011-CLEARING-SAR' },
          { code: '1110-CASH' },
        ],
      },
      include: {
        entries: {
          where: { transaction: { status: 'POSTED' } },
          select: { debitAmount: true, creditAmount: true },
        },
      },
    });
    const actualCashBalance = cashAccounts.reduce(
      (total, account) => total + account.entries.reduce(
        (net, entry) => net + Number(entry.debitAmount) - Number(entry.creditAmount), 0,
      ), 0,
    );
    const totalPayoutsAmount = Number(customerPayoutsAgg._sum.amount || 0);

    const freeCash = actualCashBalance - customerWalletLiabilities - supplierPayables - operatingReserve;
    const withdrawableLiquidity = Math.max(0, Math.round(Math.min(realizedProfit, freeCash) * 100) / 100);

    return {
      currency,
      totalOrdersCount: totalOrders,
      completedOrdersCount: completedOrders,
      failedOrdersCount: failedOrders,
      pendingOrdersCount: pendingOrders,
      grossSales,
      supplierCost,
      channelFees,
      estimatedProfit,
      realizedProfit,
      totalDepositsAmount: actualCashBalance,
      totalPayoutsAmount,
      customerWalletLiabilities,
      supplierPayables,
      operatingReserve,
      actualCashBalance,
      withdrawableLiquidity,
    };
  }

  private calculateFromMemory(
    currency: CurrencyCode,
    dateFilter?: string,
  ): CurrencyCloseMetrics {
    const orders = Array.from(this.memoryOrders.values()).filter((o) => {
      if (o.currency !== currency) return false;
      if (dateFilter) {
        const orderDate = o.createdAt.toISOString().slice(0, 10);
        if (orderDate !== dateFilter) return false;
      }
      return true;
    });

    let totalOrdersCount = orders.length;
    let completedOrdersCount = 0;
    let failedOrdersCount = 0;
    let pendingOrdersCount = 0;

    let grossSales = 0;
    let supplierCost = 0;
    let channelFees = 0;
    let realizedProfit = 0;
    let estimatedProfit = 0;

    for (const o of orders) {
      if (o.status === OrderStatus.Completed) {
        completedOrdersCount++;
        grossSales += o.retailPrice;
        supplierCost += o.costPrice;
        channelFees += o.channelFee;
        realizedProfit += o.profit - o.channelFee;
      } else if (o.status === OrderStatus.Failed || o.status === OrderStatus.Cancelled) {
        failedOrdersCount++;
      } else {
        // Pending fulfillment
        pendingOrdersCount++;
        estimatedProfit += o.retailPrice - o.costPrice;
      }
    }

    grossSales = Math.round(grossSales * 100) / 100;
    supplierCost = Math.round(supplierCost * 100) / 100;
    channelFees = Math.round(channelFees * 100) / 100;
    realizedProfit = Math.round(realizedProfit * 100) / 100;
    estimatedProfit = Math.round(estimatedProfit * 100) / 100;

    const customerWalletLiabilities = this.memoryCustomerLiabilities.get(currency) || 0;
    const supplierPayables = this.memorySupplierPayables.get(currency) || 0;
    const operatingReserve = Math.round(grossSales * 0.05 * 100) / 100;
    const actualCashBalance = this.memoryCashBalances.get(currency) || 0;

    // Strict Liquidity Formula
    const freeCash = actualCashBalance - customerWalletLiabilities - supplierPayables - operatingReserve;
    const withdrawableLiquidity = Math.max(0, Math.round(Math.min(realizedProfit, freeCash) * 100) / 100);

    return {
      currency,
      totalOrdersCount,
      completedOrdersCount,
      failedOrdersCount,
      pendingOrdersCount,
      grossSales,
      supplierCost,
      channelFees,
      estimatedProfit,
      realizedProfit,
      totalDepositsAmount: actualCashBalance,
      totalPayoutsAmount: 0,
      customerWalletLiabilities,
      supplierPayables,
      operatingReserve,
      actualCashBalance,
      withdrawableLiquidity,
    };
  }

  /**
   * Calculate metrics for all 3 supported currencies
   */
  async calculateAllCurrencies(dateFilter?: string): Promise<Record<CurrencyCode, CurrencyCloseMetrics>> {
    const [yer, usd, sar] = await Promise.all([
      this.calculateMetricsForCurrency(CurrencyCode.YER, dateFilter),
      this.calculateMetricsForCurrency(CurrencyCode.USD, dateFilter),
      this.calculateMetricsForCurrency(CurrencyCode.SAR, dateFilter),
    ]);

    return {
      [CurrencyCode.YER]: yer,
      [CurrencyCode.USD]: usd,
      [CurrencyCode.SAR]: sar,
    };
  }
}
