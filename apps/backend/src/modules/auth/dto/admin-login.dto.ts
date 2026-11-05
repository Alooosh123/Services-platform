import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdminLoginDto {
  @ApiProperty({ description: 'Admin email or phone number', example: 'admin@digitaltopup.com' })
  @IsNotEmpty({ message: 'Identifier is required' })
  @IsString()
  identifier: string;

  @ApiProperty({ description: 'Account password', example: 'Admin@123456' })
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password: string;
}
