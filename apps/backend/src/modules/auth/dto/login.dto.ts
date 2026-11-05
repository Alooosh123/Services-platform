import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@digitaltopup.com', description: 'Email address or Phone number' })
  @IsNotEmpty()
  @IsString()
  identifier: string;

  @ApiProperty({ example: 'Admin@123456', description: 'User account password' })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password: string;
}
