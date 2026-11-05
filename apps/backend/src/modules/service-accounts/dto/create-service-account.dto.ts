import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsBoolean,
  IsOptional,
  IsArray,
  Equals,
} from 'class-validator';

export class CreateServiceAccountDto {
  @ApiProperty({
    description: 'رمز أو معرّف الخدمة (مثل pubg-mobile, yoyo, toptop)',
    example: 'pubg-mobile',
  })
  @IsNotEmpty({ message: 'معرف الخدمة مطلوب' })
  @IsString()
  serviceSlug: string;

  @ApiProperty({
    description: 'معرف الحساب لدى الناشر (معرف اللاعب Player ID أو User ID)',
    example: '5123456789',
  })
  @IsNotEmpty({ message: 'معرف اللاعب مطلوب' })
  @IsString()
  accountIdentifier: string;

  @ApiProperty({
    description: 'الاسم المستعار في اللعبة (اختياري)',
    example: 'Yemen_Sniper',
    required: false,
  })
  @IsOptional()
  @IsString()
  accountName?: string;

  @ApiProperty({
    description: 'معرف السيرفر أو الزون إن وجد',
    example: 'Zone_MENA',
    required: false,
  })
  @IsOptional()
  @IsString()
  serverZoneId?: string;

  @ApiProperty({
    description: 'نطاقات الصلاحية الممنوحة من قبل العميل',
    example: ['READ_ACCOUNT_INFO', 'AUTOPROMPT_CHECKOUT'],
    required: false,
  })
  @IsOptional()
  @IsArray()
  consentScopes?: string[];

  @ApiProperty({
    description: 'إقرار صريح بالموافقة على حفظ الحساب كمعرف مرجعي لتسريع عمليات الشراء',
    example: true,
  })
  @IsBoolean({ message: 'يجب تأكيد الموافقة الصريحة كقيمة منطقية' })
  @Equals(true, { message: 'الموافقة الصريحة إلزامية لربط الحساب (Explicit Consent Required)' })
  consentGranted: boolean;
}
