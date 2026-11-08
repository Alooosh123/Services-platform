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
import { ProvidersService } from './providers.service';
import { SupplierBalanceService } from './supplier-balance.service';
import {
  OrderStatus,
  CurrencyCode,
  ManualFulfillmentDto,
  OrderRefundDto,
} from '@digital-topup/shared';
import { Prisma } from '@prisma/client';

@Injectable()
export class FulfillmentService {
  private readonly logger = new Logger(FulfillmentService.name);

  constructor(
    private prisma: PrismaService,
    private ledgerService: LedgerService,
    private providersService: ProvidersService,
    @Optional() private supplierBalanceService?: SupplierBalanceService,
  ) {}

  /**
   * Dispatches an order for fulfillment.
   * Executed OUTSIDE open DB transactions to maintain high throughput and reliability.
   */
  async dispatchOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        product: true,
        service: true,
        provider: true,
        user: {
          include: { wallets: true },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    const retailPriceNumber = Number(order.snapshotRetailPrice);
    const costPriceNumber = Number(order.snapshotCostPrice);
    const currency = order.snapshotCurrency as CurrencyCode;

    // Find the user's wallet for this currency
    const wallet = order.user.wallets.find((w) => w.currency === currency);
    if (!wallet) {
      throw new BadRequestException(`Customer wallet not found for currency ${currency}`);
    }

    // 1. Move to Processing state
    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.Processing,
        statusHistory: {
          create: {
            oldStatus: order.status,
            newStatus: OrderStatus.Processing,
            reason: 'Order dispatched to fulfillment engine',
          },
        },
      },
    });

    // 2. Determine provider code (Default MOCK or assigned provider)
    const providerCode = (order.provider?.code || 'MOCK').toUpperCase();

    // SG-03: Provider Integrity & Sandbox Isolation
    if (process.env.NODE_ENV === 'production' && providerCode === 'MOCK') {
      this.logger.error(`Security Violation: Attempted to dispatch order ${order.orderNumber} via MOCK provider in production.`);
      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.ManualReview,
          errorMessage: 'تم إيقاف تنفيذ الطلب: محول المحاكاة محظور في بيئة الإنتاج (SG-03)',
          statusHistory: {
            create: {
              oldStatus: order.status,
              newStatus: OrderStatus.ManualReview,
              reason: 'حظر أمني: محول المحاكاة محظور في بيئة الإنتاج التشغيلية',
            },
          },
        },
      });
      throw new ForbiddenException(
        'محول المحاكاة والتسوية المالية الوهمية محظورة نهائياً في بيئة الإنتاج (SG-03 Sandbox Isolation Enforcement).',
      );
    }

    // P05 Fulfillment Gating: Verify commercial balance & credit limit at provider
    if (this.supplierBalanceService) {
      const gating = await this.supplierBalanceService.checkFulfillmentGating(
        providerCode,
        currency,
        costPriceNumber,
      );
      if (!gating.allowed) {
        this.logger.warn(`[GatingTriggered] Order ${order.orderNumber} held in ManualReview: ${gating.message}`);
        await this.prisma.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.ManualReview,
            errorMessage: gating.message,
            statusHistory: {
              create: {
                oldStatus: OrderStatus.Processing,
                newStatus: OrderStatus.ManualReview,
                reason: gating.message || 'حجز الطلب للتدقيق المالي: رصيد المزود التجاري غير كافٍ',
              },
            },
          },
        });
        return {
          success: false,
          status: OrderStatus.ManualReview,
          orderNumber: order.orderNumber,
          message: gating.message,
        };
      }
    }

    this.logger.log(`Dispatching order ${order.orderNumber} via adapter: ${providerCode}`);

    // 3. Invoke provider adapter outside the DB transaction. A thrown network
    // or configuration error has an unknown external outcome: keep funds held
    // and route to ManualReview rather than releasing the customer's balance.
    let response;
    try {
      const adapter = this.providersService.getAdapter(providerCode);
      response = await adapter.submitOrder({
        orderId: order.id,
        orderNumber: order.orderNumber,
        providerSku: order.product.sku,
        playerFields: order.snapshotBeneficiaryFields as Record<string, string>,
        amount: retailPriceNumber,
        currency,
      });
    } catch (err: any) {
      this.logger.error(`Adapter outcome is unknown for order ${order.orderNumber}: ${err?.message}`);
      response = {
        success: false,
        status: 'PENDING',
        errorMessage: err?.message || 'Provider outcome is unknown; manual reconciliation is required.',
        errorCode: 'PROVIDER_OUTCOME_UNKNOWN',
      };
    }

    // 4. Handle Result
    if (response.status === 'SUCCESS') {
      if (process.env.NODE_ENV === 'production' && providerCode === 'MOCK') {
        throw new ForbiddenException('لا يمكن تسوية قيود دفتر الأستاذ العام بالاعتماد على استجابة وهمية في بيئة الإنتاج');
      }

      // Provider success and financial completion must commit together.
      // If the ledger write fails, the order remains unpaid/held for reconciliation.
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.order.update({
            where: { id: order.id },
            data: {
              status: OrderStatus.Completed,
              completedAt: new Date(),
              voucherCode: response.pinCode || null,
              providerTxId: response.providerOrderId || null,
              statusHistory: {
                create: {
                  oldStatus: OrderStatus.Processing,
                  newStatus: OrderStatus.Completed,
                  reason: 'Fulfillment completed and ledger settlement posted atomically',
                },
              },
            },
          });

          await this.ledgerService.recordOrderSettlement({
            userId: order.userId,
            walletId: wallet.id,
            orderId: order.orderNumber,
            currency,
            retailPrice: retailPriceNumber,
            costPrice: costPriceNumber,
            serviceName: order.snapshotServiceName,
            providerCode,
          }, tx);
        }, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (ledgerErr: any) {
        this.logger.error(
          `Provider confirmed order ${order.orderNumber}, but atomic ledger settlement failed: ${ledgerErr?.message}`,
        );
        await this.prisma.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.ManualReview,
            errorMessage: 'أكد المزود نجاح الشحن لكن لم يكتمل القيد المالي الذري؛ يتطلب الطلب مطابقة مالية يدوية.',
            statusHistory: {
              create: {
                oldStatus: OrderStatus.Processing,
                newStatus: OrderStatus.ManualReview,
                reason: 'Provider success could not be atomically committed with the ledger settlement.',
              },
            },
          },
        });
        return {
          success: false,
          status: OrderStatus.ManualReview,
          orderNumber: order.orderNumber,
          message: 'Provider success awaits financial reconciliation.',
        };
      }

      await this.settleAgentCommission(order.id, currency);

      // P05: Settle commercial cost from supplier account
      if (this.supplierBalanceService) {
        try {
          await this.supplierBalanceService.deductOrderFulfillmentCost(
            order.orderNumber,
            providerCode,
            currency,
            costPriceNumber,
          );
        } catch (suppErr: any) {
          this.logger.warn(`Supplier balance deduction warning: ${suppErr?.message}`);
        }
      }

      return { success: true, status: OrderStatus.Completed, orderNumber: order.orderNumber };
    } else if (response.status === 'FAILED') {
      // CONFIRMED FAILURE: release hold immediately
      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.Failed,
          errorMessage: response.errorMessage || 'Provider failed to fulfill',
          statusHistory: {
            create: {
              oldStatus: OrderStatus.Processing,
              newStatus: OrderStatus.Failed,
              reason: `Fulfillment rejected by provider: ${response.errorMessage || 'Unknown failure'}`,
            },
          },
        },
      });

      // Release lockedBalance hold so funds return to customer available balance
      await this.ledgerService.releaseWalletHold(wallet.id, retailPriceNumber);

      return { success: false, status: OrderStatus.Failed, orderNumber: order.orderNumber, message: response.errorMessage };
    } else {
      // PENDING or TIMEOUT (e.g. Manual Fulfillment or Gateway Timeout)
      const nextStatus = providerCode === 'MANUAL' ? OrderStatus.ManualReview : OrderStatus.ManualReview;

      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          status: nextStatus,
          errorMessage: response.errorMessage || (providerCode === 'MANUAL' ? 'بانتظار تنفيذ المشغل اليدوي' : 'استجابة المزود غير مؤكدة'),
          statusHistory: {
            create: {
              oldStatus: OrderStatus.Processing,
              newStatus: nextStatus,
              reason: response.errorMessage || 'Moved to operator manual review queue. Funds reserved in lockedBalance.',
            },
          },
        },
      });

      return { success: true, status: nextStatus, orderNumber: order.orderNumber, message: 'Enqueued for manual review' };
    }
  }

  /**
   * Manual fulfillment by admin/operator.
   * Settles order and posts double-entry transaction.
   */
  async fulfillManualOrder(staffId: string, orderId: string, dto: ManualFulfillmentDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        product: true,
        user: { include: { wallets: true } },
        manualFulfillment: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status === OrderStatus.Completed) {
      throw new BadRequestException('Order is already marked as completed');
    }

    const currency = order.snapshotCurrency as CurrencyCode;
    const wallet = order.user.wallets.find((w) => w.currency === currency);
    if (!wallet) {
      throw new NotFoundException(`Customer wallet not found for currency ${currency}`);
    }

    const retailPriceNumber = Number(order.snapshotRetailPrice);
    const costPriceNumber = Number(order.snapshotCostPrice);

    // 1. Update order and manual fulfillment
    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.Completed,
          completedAt: new Date(),
          voucherCode: dto.voucherCode || order.voucherCode || 'MANUAL-FULFILLED',
          statusHistory: {
            create: {
              oldStatus: order.status,
              newStatus: OrderStatus.Completed,
              reason: dto.operatorNotes || 'تم التنفيذ والتسليم يدوياً من قبل المشغل',
              changedByUserId: staffId,
            },
          },
        },
      });

      await tx.manualFulfillment.upsert({
        where: { orderId: order.id },
        update: {
          status: 'COMPLETED',
          assignedOperatorId: staffId,
          operatorNotes: dto.operatorNotes || null,
          proofVoucherCode: dto.voucherCode || null,
          proofScreenshotUrl: dto.proofScreenshotUrl || null,
          completedAt: new Date(),
        },
        create: {
          orderId: order.id,
          status: 'COMPLETED',
          assignedOperatorId: staffId,
          operatorNotes: dto.operatorNotes || null,
          proofVoucherCode: dto.voucherCode || null,
          proofScreenshotUrl: dto.proofScreenshotUrl || null,
          completedAt: new Date(),
        },
      });

      // The order, operator evidence, hold release and ledger posting commit together.
      await this.ledgerService.recordOrderSettlement({
        userId: order.userId,
        walletId: wallet.id,
        orderId: order.orderNumber,
        currency,
        retailPrice: retailPriceNumber,
        costPrice: costPriceNumber,
        serviceName: order.snapshotServiceName,
        providerCode: 'MANUAL',
      }, tx);
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });

    await this.settleAgentCommission(order.id, currency);

    return this.prisma.order.findUnique({
      where: { id: order.id },
      include: { manualFulfillment: true, statusHistory: true },
    });
  }

  /**
   * Admin refund order with double-entry reversal and audit log.
   */
  async refundOrder(staffId: string, orderId: string, dto: OrderRefundDto) {
    if (!dto.reason || dto.reason.trim().length === 0) {
      throw new BadRequestException('سبب الاسترداد إلزامي ومطلوب');
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { include: { wallets: true } },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status === OrderStatus.Refunded) {
      throw new BadRequestException('الطلب مسترد مسبقاً');
    }

    const currency = order.snapshotCurrency as CurrencyCode;
    const wallet = order.user.wallets.find((w) => w.currency === currency);
    if (!wallet) {
      throw new NotFoundException(`Customer wallet not found for currency ${currency}`);
    }

    const retailPriceNumber = Number(order.snapshotRetailPrice);
    const costPriceNumber = Number(order.snapshotCostPrice);

    if (order.status === OrderStatus.Completed) {
      // Order was settled: perform full double-entry reversal
      if (order.agentParentUserId && Number(order.agentCommissionAmount) > 0) {
        await this.ledgerService.reverseAgentCommission({
          orderId: order.orderNumber,
          performedByUserId: staffId,
          reason: dto.reason,
        });
      }
      await this.ledgerService.recordOrderRefund({
        userId: order.userId,
        walletId: wallet.id,
        orderId: order.orderNumber,
        currency,
        amount: retailPriceNumber,
        costPrice: costPriceNumber,
        reason: dto.reason,
        performedByUserId: staffId,
      });
    } else {
      // Order was NOT settled yet (funds still held in lockedBalance): release hold
      await this.ledgerService.releaseWalletHold(wallet.id, retailPriceNumber);
    }

    // Update order status to Refunded
    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.Refunded,
        statusHistory: {
          create: {
            oldStatus: order.status,
            newStatus: OrderStatus.Refunded,
            reason: `استرداد إداري: ${dto.reason}`,
            changedByUserId: staffId,
          },
        },
      },
      include: { statusHistory: true },
    });

    return updated;
  }

  private async settleAgentCommission(orderId: string, currency: CurrencyCode) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        orderNumber: true,
        agentParentUserId: true,
        agentCommissionAmount: true,
      },
    });
    if (!order?.agentParentUserId || Number(order.agentCommissionAmount) <= 0) {
      return;
    }

    const wallet = await this.prisma.wallet.findUnique({
      where: {
        userId_currency: {
          userId: order.agentParentUserId,
          currency,
        },
      },
      select: { id: true },
    });
    if (!wallet) {
      this.logger.error(
        `Reseller wallet not found for commission on order ${order.orderNumber}`,
      );
      return;
    }

    try {
      await this.ledgerService.recordAgentCommission({
        parentAgentId: order.agentParentUserId,
        orderId: order.orderNumber,
        walletId: wallet.id,
        currency,
        amount: Number(order.agentCommissionAmount),
      });
    } catch (error) {
      this.logger.error(
        `Agent commission settlement failed for order ${order.orderNumber}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
