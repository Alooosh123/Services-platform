import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNumber, IsOptional, IsString, Matches, Min, Max, MinLength } from 'class-validator';
import { AgentPricingMode } from '@prisma/client';

export class CreateSubAgentDto {
  @ApiProperty()
  @IsString()
  fullName: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ enum: AgentPricingMode, default: AgentPricingMode.PERCENTAGE })
  @IsOptional()
  @IsEnum(AgentPricingMode)
  pricingMode?: AgentPricingMode;

  @ApiProperty({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  parentCommissionPercent?: number;
}
