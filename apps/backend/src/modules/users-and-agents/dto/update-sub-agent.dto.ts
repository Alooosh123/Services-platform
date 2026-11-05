import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNumber, IsOptional, Min, Max } from 'class-validator';
import { AgentPricingMode } from '@prisma/client';

export class UpdateSubAgentDto {
  @ApiProperty({ enum: AgentPricingMode, required: false })
  @IsOptional()
  @IsEnum(AgentPricingMode)
  pricingMode?: AgentPricingMode;

  @ApiProperty({ required: false, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  parentCommissionPercent?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
