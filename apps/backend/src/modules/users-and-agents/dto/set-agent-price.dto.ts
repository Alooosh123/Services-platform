import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsString, Min } from 'class-validator';
import { CurrencyCode } from '@digital-topup/shared';

export class SetAgentPriceDto {
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
}
