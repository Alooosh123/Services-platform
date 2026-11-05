import { ApiProperty } from '@nestjs/swagger';
import { CurrencyCode } from '@digital-topup/shared';
import { IsEnum, IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';

export class SetTierProductPriceDto {
  @ApiProperty()
  @IsString()
  productId: string;

  @ApiProperty({ enum: CurrencyCode })
  @IsEnum(CurrencyCode)
  currency: CurrencyCode;

  @ApiProperty({ minimum: 0.0001 })
  @IsNumber()
  @Min(0.0001)
  retailPrice: number;

  @ApiProperty({ default: 0, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  agentCommissionPercent?: number;
}
