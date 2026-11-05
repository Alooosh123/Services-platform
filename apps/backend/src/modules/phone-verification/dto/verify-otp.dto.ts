import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class VerifyPhoneOtpDto {
  @ApiProperty({
    description: 'رقم الهاتف اليمني المراد التحقق منه',
    example: '770123456',
  })
  @IsNotEmpty({ message: 'رقم الهاتف مطلوب' })
  @IsString()
  phone: string;

  @ApiProperty({
    description: 'رمز التحقق المكون من 6 أرقام المستلم عبر SMS',
    example: '489123',
  })
  @IsNotEmpty({ message: 'رمز التحقق مطلوب' })
  @IsString()
  @Length(6, 6, { message: 'يجب أن يتكون رمز التحقق من 6 أرقام' })
  @Matches(/^[0-9]{6}$/, { message: 'رمز التحقق يجب أن يحتوي على أرقام فقط' })
  code: string;
}
