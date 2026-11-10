import { createHmac } from 'crypto';
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { PaymentSenderIdentifierType } from '@digital-topup/shared';
import { PrismaService } from '../../database/prisma.service';
import { EncryptionService } from '../../security/encryption.service';
import { getCurrentTenantId } from '../../tenant/tenant-context.store';
import { SavePaymentSenderAccountDto } from './dto/save-payment-sender-account.dto';

@Injectable()
export class PaymentSenderAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  private get tenantId(): string | null {
    return getCurrentTenantId() || null;
  }

  async listForCustomer(userId: string) {
    return this.prisma.paymentSenderAccount.findMany({
      where: { tenantId: this.tenantId, userId },
      orderBy: [{ channelCode: 'asc' }, { updatedAt: 'desc' }],
      select: {
        id: true,
        channelCode: true,
        identifierType: true,
        maskedIdentifier: true,
        status: true,
        verifiedAt: true,
        reviewNotes: true,
        reviewedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Owner-only review queue. The complete identifier is decrypted only for
   * this endpoint; the controller restricts it to OWNER/SUPER_ADMIN.
   */
  async listPendingForOwner() {
    const accounts = await this.prisma.paymentSenderAccount.findMany({
      where: { tenantId: this.tenantId, status: 'PENDING_VERIFICATION' },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            fullNameAr: true,
            email: true,
            phone: true,
            isVerified: true,
            phoneVerifiedAt: true,
            createdAt: true,
          },
        },
      },
    });

    return accounts.map((account: any) => ({
      id: account.id,
      channelCode: account.channelCode,
      identifierType: account.identifierType,
      identifier: this.encryption.decrypt(account.identifierCiphertext),
      maskedIdentifier: account.maskedIdentifier,
      status: account.status,
      consentGrantedAt: account.consentGrantedAt,
      createdAt: account.createdAt,
      user: account.user,
    }));
  }

  async approveForOwner(accountId: string, ownerUserId: string, reviewNotes?: string) {
    const now = new Date();
    const cleanNotes = reviewNotes?.trim().slice(0, 500) || null;

    return this.prisma.$transaction(async (tx) => {
      const result = await tx.paymentSenderAccount.updateMany({
        where: {
          id: accountId,
          tenantId: this.tenantId,
          status: 'PENDING_VERIFICATION',
        },
        data: {
          status: 'VERIFIED',
          verifiedAt: now,
          reviewedAt: now,
          reviewedByUserId: ownerUserId,
          reviewNotes: cleanNotes,
        },
      });

      if (result.count !== 1) {
        throw new ConflictException('طلب التوثيق غير موجود أو تمت مراجعته مسبقاً. حدّث قائمة الطلبات.');
      }

      const account = await tx.paymentSenderAccount.findFirst({
        where: { id: accountId, tenantId: this.tenantId },
        select: {
          id: true,
          userId: true,
          channelCode: true,
          identifierType: true,
          maskedIdentifier: true,
          status: true,
          verifiedAt: true,
          reviewedAt: true,
          reviewNotes: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: ownerUserId,
          action: 'PAYMENT_SENDER_ACCOUNT_APPROVED',
          entityName: 'PaymentSenderAccount',
          entityId: accountId,
          newValues: {
            customerUserId: account?.userId,
            channelCode: account?.channelCode,
            identifierType: account?.identifierType,
            maskedIdentifier: account?.maskedIdentifier,
            status: 'VERIFIED',
            reviewNotes: cleanNotes,
          },
        },
      });

      return account;
    });
  }

  async rejectForOwner(accountId: string, ownerUserId: string, rejectionReason: string) {
    const reason = rejectionReason?.trim();
    if (!reason || reason.length > 500) {
      throw new BadRequestException('سبب رفض رقم المحفظة مطلوب وبحد أقصى 500 حرف.');
    }
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const result = await tx.paymentSenderAccount.updateMany({
        where: {
          id: accountId,
          tenantId: this.tenantId,
          status: 'PENDING_VERIFICATION',
        },
        data: {
          status: 'REJECTED',
          verifiedAt: null,
          reviewedAt: now,
          reviewedByUserId: ownerUserId,
          reviewNotes: reason,
        },
      });

      if (result.count !== 1) {
        throw new ConflictException('طلب التوثيق غير موجود أو تمت مراجعته مسبقاً. حدّث قائمة الطلبات.');
      }

      const account = await tx.paymentSenderAccount.findFirst({
        where: { id: accountId, tenantId: this.tenantId },
        select: {
          id: true,
          userId: true,
          channelCode: true,
          identifierType: true,
          maskedIdentifier: true,
          status: true,
          reviewedAt: true,
          reviewNotes: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: ownerUserId,
          action: 'PAYMENT_SENDER_ACCOUNT_REJECTED',
          entityName: 'PaymentSenderAccount',
          entityId: accountId,
          newValues: {
            customerUserId: account?.userId,
            channelCode: account?.channelCode,
            identifierType: account?.identifierType,
            maskedIdentifier: account?.maskedIdentifier,
            status: 'REJECTED',
            rejectionReason: reason,
          },
        },
      });

      return account;
    });
  }

  async saveForCustomer(userId: string, dto: SavePaymentSenderAccountDto) {
    if (dto.consentAccepted !== true) {
      throw new BadRequestException('يجب الموافقة صراحةً على حفظ معرّف حساب التحويل مشفّراً لغرض مطابقة الإيداعات.');
    }

    const channel = await this.prisma.paymentChannelConfig.findFirst({
      where: {
        tenantId: this.tenantId,
        code: dto.channelCode,
        isActive: true,
        mode: 'MANUAL',
        verificationStatus: 'VERIFIED',
      },
      select: {
        id: true,
        senderIdentifierType: true,
        accountNumber: true,
        regulatoryApprovalReference: true,
        regulatoryApprovalDocumentUrl: true,
        providerAgreementReference: true,
        providerAgreementDocumentUrl: true,
      },
    });
    if (!channel) {
      throw new BadRequestException('لا يمكن ربط حساب مرسل إلا بقناة تحويل يدوية نشطة ومعتمدة.');
    }
    if (
      !channel.accountNumber ||
      channel.accountNumber === 'NOT_CONFIGURED' ||
      !channel.regulatoryApprovalReference ||
      !channel.regulatoryApprovalDocumentUrl ||
      !channel.providerAgreementReference ||
      !channel.providerAgreementDocumentUrl
    ) {
      throw new BadRequestException('لا يمكن حفظ الحساب قبل اكتمال وثائق الاعتماد واتفاقية القناة وحساب الاستقبال.');
    }
    if (channel.senderIdentifierType !== dto.identifierType) {
      throw new BadRequestException('نوع المعرّف لا يطابق نوع الحساب المطلوب لهذه القناة.');
    }

    const normalized = this.normalizeIdentifier(dto.identifier, dto.identifierType);
    const keyHex = process.env.ENCRYPTION_KEY || '';
    if (!/^[0-9a-f]{64}$/i.test(keyHex)) {
      throw new BadRequestException('إعداد تشفير الحسابات غير مكتمل؛ تعذر حفظ المعرّف بأمان.');
    }

    const lookupHash = createHmac('sha256', Buffer.from(keyHex, 'hex'))
      .update(`payment-sender-account:v1:${dto.channelCode}:${normalized}`, 'utf8')
      .digest('hex');
    const lastFour = normalized.slice(-4);
    const maskedIdentifier = `•••• ${lastFour}`;

    return this.prisma.$transaction(async (tx) => {
      const linkedToAnotherUser = await tx.paymentSenderAccount.findFirst({
        where: {
          tenantId: this.tenantId,
          channelCode: dto.channelCode,
          identifierLookupHash: lookupHash,
          userId: { not: userId },
        },
        select: { id: true },
      });
      if (linkedToAnotherUser) {
        throw new ConflictException('هذا المعرّف مرتبط بالفعل بحساب عميل آخر على القناة نفسها.');
      }

      const existing = await tx.paymentSenderAccount.findFirst({
        where: { tenantId: this.tenantId, userId, channelCode: dto.channelCode },
      });
      const changedIdentifier = !existing || existing.identifierLookupHash !== lookupHash;
      const alreadyVerified = !!existing && !changedIdentifier && existing.status === 'VERIFIED';
      const data = {
        identifierType: dto.identifierType,
        identifierCiphertext: this.encryption.encrypt(normalized),
        identifierLookupHash: lookupHash,
        maskedIdentifier,
        identifierLastFour: lastFour,
        status: alreadyVerified ? 'VERIFIED' : 'PENDING_VERIFICATION',
        verifiedAt: alreadyVerified ? existing.verifiedAt : null,
        reviewedByUserId: alreadyVerified ? existing.reviewedByUserId : null,
        reviewedAt: alreadyVerified ? existing.reviewedAt : null,
        reviewNotes: alreadyVerified ? existing.reviewNotes : null,
        consentGrantedAt: new Date(),
        consentTextVersion: 'payment-sender-account-v2-owner-review',
      };

      const account = existing
        ? await tx.paymentSenderAccount.update({ where: { id: existing.id }, data })
        : await tx.paymentSenderAccount.create({
            data: {
              tenantId: this.tenantId,
              userId,
              channelCode: dto.channelCode,
              ...data,
            },
          });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'PAYMENT_SENDER_ACCOUNT_SAVED',
          entityName: 'PaymentSenderAccount',
          entityId: account.id,
          newValues: {
            channelCode: account.channelCode,
            identifierType: account.identifierType,
            maskedIdentifier: account.maskedIdentifier,
            status: account.status,
            changedIdentifier,
          },
        },
      });

      return {
        id: account.id,
        channelCode: account.channelCode,
        identifierType: account.identifierType,
        maskedIdentifier: account.maskedIdentifier,
        status: account.status,
        verifiedAt: account.verifiedAt,
        reviewNotes: account.reviewNotes,
        reviewedAt: account.reviewedAt,
      };
    });
  }

  private normalizeIdentifier(
    raw: string,
    type: PaymentSenderIdentifierType,
  ): string {
    if (typeof raw !== 'string' || !raw.trim() || raw.length > 80) {
      throw new BadRequestException('معرّف حساب التحويل مطلوب وبحد أقصى 80 خانة.');
    }
    if (type === PaymentSenderIdentifierType.PHONE) {
      const digits = raw.replace(/[^0-9]/g, '');
      if (!/^[0-9]{7,15}$/.test(digits)) {
        throw new BadRequestException('رقم الهاتف المرتبط بالمحفظة يجب أن يحتوي على 7 إلى 15 رقماً.');
      }
      return digits;
    }
    const compact = raw.trim().replace(/\s+/g, '');
    if (!/^[A-Za-z0-9._/-]{3,80}$/.test(compact)) {
      throw new BadRequestException('رقم البديل أو معرّف المحفظة يحتوي على محارف غير صالحة.');
    }
    return compact.toUpperCase();
  }
}
