import { IsNotEmpty, IsString, IsOptional, IsEmail, MinLength, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@digital-topup/shared';

export class CreateStaffDto {
  @ApiProperty({ description: 'Full name of the staff member', example: 'Mohammed Ali' })
  @IsNotEmpty({ message: 'Full name is required' })
  @IsString()
  fullName: string;

  @ApiProperty({ description: 'Staff email', example: 'staff@digitaltopup.com', required: false })
  @IsOptional()
  @IsEmail({}, { message: 'Invalid email address' })
  email?: string;

  @ApiProperty({ description: 'Staff phone', example: '+967771234567', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ description: 'Password', example: 'Staff@123456' })
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password: string;

  @ApiProperty({ description: 'Role assigned to staff', enum: UserRole, example: UserRole.FINANCE })
  @IsNotEmpty({ message: 'Role is required' })
  @IsEnum(UserRole, { message: 'Invalid role' })
  role: UserRole;
}
