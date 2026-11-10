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
        createdAt: true,
        updatedAt: true,
      },
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
      select: { id: true, senderIdentifierType: true },
    });
    if (!channel) {
      throw new BadRequestException('لا يمكن ربط حساب مرسل إلا بقناة تحويل يدوية نشطة ومعتمدة.');
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
      const data = {
        identifierType: dto.identifierType,
        identifierCiphertext: this.encryption.encrypt(normalized),
        identifierLookupHash: lookupHash,
        maskedIdentifier,
        identifierLastFour: lastFour,
        status: changedIdentifier ? 'PENDING_VERIFICATION' : existing.status,
        verifiedAt: changedIdentifier ? null : existing.verifiedAt,
        consentGrantedAt: new Date(),
        consentTextVersion: 'payment-sender-account-v1',
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
