import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class EnableMfaDto {
  @ApiProperty({ description: 'TOTP secret key obtained from /auth/mfa/setup', example: 'JBSWY3DPEHPK3PXP' })
  @IsNotEmpty({ message: 'المفتاح السري لـ MFA مطلوب' })
  @IsString()
  secret: string;

  @ApiProperty({ description: '6-digit verification code from authenticator app', example: '483921' })
  @IsNotEmpty({ message: 'رمز التحقق مطلوب' })
  @IsString()
  @Length(6, 6, { message: 'يجب أن يتكون رمز التحقق من 6 أرقام' })
  @Matches(/^[0-9]{6}$/, { message: 'رمز التحقق يجب أن يحتوي على أرقام فقط' })
  code: string;
}
