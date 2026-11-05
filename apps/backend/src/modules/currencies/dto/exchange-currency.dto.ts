import { ApiProperty } from '@nestjs/swagger';
import { CurrencyCode } from '@digital-topup/shared';
import { IsEnum, IsNumber, IsString, Matches, MaxLength, Min } from 'class-validator';

export class ExchangeCurrencyDto {
  @ApiProperty({ enum: CurrencyCode })
  @IsEnum(CurrencyCode)
  fromCurrency: CurrencyCode;

  @ApiProperty({ enum: CurrencyCode })
  @IsEnum(CurrencyCode)
  toCurrency: CurrencyCode;

  @ApiProperty({ minimum: 0.0001 })
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 4 })
  @Min(0.0001)
  fromAmount: number;

  @ApiProperty({ minLength: 8, maxLength: 128 })
  @IsString()
  @Matches(/^[A-Za-z0-9._:-]{8,128}$/)
  @MaxLength(128)
  idempotencyKey: string;
}
