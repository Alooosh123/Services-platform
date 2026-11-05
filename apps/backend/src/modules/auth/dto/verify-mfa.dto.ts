import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyMfaDto {
  @ApiProperty({ description: 'Temporary token returned during admin login' })
  @IsNotEmpty({ message: 'Temporary token is required' })
  @IsString()
  tempToken: string;

  @ApiProperty({ description: 'MFA 6-digit verification code', example: '123456' })
  @IsNotEmpty({ message: 'Verification code is required' })
  @IsString()
  code: string;
}
