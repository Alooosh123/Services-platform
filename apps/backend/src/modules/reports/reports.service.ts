import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { OrderStatus, CurrencyCode } from '@digital-topup/shared';
import { Prisma } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getDashboardKpis() {
    // 1. Total & Completed Orders Count
    const [totalOrders, completedOrders, failedOrders] = await Promise.all([
      this.prisma.order.count(),
      this.prisma.order.count({ where: { status: OrderStatus.Completed } }),
      this.prisma.order.count({ where: { status: OrderStatus.Failed } }),
    ]);

    // 2. Financial Metrics by Currency
    const [financialYer, financialUsd, financialSar] = await Promise.all([
      this.prisma.order.aggregate({
        where: { status: OrderStatus.Completed, snapshotCurrency: CurrencyCode.YER },
        _sum: {
          snapshotRetailPrice: true,
          snapshotCostPrice: true,
          snapshotProfit: true,
        },
      }),
      this.prisma.order.aggregate({
        where: { status: OrderStatus.Completed, snapshotCurrency: CurrencyCode.USD },
        _sum: {
          snapshotRetailPrice: true,
          snapshotCostPrice: true,
          snapshotProfit: true,
        },
      }),
      this.prisma.order.aggregate({
        where: { status: OrderStatus.Completed, snapshotCurrency: CurrencyCode.SAR },
        _sum: {
          snapshotRetailPrice: true,
          snapshotCostPrice: true,
          snapshotProfit: true,
        },
      }),
    ]);

    // 3. Total Registered Customers
    const totalCustomers = await this.prisma.user.count({
      where: { role: 'CUSTOMER' },
    });

    // 4. Total Customer Balance Held in Wallets per Currency
    const [yerWallets, usdWallets, sarWallets] = await Promise.all([
      this.prisma.wallet.aggregate({
        where: { currency: CurrencyCode.YER },
        _sum: { balance: true },
      }),
      this.prisma.wallet.aggregate({
        where: { currency: CurrencyCode.USD },
        _sum: { balance: true },
      }),
      this.prisma.wallet.aggregate({
        where: { currency: CurrencyCode.SAR },
        _sum: { balance: true },
      }),
    ]);

    // 5. Recent 10 Orders
    const recentOrders = await this.prisma.order.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { fullName: true, email: true, phone: true } },
        service: true,
        product: true,
      },
    });

    return {
      kpis: {
        totalOrders,
        completedOrders,
        failedOrders,
        successRate: totalOrders > 0 ? ((completedOrders / totalOrders) * 100).toFixed(1) : '100.0',
        totalCustomers,
        financialByCurrency: {
          YER: {
            revenue: Number(financialYer._sum.snapshotRetailPrice || 0),
            cost: Number(financialYer._sum.snapshotCostPrice || 0),
            profit: Number(financialYer._sum.snapshotProfit || 0),
            walletLiabilities: Number(yerWallets._sum.balance || 0),
          },
          USD: {
            revenue: Number(financialUsd._sum.snapshotRetailPrice || 0),
            cost: Number(financialUsd._sum.snapshotCostPrice || 0),
            profit: Number(financialUsd._sum.snapshotProfit || 0),
            walletLiabilities: Number(usdWallets._sum.balance || 0),
          },
          SAR: {
            revenue: Number(financialSar._sum.snapshotRetailPrice || 0),
            cost: Number(financialSar._sum.snapshotCostPrice || 0),
            profit: Number(financialSar._sum.snapshotProfit || 0),
            walletLiabilities: Number(sarWallets._sum.balance || 0),
          },
        },
      },
      recentOrders,
    };
  }

  /**
   * Phase 3 Module 10: Comprehensive Profit, Sales, COGS & Provider Performance Report
   */
  async getProfitAndPerformanceReport(params: {
    dateRange?: 'today' | '7d' | '30d' | 'all';
    providerId?: string;
  }) {
    const where: Prisma.OrderWhereInput = {};

    // Date range filter
    if (params.dateRange && params.dateRange !== 'all') {
      const now = new Date();
      let fromDate = new Date();
      if (params.dateRange === 'today') {
        fromDate.setHours(0, 0, 0, 0);
      } else if (params.dateRange === '7d') {
        fromDate.setDate(now.getDate() - 7);
      } else if (params.dateRange === '30d') {
        fromDate.setDate(now.getDate() - 30);
      }
      where.createdAt = { gte: fromDate };
    }

    if (params.providerId) {
      where.providerId = params.providerId;
    }

    // 1. Order status counts
    const [
      totalCount,
      completedCount,
      processingCount,
      manualReviewCount,
      failedCount,
      refundedCount,
    ] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.count({ where: { ...where, status: OrderStatus.Completed } }),
      this.prisma.order.count({ where: { ...where, status: OrderStatus.Processing } }),
      this.prisma.order.count({ where: { ...where, status: OrderStatus.ManualReview } }),
      this.prisma.order.count({ where: { ...where, status: OrderStatus.Failed } }),
      this.prisma.order.count({ where: { ...where, status: OrderStatus.Refunded } }),
    ]);

    // 2. Realized sales, COGS, and profit per currency
    const [salesYer, salesUsd, salesSar] = await Promise.all([
      this.prisma.order.aggregate({
        where: { ...where, status: OrderStatus.Completed, snapshotCurrency: CurrencyCode.YER },
        _sum: { snapshotRetailPrice: true, snapshotCostPrice: true, snapshotProfit: true },
        _count: true,
      }),
      this.prisma.order.aggregate({
        where: { ...where, status: OrderStatus.Completed, snapshotCurrency: CurrencyCode.USD },
        _sum: { snapshotRetailPrice: true, snapshotCostPrice: true, snapshotProfit: true },
        _count: true,
      }),
      this.prisma.order.aggregate({
        where: { ...where, status: OrderStatus.Completed, snapshotCurrency: CurrencyCode.SAR },
        _sum: { snapshotRetailPrice: true, snapshotCostPrice: true, snapshotProfit: true },
        _count: true,
      }),
    ]);

    // 3. Provider performance stats
    const providers = await this.prisma.provider.findMany({
      include: {
        orders: {
          select: {
            id: true,
            status: true,
            createdAt: true,
            completedAt: true,
          },
        },
      },
    });

    const providerMetrics = providers.map((p) => {
      const orders = p.orders;
      const completed = orders.filter((o) => o.status === OrderStatus.Completed);
      const failed = orders.filter((o) => o.status === OrderStatus.Failed);
      const manual = orders.filter((o) => o.status === OrderStatus.ManualReview);

      const total = orders.length;
      const rate = total > 0 ? (completed.length / total) * 100 : 100;

      // Calculate avg completion time for completed orders
      let totalTimeMs = 0;
      let countWithTimes = 0;
      for (const o of completed) {
        if (o.completedAt) {
          totalTimeMs += new Date(o.completedAt).getTime() - new Date(o.createdAt).getTime();
          countWithTimes++;
        }
      }
      const avgTimeMs = countWithTimes > 0 ? Math.round(totalTimeMs / countWithTimes) : 1200;

      return {
        providerId: p.id,
        providerCode: p.code,
        providerName: p.name,
        type: p.type,
        isActive: p.isActive,
        balance: Number(p.balance),
        currency: p.currency,
        totalOrders: total,
        completedOrders: completed.length,
        failedOrders: failed.length,
        manualReviewOrders: manual.length,
        successRate: parseFloat(rate.toFixed(1)),
        averageCompletionTimeMs: avgTimeMs,
      };
    });

    return {
      statusBreakdown: {
        total: totalCount,
        completed: completedCount,
        processing: processingCount,
        manualReview: manualReviewCount,
        failed: failedCount,
        refunded: refundedCount,
        successRate: totalCount > 0 ? parseFloat(((completedCount / totalCount) * 100).toFixed(1)) : 100,
      },
      financialSummary: {
        YER: {
          currency: 'YER',
          ordersCount: salesYer._count,
          realizedSales: Number(salesYer._sum.snapshotRetailPrice || 0),
          cogs: Number(salesYer._sum.snapshotCostPrice || 0),
          netProfit: Number(salesYer._sum.snapshotProfit || 0),
          marginPercentage:
            Number(salesYer._sum.snapshotRetailPrice || 0) > 0
              ? parseFloat(
                  ((Number(salesYer._sum.snapshotProfit || 0) / Number(salesYer._sum.snapshotRetailPrice || 0)) * 100).toFixed(1),
                )
              : 0,
        },
        USD: {
          currency: 'USD',
          ordersCount: salesUsd._count,
          realizedSales: Number(salesUsd._sum.snapshotRetailPrice || 0),
          cogs: Number(salesUsd._sum.snapshotCostPrice || 0),
          netProfit: Number(salesUsd._sum.snapshotProfit || 0),
          marginPercentage:
            Number(salesUsd._sum.snapshotRetailPrice || 0) > 0
              ? parseFloat(
                  ((Number(salesUsd._sum.snapshotProfit || 0) / Number(salesUsd._sum.snapshotRetailPrice || 0)) * 100).toFixed(1),
                )
              : 0,
        },
        SAR: {
          currency: 'SAR',
          ordersCount: salesSar._count,
          realizedSales: Number(salesSar._sum.snapshotRetailPrice || 0),
          cogs: Number(salesSar._sum.snapshotCostPrice || 0),
          netProfit: Number(salesSar._sum.snapshotProfit || 0),
          marginPercentage:
            Number(salesSar._sum.snapshotRetailPrice || 0) > 0
              ? parseFloat(
                  ((Number(salesSar._sum.snapshotProfit || 0) / Number(salesSar._sum.snapshotRetailPrice || 0)) * 100).toFixed(1),
                )
              : 0,
        },
      },
      providerPerformance: providerMetrics,
    };
  }
}
