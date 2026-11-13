import { IsOptional, IsString, IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReviewDepositDto {
  @ApiProperty({ description: 'ملاحظات التدقيق المالي', required: false })
  @IsOptional()
  @IsString()
  reviewNotes?: string;

  @ApiProperty({ description: 'معرّف الموافقة المالية المستقلة المطلوبة قبل قيد الإيداع', required: false })
  @IsOptional()
  @IsUUID()
  approvalId?: string;
}

export class RejectDepositDto {
  @ApiProperty({ description: 'سبب رفض طلب الإيداع', example: 'رقم الإشعار غير مطابق لكشف الحساب البنكي' })
  @IsNotEmpty({ message: 'سبب رفض الطلب مطلوب إجبارياً' })
  @IsString()
  rejectionReason: string;

  @ApiProperty({ description: 'ملاحظات إضافية من ضابط المالية', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
