import {
  IsNotEmpty,
  IsNumber,
  IsEnum,
  IsString,
  IsOptional,
  IsUUID,
  Min,
  Max,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CurrencyCode, PaymentChannelCode } from '@digital-topup/shared';

export class CreateDepositDto {
  @ApiProperty({ enum: CurrencyCode, example: CurrencyCode.YER, description: 'عملة الإيداع' })
  @IsNotEmpty({ message: 'عملة الإيداع مطلوبة' })
  @IsEnum(CurrencyCode, { message: 'عملة غير مدعومة' })
  currency: CurrencyCode;

  @ApiProperty({ example: 25000, description: 'المبلغ المحول' })
  @IsNotEmpty({ message: 'المبلغ مطلوب' })
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 4 }, { message: 'يجب أن يكون المبلغ رقماً صالحاً حتى 4 منازل عشرية' })
  @Min(1, { message: 'الحد الأدنى للإيداع هو 1' })
  @Max(10000000, { message: 'الحد الأعلى للمبلغ غير صالح' })
  amount: number;

  @ApiProperty({
    enum: PaymentChannelCode,
    example: PaymentChannelCode.JAIB,
    description: 'قناة الدفع اليمنية',
  })
  @IsNotEmpty({ message: 'قناة التحويل مطلوبة' })
  @IsEnum(PaymentChannelCode, { message: 'قناة دفع غير معتمدة' })
  paymentMethodCode: PaymentChannelCode;

  @ApiPropertyOptional({ example: 'REF-JAIB-123456', description: 'الرقم المرجعي إن كان متاحاً؛ يمكن للوكيل مطابقته من سجل الحركة' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  @Matches(/^[A-Za-z0-9._/-]+$/, { message: 'الرقم المرجعي يحتوي على محارف غير صالحة' })
  referenceNumber?: string;

  @ApiPropertyOptional({ description: 'المعرّف المحفوظ لحساب الإرسال الخاص بالعميل على هذه القناة' })
  @IsOptional()
  @IsUUID()
  senderAccountId?: string;

  @ApiProperty({
    example: '/images/proofs/receipt.jpg',
    description: 'رابط صورة إشعار التحويل أو السند',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  proofImageUrl?: string;

  @ApiProperty({ example: 'أحمد محمد', description: 'اسم المحول / صاحب الحساب', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  senderName?: string;

  @ApiProperty({ example: '+967770000003', description: 'رقم هاتف المحول', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{7,15}$/)
  senderPhone?: string;
}
