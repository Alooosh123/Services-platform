import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class AccountDeletionRequestDto {
  @ApiProperty({
    description: 'عبارة التأكيد الإجبارية لتأكيد الرغبة بحذف الحساب',
    example: 'CONFIRM_DELETE',
  })
  @IsNotEmpty({ message: 'عبارة التأكيد مطلوبة إجبارياً' })
  @IsString()
  confirmPhrase: string;

  @ApiProperty({
    description: 'سبب طلب حذف الحساب (اختياري)',
    example: 'لم أعد بحاجة لاستخدام الخدمة',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
