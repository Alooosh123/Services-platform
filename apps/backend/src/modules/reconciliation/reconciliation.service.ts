import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { LedgerService } from '../ledger/ledger.service';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../database/prisma.service';
import { getCurrentTenantId } from '../../tenant/tenant-context.store';
import { DepositsService } from '../deposits/deposits.service';
import { PayoutsService } from '../payouts/payouts.service';
import {
  CurrencyCode,
  PaymentChannelCode,
  ReconciliationStatus,
  DiscrepancyType,
  RunReconciliationDto,
  ReconciliationBatchSummary,
  LedgerTransactionType,
} from '@digital-topup/shared';

@Injectable()
export class ReconciliationService {
  constructor(
    private prisma: PrismaService,
    private depositsService: DepositsService,
    private payoutsService: PayoutsService,
    private ledgerService: LedgerService,
  ) {}

  private get tenantId(): string | null {
    return getCurrentTenantId() || null;
  }

  async runDailyReconciliation(
    staffUserId: string,
    dto: RunReconciliationDto,
  ): Promise<ReconciliationBatchSummary> {
    if (!dto.externalStatements?.length) throw new BadRequestException('كشف الحساب فارغ.');
    const statementDate = new Date(dto.statementDate);
    if (Number.isNaN(statementDate.getTime())) throw new BadRequestException('تاريخ كشف الحساب غير صالح.');

    const batchId = uuidv4();
    const dateStr = dto.statementDate.replace(/-/g, '');
    const batchNumber = `REC-${dateStr}-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date();
    const items: Array<{
      id: string;
      referenceNumber: string;
      expectedAmount: number;
      actualAmount: number;
      currency: CurrencyCode;
      status: ReconciliationStatus;
      discrepancyType?: DiscrepancyType | null;
      internalTxId?: string | null;
      notes?: string | null;
    }> = [];
    const seen = new Set<string>();
    let matchedCount = 0;
    let discrepancyCount = 0;
    let totalAmountMatched = 0;
    let totalAmountDiscrepant = 0;

    for (const stmt of dto.externalStatements) {
      const referenceNumber = String(stmt.referenceNumber || '').trim();
      const actualAmount = Number(stmt.amount);
      const currency = stmt.currency as CurrencyCode;
      if (!referenceNumber || !Number.isFinite(actualAmount) || actualAmount <= 0) {
        throw new BadRequestException('يتضمن كشف الحساب مرجعاً فارغاً أو مبلغاً غير صالح.');
      }
      const itemId = uuidv4();

      if (seen.has(referenceNumber)) {
        discrepancyCount++;
        totalAmountDiscrepant += actualAmount;
        items.push({
          id: itemId,
          referenceNumber,
          expectedAmount: 0,
          actualAmount,
          currency,
          status: ReconciliationStatus.DISCREPANCY,
          discrepancyType: DiscrepancyType.DUPLICATE_EXTERNAL,
          notes: 'مرجع مكرر داخل كشف الحساب؛ تم عزله للمراجعة دون إجراء قيد مالي.',
        });
        continue;
      }
      seen.add(referenceNumber);

      const deposit = await this.depositsService.findDepositByReference(referenceNumber);
      if (deposit) {
        const expectedAmount = Number(deposit.amount);
        const exact = Math.abs(actualAmount - expectedAmount) < 0.0001 && currency === deposit.currency;
        if (exact) {
          matchedCount++;
          totalAmountMatched += actualAmount;
          items.push({
            id: itemId, referenceNumber, expectedAmount, actualAmount, currency,
            status: ReconciliationStatus.MATCHED, internalTxId: deposit.depositNumber,
            notes: `مطابقة الإيداع ${deposit.depositNumber}`,
          });
        } else {
          discrepancyCount++;
          totalAmountDiscrepant += actualAmount;
          items.push({
            id: itemId, referenceNumber, expectedAmount, actualAmount, currency,
            status: ReconciliationStatus.DISCREPANCY,
            discrepancyType: currency !== deposit.currency ? DiscrepancyType.CURRENCY_MISMATCH : DiscrepancyType.AMOUNT_MISMATCH,
            internalTxId: deposit.depositNumber,
            notes: `فرق في الإيداع ${deposit.depositNumber}: المتوقع ${expectedAmount} ${deposit.currency}، الفعلي ${actualAmount} ${currency}`,
          });
        }
        continue;
      }

      // Match payouts only by a real external bank/provider reference, never by
      // the internal idempotency key.
      const payout = await this.payoutsService.findByExternalReference(referenceNumber);
      if (payout) {
        const exact = Math.abs(actualAmount - payout.amount) < 0.0001 && currency === payout.currency;
        if (exact && payout.status === 'CONFIRMED') {
          matchedCount++;
          totalAmountMatched += actualAmount;
          items.push({
            id: itemId, referenceNumber, expectedAmount: payout.amount, actualAmount, currency,
            status: ReconciliationStatus.MATCHED, internalTxId: payout.payoutNumber,
            notes: `مطابقة السحب ${payout.payoutNumber}`,
          });
        } else {
          discrepancyCount++;
          totalAmountDiscrepant += actualAmount;
          items.push({
            id: itemId, referenceNumber, expectedAmount: payout.amount, actualAmount, currency,
            status: ReconciliationStatus.DISCREPANCY,
            discrepancyType: currency !== payout.currency ? DiscrepancyType.CURRENCY_MISMATCH : DiscrepancyType.AMOUNT_MISMATCH,
            internalTxId: payout.payoutNumber,
            notes: `مرجع سحب ${payout.payoutNumber} موجود لكن المبلغ أو العملة أو الحالة لا تطابق.`,
          });
        }
        continue;
      }

      discrepancyCount++;
      totalAmountDiscrepant += actualAmount;
      items.push({
        id: itemId, referenceNumber, expectedAmount: 0, actualAmount, currency,
        status: ReconciliationStatus.UNKNOWN_EXTERNAL,
        discrepancyType: DiscrepancyType.MISSING_IN_INTERNAL,
        notes: 'عملية خارجية لا يقابلها إيداع أو سحب معروف؛ بانتظار تدقيق المالية.',
      });
    }

    const batchStatus = discrepancyCount > 0 ? 'PENDING_REVIEW' : 'COMPLETED';
    // Persist the entire batch + all detail rows atomically. No volatile fallback.
    const batch = await this.prisma.reconciliationBatch.create({
      data: {
        id: batchId,
        batchNumber,
        channelCode: dto.channelCode || null,
        statementDate,
        totalRecords: dto.externalStatements.length,
        matchedCount,
        discrepancyCount,
        totalAmountMatched: new Prisma.Decimal(totalAmountMatched),
        totalAmountDiscrepant: new Prisma.Decimal(totalAmountDiscrepant),
        status: batchStatus,
        reconciledByUserId: staffUserId,
        notes: `مطابقة كشف بتاريخ ${dto.statementDate}`,
        items: {
          create: items.map((item) => ({
            id: item.id,
            referenceNumber: item.referenceNumber,
            expectedAmount: new Prisma.Decimal(item.expectedAmount),
            actualAmount: new Prisma.Decimal(item.actualAmount),
            currency: item.currency,
            status: item.status,
            discrepancyType: item.discrepancyType || null,
            internalTxId: item.internalTxId || null,
            notes: item.notes || null,
          })),
        },
      },
      include: { items: true },
    });

    return {
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      statementDate: dto.statementDate,
      totalRecords: batch.totalRecords,
      matchedCount: batch.matchedCount,
      discrepancyCount: batch.discrepancyCount,
      totalAmountMatched: Number(batch.totalAmountMatched),
      totalAmountDiscrepant: Number(batch.totalAmountDiscrepant),
      discrepancies: batch.items
        .filter((item) => item.status !== ReconciliationStatus.MATCHED)
        .map((item) => ({
          id: item.id,
          referenceNumber: item.referenceNumber,
          expectedAmount: Number(item.expectedAmount),
          actualAmount: Number(item.actualAmount),
          currency: item.currency as CurrencyCode,
          type: item.discrepancyType as DiscrepancyType,
          status: item.status as ReconciliationStatus,
          notes: item.notes || undefined,
        })),
    };
  }

  async listBatches() {
    const batches = await this.prisma.reconciliationBatch.findMany({
      where: { tenantId: this.tenantId },
      orderBy: { statementDate: 'desc' },
      include: { items: true },
    });
    return batches.map((batch) => ({
      ...batch,
      totalAmountMatched: Number(batch.totalAmountMatched),
      totalAmountDiscrepant: Number(batch.totalAmountDiscrepant),
      items: batch.items.map((item) => ({
        ...item,
        expectedAmount: Number(item.expectedAmount),
        actualAmount: Number(item.actualAmount),
      })),
    }));
  }

  async getBatchById(batchId: string) {
    const batch = await this.prisma.reconciliationBatch.findFirst({
      where: { tenantId: this.tenantId, OR: [{ id: batchId }, { batchNumber: batchId }] },
      include: { items: true },
    });
    if (!batch) throw new NotFoundException(`دفعة المطابقة ${batchId} غير موجودة.`);
    return {
      ...batch,
      totalAmountMatched: Number(batch.totalAmountMatched),
      totalAmountDiscrepant: Number(batch.totalAmountDiscrepant),
      items: batch.items.map((item) => ({
        ...item,
        expectedAmount: Number(item.expectedAmount),
        actualAmount: Number(item.actualAmount),
      })),
    };
  }

  async resolveDiscrepancy(
    staffUserId: string,
    itemId: string,
    notes: string,
    action: 'ADJUST_LEDGER' | 'REJECT_EXTERNAL' | 'FORCE_MATCH',
  ): Promise<{ success: boolean; message: string }> {
    if (!notes?.trim()) throw new BadRequestException('ملاحظات المعالجة إلزامية.');
    const item = await this.prisma.reconciliationItem.findUnique({
      where: { id: itemId },
      include: { batch: true },
    });
    if (!item || item.batch.tenantId !== this.tenantId) throw new NotFoundException('عنصر المطابقة غير موجود.');
    if (item.status === ReconciliationStatus.MATCHED || item.status === ReconciliationStatus.RESOLVED_MANUAL) {
      throw new ConflictException('تمت معالجة هذا العنصر مسبقاً.');
    }
    if (item.batch.reconciledByUserId === staffUserId) {
      throw new ForbiddenException('يلزم موظف مالية مستقل عن منفذ تشغيل المطابقة لمعالجة الاستثناء.');
    }

    if (action === 'ADJUST_LEDGER') {
      // Do not manufacture an account mapping or debit/credit direction. A
      // controlled suspense-account proposal + separate approval is still
      // required before a monetary adjustment can be posted.
      throw new ServiceUnavailableException(
        'ترحيل فرق مالي معطل حتى تحديد حسابات التسوية المعتمدة لكل قناة وإضافة موافقة مالية ثانية مستقلة؛ لم يُنشأ أي قيد.',
      );
    }

    if (action === 'FORCE_MATCH') {
      const exact = item.expectedAmount.equals(item.actualAmount);
      if (!exact || item.discrepancyType === DiscrepancyType.CURRENCY_MISMATCH) {
        throw new BadRequestException('لا يمكن فرض المطابقة ما لم يتساوَ المبلغ والعملة تماماً.');
      }
    } else if (action === 'REJECT_EXTERNAL' && item.status !== ReconciliationStatus.UNKNOWN_EXTERNAL) {
      throw new BadRequestException('رفض الحركة الخارجية متاح فقط للحركات التي لا يقابلها سجل داخلي.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.reconciliationItem.update({
        where: { id: itemId },
        data: {
          status: ReconciliationStatus.RESOLVED_MANUAL,
          resolvedAt: new Date(),
          resolvedByUserId: staffUserId,
          notes: [item.notes, `معالجة مالية ${action} بواسطة ${staffUserId}: ${notes.trim()}`].filter(Boolean).join(' | '),
        },
      });
      const openCount = await tx.reconciliationItem.count({
        where: {
          batchId: item.batchId,
          status: { in: [ReconciliationStatus.DISCREPANCY, ReconciliationStatus.UNKNOWN_EXTERNAL, ReconciliationStatus.UNKNOWN_INTERNAL, ReconciliationStatus.PENDING_REVIEW] },
        },
      });
      if (openCount === 0) {
        await tx.reconciliationBatch.update({ where: { id: item.batchId }, data: { status: 'RESOLVED' } });
      }
      await tx.auditLog.create({
        data: {
          userId: staffUserId,
          action: 'RECONCILIATION_ITEM_RESOLVED',
          entityName: 'ReconciliationItem',
          entityId: itemId,
          newValues: { action, notes: notes.trim(), financialImpact: 'NONE' },
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return {
      success: true,
      message: action === 'FORCE_MATCH'
        ? 'تمت المطابقة بعد التحقق من تطابق المبلغ والعملة، وحُفظ القرار والتدقيق.'
        : 'تم عزل الحركة الخارجية ورفض مطابقتها بعد مراجعة مستقلة؛ لم يتغير أي رصيد.',
    };
  }
  async proposeLedgerAdjustment(
    financeUserId: string,
    itemId: string,
    debitAccountCode: string,
    creditAccountCode: string,
    notes: string,
  ) {
    if (!notes?.trim()) throw new BadRequestException('سبب التسوية المالية إلزامي.');
    const debitCode = debitAccountCode?.trim();
    const creditCode = creditAccountCode?.trim();
    if (!debitCode || !creditCode || debitCode === creditCode) {
      throw new BadRequestException('يجب اختيار حساب مدين وحساب دائن مختلفين من دليل الحسابات.');
    }

    const item = await this.prisma.reconciliationItem.findUnique({
      where: { id: itemId },
      include: { batch: true },
    });
    if (!item || item.batch.tenantId !== this.tenantId) {
      throw new NotFoundException('عنصر المطابقة غير موجود ضمن نطاقك.');
    }
    if (
      item.status !== ReconciliationStatus.DISCREPANCY ||
      ![DiscrepancyType.AMOUNT_MISMATCH, DiscrepancyType.FEE_MISMATCH].includes(item.discrepancyType as DiscrepancyType) ||
      item.expectedAmount.lessThanOrEqualTo(0) ||
      item.actualAmount.lessThanOrEqualTo(0)
    ) {
      throw new BadRequestException('اقتراح قيد تسوية متاح فقط لفروقات مبلغ/رسوم بين حركتين موجودتين وبالعملة نفسها؛ لا يشمل الحركات المجهولة أو اختلاف العملات أو المراجع المكررة.');
    }

    const amount = item.actualAmount.sub(item.expectedAmount).abs();
    if (amount.lessThanOrEqualTo(0)) throw new BadRequestException('قيمة الفرق تساوي صفراً.');
    const scopedDebitCode = this.ledgerService.scopeAccountCode(debitCode);
    const scopedCreditCode = this.ledgerService.scopeAccountCode(creditCode);
    const accounts = await this.prisma.ledgerAccount.findMany({
      where: { code: { in: [scopedDebitCode, scopedCreditCode] }, currency: item.currency },
      select: { code: true, currency: true },
    });
    if (accounts.length !== 2) {
      throw new BadRequestException('يجب أن يكون الحسابان موجودين مسبقاً في دليل الحسابات وبالعملة نفسها؛ لن ينشئ النظام حسابات تلقائياً للتسويات.');
    }

    return this.prisma.reconciliationAdjustment.create({
      data: {
        tenantId: this.tenantId,
        itemId,
        debitAccountCode: debitCode,
        creditAccountCode: creditCode,
        amount,
        currency: item.currency,
        status: 'PENDING_APPROVAL',
        proposedByUserId: financeUserId,
        proposalNotes: notes.trim(),
      },
    });
  }

  async approveLedgerAdjustment(
    approverUserId: string,
    adjustmentId: string,
    approvalNotes: string,
  ) {
    if (!approvalNotes?.trim()) throw new BadRequestException('ملاحظات اعتماد التسوية مطلوبة.');
    return this.prisma.$transaction(async (tx) => {
      const adjustment = await tx.reconciliationAdjustment.findUnique({
        where: { id: adjustmentId },
        include: { item: { include: { batch: true } } },
      });
      if (!adjustment || adjustment.tenantId !== this.tenantId) {
        throw new NotFoundException('طلب التسوية غير موجود ضمن نطاقك.');
      }
      if (adjustment.status !== 'PENDING_APPROVAL') {
        throw new ConflictException('تمت معالجة طلب التسوية مسبقاً.');
      }
      if (adjustment.proposedByUserId === approverUserId) {
        throw new ForbiddenException('مبدأ الرقابة الثنائية يمنع مقدم الاقتراح من اعتماده.');
      }
      const item = adjustment.item;
      if (
        item.status !== ReconciliationStatus.DISCREPANCY ||
        ![DiscrepancyType.AMOUNT_MISMATCH, DiscrepancyType.FEE_MISMATCH].includes(item.discrepancyType as DiscrepancyType) ||
        item.expectedAmount.lessThanOrEqualTo(0) ||
        item.actualAmount.lessThanOrEqualTo(0)
      ) {
        throw new ConflictException('لم تعد حالة عنصر المطابقة تسمح بترحيل هذه التسوية.');
      }
      const expectedAmount = item.actualAmount.sub(item.expectedAmount).abs();
      if (!expectedAmount.equals(adjustment.amount) || item.currency !== adjustment.currency) {
        throw new ConflictException('تغيرت قيمة الفرق أو العملة منذ اقتراح التسوية.');
      }

      const debitCode = this.ledgerService.scopeAccountCode(adjustment.debitAccountCode);
      const creditCode = this.ledgerService.scopeAccountCode(adjustment.creditAccountCode);
      const accounts = await tx.ledgerAccount.findMany({
        where: { code: { in: [debitCode, creditCode] }, currency: adjustment.currency },
        select: { code: true, currency: true },
      });
      if (accounts.length !== 2 || debitCode === creditCode) {
        throw new BadRequestException('حسابات التسوية لم تعد صالحة أو لا تطابق العملة.');
      }

      const ledger = await this.ledgerService.recordDoubleEntryTransaction({
        txNumber: 'LTX-RECON-ADJ-' + adjustment.id,
        type: LedgerTransactionType.ADJUSTMENT,
        referenceType: 'RECONCILIATION_ADJUSTMENT',
        referenceId: adjustment.id,
        idempotencyKey: 'RECON-ADJUST-' + adjustment.id,
        createdByUserId: approverUserId,
        notes: 'تسوية فرق المطابقة: ' + approvalNotes.trim(),
        entries: [
          {
            accountCode: adjustment.debitAccountCode,
            debitAmount: Number(adjustment.amount),
            creditAmount: 0,
            currency: adjustment.currency,
            notes: 'حساب مدين لتسوية فرق المطابقة ' + item.referenceNumber,
          },
          {
            accountCode: adjustment.creditAccountCode,
            debitAmount: 0,
            creditAmount: Number(adjustment.amount),
            currency: adjustment.currency,
            notes: 'حساب دائن لتسوية فرق المطابقة ' + item.referenceNumber,
          },
        ],
      }, tx);
      const ledgerTxId = ledger?.transaction?.id || ledger?.transaction?.txNumber;
      if (!ledgerTxId) throw new ServiceUnavailableException('لم يتم إنشاء قيد دفتر الأستاذ؛ ألغيت التسوية.');

      await tx.reconciliationAdjustment.update({
        where: { id: adjustmentId },
        data: {
          status: 'POSTED',
          approvedByUserId: approverUserId,
          approvalNotes: approvalNotes.trim(),
          ledgerTxId: String(ledgerTxId),
          approvedAt: new Date(),
        },
      });
      await tx.reconciliationItem.update({
        where: { id: item.id },
        data: {
          status: ReconciliationStatus.RESOLVED_MANUAL,
          resolvedAt: new Date(),
          resolvedByUserId: approverUserId,
          notes: [item.notes, 'تم ترحيل قيد تسوية معتمد ' + ledgerTxId].filter(Boolean).join(' | '),
        },
      });
      const openCount = await tx.reconciliationItem.count({
        where: {
          batchId: item.batchId,
          status: {
            in: [
              ReconciliationStatus.DISCREPANCY,
              ReconciliationStatus.UNKNOWN_EXTERNAL,
              ReconciliationStatus.UNKNOWN_INTERNAL,
              ReconciliationStatus.PENDING_REVIEW,
            ],
          },
        },
      });
      if (openCount === 0) {
        await tx.reconciliationBatch.update({
          where: { id: item.batchId },
          data: { status: 'RESOLVED' },
        });
      }
      await tx.auditLog.create({
        data: {
          userId: approverUserId,
          action: 'RECONCILIATION_LEDGER_ADJUSTMENT_POSTED',
          entityName: 'ReconciliationAdjustment',
          entityId: adjustmentId,
          newValues: {
            itemId: item.id,
            debitAccountCode: adjustment.debitAccountCode,
            creditAccountCode: adjustment.creditAccountCode,
            amount: adjustment.amount.toString(),
            currency: adjustment.currency,
            ledgerTxId: String(ledgerTxId),
            proposedByUserId: adjustment.proposedByUserId,
            approvedByUserId: approverUserId,
          },
        },
      });
      return tx.reconciliationAdjustment.findUnique({ where: { id: adjustmentId } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

}
