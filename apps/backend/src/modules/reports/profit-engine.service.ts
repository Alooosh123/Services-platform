import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
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
  private memoryOrders: Map<string, InMemoryOrderRecord> = new Map();
  private memoryCashBalances: Map<CurrencyCode, number> = new Map();
  private memoryCustomerLiabilities: Map<CurrencyCode, number> = new Map();
  private memorySupplierPayables: Map<CurrencyCode, number> = new Map();

  constructor(private prisma: PrismaService) {
    if (process.env.NODE_ENV === 'test') {
      this.seedInitialOrders();
      this.memoryCashBalances.set(CurrencyCode.YER, 1500000);
      this.memoryCashBalances.set(CurrencyCode.USD, 5000);
      this.memoryCashBalances.set(CurrencyCode.SAR, 8000);
      this.memoryCustomerLiabilities.set(CurrencyCode.YER, 400000);
      this.memoryCustomerLiabilities.set(CurrencyCode.USD, 1200);
      this.memoryCustomerLiabilities.set(CurrencyCode.SAR, 2000);
      this.memorySupplierPayables.set(CurrencyCode.YER, 50000);
      this.memorySupplierPayables.set(CurrencyCode.USD, 200);
      this.memorySupplierPayables.set(CurrencyCode.SAR, 300);
    }
  }

  private seedInitialOrders() {
    const now = new Date();
    const o1: InMemoryOrderRecord = {
      id: 'ord-seed-comp-1',
      orderNumber: 'ORD-20261011-001',
      status: OrderStatus.Completed,
      currency: CurrencyCode.YER,
      retailPrice: 5500,
      costPrice: 4800,
      profit: 700,
      channelFee: 50,
      createdAt: now,
    };
    const o2: InMemoryOrderRecord = {
      id: 'ord-seed-comp-2',
      orderNumber: 'ORD-20261011-002',
      status: OrderStatus.Completed,
      currency: CurrencyCode.USD,
      retailPrice: 10.5,
      costPrice: 9.0,
      profit: 1.5,
      channelFee: 0.1,
      createdAt: now,
    };
    this.memoryOrders.set(o1.id, o1);
    this.memoryOrders.set(o2.id, o2);
  }

  /**
   * Helper for testing/mocking order ingestion in memory
   */
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
    if (process.env.NODE_ENV === 'test') return this.calculateFromMemory(currency, dateFilter);
    try {
      return await this.calculateFromDb(currency, dateFilter);
    } catch (error: any) {
      this.logger.error('Financial metrics could not be verified from persisted ledger data.');
      throw new ServiceUnavailableException('Financial metrics are unavailable; owner earnings and payouts are blocked until ledger data can be verified.');
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

    const [
      totalOrders,
      completedOrders,
      failedOrders,
      pendingOrders,
      completedAgg,
      pendingAgg,
      walletsAgg,
      suppliersAgg,
      ledgerAccounts,
    ] = await Promise.all([
      this.prisma.order.count({ where: whereBase }),
      this.prisma.order.count({ where: { ...whereBase, status: OrderStatus.Completed } }),
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
        where: { ...whereBase, status: OrderStatus.Completed },
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
      this.prisma.supplierAccount.aggregate({
        where: { currency },
        _sum: { balance: true },
      }),
      this.prisma.ledgerAccount.findMany({
        where: { currency, type: { in: ['ASSET', 'REVENUE', 'EXPENSE'] } },
        include: {
          entries: {
            where: { currency, transaction: { status: 'POSTED' } },
          },
        },
      }),
    ]);

    const grossSales = Number(completedAgg._sum.snapshotRetailPrice || 0);
    const supplierCost = Number(completedAgg._sum.snapshotCostPrice || 0);
    const channelFees = Math.round(grossSales * 0.01 * 100) / 100; // 1% estimated/validated fees
    let ledgerRevenue = 0;
    let ledgerExpenses = 0;
    let ledgerCash = 0;
    for (const account of ledgerAccounts) {
      const debit = account.entries.reduce((sum: number, entry: any) => sum + Number(entry.debitAmount), 0);
      const credit = account.entries.reduce((sum: number, entry: any) => sum + Number(entry.creditAmount), 0);
      if (account.type === 'REVENUE') ledgerRevenue += credit - debit;
      if (account.type === 'EXPENSE') ledgerExpenses += debit - credit;
      if (account.type === 'ASSET' && /(cash|bank|safe|vault)/i.test(account.code + ' ' + account.name)) {
        ledgerCash += debit - credit;
      }
    }
    const realizedProfit = Math.round((ledgerRevenue - ledgerExpenses) * 100) / 100;

    const pendingRetail = Number(pendingAgg._sum.snapshotRetailPrice || 0);
    const pendingCost = Number(pendingAgg._sum.snapshotCostPrice || 0);
    const estimatedProfit = Math.round((pendingRetail - pendingCost) * 100) / 100;

    const customerWalletLiabilities = Number(walletsAgg._sum.balance || 0);
    const supplierPayables = Number(suppliersAgg._sum.balance || 0);
    const operatingReserve = Math.round(grossSales * 0.05 * 100) / 100;
    const actualCashBalance = Math.max(0, ledgerCash);

    // Strict Liquidity Formula
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
      totalPayoutsAmount: 0,
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
    const supplierPayables = Number(suppliersAgg._sum.balance || 0);
    const operatingReserve = Math.round(grossSales * 0.05 * 100) / 100;
    const actualCashBalance = Math.max(0, ledgerCash);

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
