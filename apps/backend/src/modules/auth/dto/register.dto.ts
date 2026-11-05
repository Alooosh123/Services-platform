import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Ali Hassan', description: 'Customer full name' })
  @IsNotEmpty()
  @IsString()
  fullName: string;

  @ApiProperty({ example: 'gamer@example.com', description: 'Email address', required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: '+9647701234567', description: 'Mobile phone number', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'SecretP@ss123', description: 'Account password' })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password: string;
}
