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

    const adapter = this.providersService.getAdapter(providerCode);

    this.logger.log(`Dispatching order ${order.orderNumber} via adapter: ${providerCode}`);

    // 3. Invoke provider adapter (safely outside any DB transaction)
    let response;
    try {
      response = await adapter.submitOrder({
        orderId: order.id,
        orderNumber: order.orderNumber,
        providerSku: order.product.sku,
        playerFields: order.snapshotBeneficiaryFields as Record<string, string>,
        amount: retailPriceNumber,
        currency,
      });
    } catch (err: any) {
      this.logger.error(`Adapter execution threw error for order ${order.orderNumber}: ${err?.message}`);
      response = {
        success: false,
        status: 'FAILED',
        errorMessage: err?.message || 'Adapter execution error',
      };
    }

    // 4. Handle Result. A success flag alone is not enough: require a
    // provider transaction reference and complete the financial settlement
    // before the order can be marked Completed.
    if (response.success === true && response.status === 'SUCCESS' && response.providerOrderId?.trim()) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const current = await tx.order.findUnique({ where: { id: order.id } });
          if (!current || current.status !== OrderStatus.Processing) {
            throw new BadRequestException('تغيرت حالة الطلب قبل تسوية التنفيذ؛ يلزم التحقق اليدوي.');
          }

          const ledgerResult = await this.ledgerService.recordOrderSettlement({
            userId: order.userId,
            walletId: wallet.id,
            orderId: order.orderNumber,
            currency,
            retailPrice: retailPriceNumber,
            costPrice: costPriceNumber,
            serviceName: order.snapshotServiceName,
            providerCode,
          }, tx);
          const ledgerTxId = ledgerResult?.transaction?.id || ledgerResult?.transaction?.txNumber;
          if (!ledgerTxId) {
            throw new BadRequestException('لم يتم إنشاء قيد دفتر الأستاذ؛ لا يمكن إكمال الطلب.');
          }

          if (costPriceNumber > 0) {
            if (!this.supplierBalanceService) {
              throw new BadRequestException('خدمة رصيد المورد غير متاحة؛ لا يمكن تسوية تكلفة الشحن.');
            }
            await this.supplierBalanceService.deductOrderFulfillmentCost(
              order.orderNumber,
              providerCode,
              currency,
              costPriceNumber,
              tx,
            );
          }

          await tx.order.update({
            where: { id: order.id },
            data: {
              status: OrderStatus.Completed,
              completedAt: new Date(),
              voucherCode: response.pinCode || null,
              providerTxId: response.providerOrderId,
              errorMessage: null,
              statusHistory: {
                create: {
                  oldStatus: OrderStatus.Processing,
                  newStatus: OrderStatus.Completed,
                  reason: `تم تأكيد التنفيذ من المزود ${providerCode} بمرجع ${response.providerOrderId}، وترحيل القيد ${ledgerTxId}.`,
                },
              },
            },
          });
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (settlementError: any) {
        const reason = `أفاد المزود بنجاح التنفيذ لكن تعذر إكمال التسوية المالية: ${settlementError?.message || settlementError}. تم الاحتفاظ بحجز رصيد العميل ومنع إعادة الإرسال الآلي.`;
        this.logger.error(`Order ${order.orderNumber} requires settlement review: ${reason}`);
        await this.prisma.order.updateMany({
          where: { id: order.id, status: OrderStatus.Processing },
          data: {
            status: OrderStatus.ManualReview,
            errorMessage: reason,
            statusHistory: {
              create: {
                oldStatus: OrderStatus.Processing,
                newStatus: OrderStatus.ManualReview,
                reason,
              },
            },
          },
        });
        return {
          success: false,
          status: OrderStatus.ManualReview,
          orderNumber: order.orderNumber,
          message: 'المزود أبلغ عن نجاح الشحن لكن القيد أو التسوية لم يكتمل؛ الطلب محجوز للمراجعة ولا يتم اعتباره ناجحاً محاسبياً.',
        };
      }

      await this.settleAgentCommission(order.id, currency);
      return { success: true, status: OrderStatus.Completed, orderNumber: order.orderNumber };
    }

    if (response.status === 'FAILED' && response.success === false) {
      await this.prisma.$transaction(async (tx) => {
        await this.ledgerService.releaseWalletHold(wallet.id, retailPriceNumber, tx);
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.Failed,
            errorMessage: response.errorMessage || 'Provider confirmed failure.',
            statusHistory: {
              create: {
                oldStatus: OrderStatus.Processing,
                newStatus: OrderStatus.Failed,
                reason: `رفض المزود تنفيذ الطلب: ${response.errorMessage || 'سبب غير محدد'}`,
              },
            },
          },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      return {
        success: false,
        status: OrderStatus.Failed,
        orderNumber: order.orderNumber,
        message: response.errorMessage || 'رفض المزود تنفيذ العملية.',
      };
    }

    // PENDING, timeout, incomplete success or missing provider reference:
    // keep the wallet hold and prevent automatic resubmission until review.
    const pendingReason = response.errorMessage ||
      (response.status === 'SUCCESS'
        ? 'استجابة المزود تفتقر إلى مرجع عملية موثوق؛ يتطلب الطلب مراجعة يدوية.'
        : 'استجابة المزود غير نهائية؛ تم تعليق الطلب للمراجعة دون إعادة إرسال.');
    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.ManualReview,
        errorMessage: pendingReason,
        statusHistory: {
          create: {
            oldStatus: OrderStatus.Processing,
            newStatus: OrderStatus.ManualReview,
            reason: pendingReason,
          },
        },
      },
    });

    return {
      success: false,
      status: OrderStatus.ManualReview,
      orderNumber: order.orderNumber,
      message: 'الطلب ينتظر مراجعة بشرية؛ لم يتم اعتماد نجاح أو خصم نهائي.',
    };
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
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === OrderStatus.Completed) throw new BadRequestException('Order is already completed.');
    if (order.status !== OrderStatus.ManualReview) {
      throw new BadRequestException('لا يمكن إتمام طلب يدوياً إلا بعد تحويله إلى قائمة المراجعة اليدوية.');
    }
    if (!dto.voucherCode?.trim() && !dto.proofScreenshotUrl?.trim()) {
      throw new BadRequestException('إثبات التنفيذ مطلوب: رمز تسليم فعلي أو صورة إيصال موثقة. لا يمكن اختلاق رمز نجاح.');
    }

    const currency = order.snapshotCurrency as CurrencyCode;
    const wallet = order.user.wallets.find((item) => item.currency === currency);
    if (!wallet) throw new NotFoundException(`Customer wallet not found for currency ${currency}`);

    const retailPriceNumber = Number(order.snapshotRetailPrice);
    const costPriceNumber = Number(order.snapshotCostPrice);

    await this.prisma.$transaction(async (tx) => {
      const current = await tx.order.findUnique({ where: { id: order.id } });
      if (!current || current.status !== OrderStatus.ManualReview) {
        throw new BadRequestException('تغيرت حالة الطلب؛ أعد تحميله قبل إتمام التنفيذ اليدوي.');
      }

      const ledgerResult = await this.ledgerService.recordOrderSettlement({
        userId: order.userId,
        walletId: wallet.id,
        orderId: order.orderNumber,
        currency,
        retailPrice: retailPriceNumber,
        costPrice: costPriceNumber,
        serviceName: order.snapshotServiceName,
        providerCode: 'MANUAL',
      }, tx);
      const ledgerTxId = ledgerResult?.transaction?.id || ledgerResult?.transaction?.txNumber;
      if (!ledgerTxId) throw new BadRequestException('لم يتم إنشاء قيد دفتر الأستاذ؛ بقي الطلب في المراجعة.');

      if (costPriceNumber > 0) {
        if (!this.supplierBalanceService) {
          throw new BadRequestException('خدمة رصيد المورد غير متاحة؛ لا يمكن تسوية تكلفة الشحن اليدوي.');
        }
        await this.supplierBalanceService.deductOrderFulfillmentCost(
          order.orderNumber,
          'MANUAL',
          currency,
          costPriceNumber,
          tx,
        );
      }

      await tx.manualFulfillment.upsert({
        where: { orderId: order.id },
        update: {
          status: 'COMPLETED',
          assignedOperatorId: staffId,
          operatorNotes: dto.operatorNotes || null,
          proofVoucherCode: dto.voucherCode?.trim() || null,
          proofScreenshotUrl: dto.proofScreenshotUrl?.trim() || null,
          completedAt: new Date(),
        },
        create: {
          orderId: order.id,
          status: 'COMPLETED',
          assignedOperatorId: staffId,
          operatorNotes: dto.operatorNotes || null,
          proofVoucherCode: dto.voucherCode?.trim() || null,
          proofScreenshotUrl: dto.proofScreenshotUrl?.trim() || null,
          completedAt: new Date(),
        },
      });

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.Completed,
          completedAt: new Date(),
          voucherCode: dto.voucherCode?.trim() || null,
          errorMessage: null,
          statusHistory: {
            create: {
              oldStatus: OrderStatus.ManualReview,
              newStatus: OrderStatus.Completed,
              reason: dto.operatorNotes || `تنفيذ يدوي موثق بواسطة الموظف ${staffId}؛ قيد دفتر الأستاذ ${ledgerTxId}.`,
              changedByUserId: staffId,
            },
          },
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

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
