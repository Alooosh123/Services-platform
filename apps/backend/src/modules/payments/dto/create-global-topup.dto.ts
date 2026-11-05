import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { CurrencyCode, PaymentChannelCode } from '@digital-topup/shared';

export class CreateCardTopupDto {
  @ApiProperty({ minimum: 1 })
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(1)
  amount: number;

  @ApiProperty({ enum: CurrencyCode, enumName: 'CurrencyCode', default: CurrencyCode.USD })
  @IsEnum(CurrencyCode)
  currency: CurrencyCode;

  @ApiProperty({ example: 'topup-20261027-abcdef12' })
  @IsString()
  @Matches(/^[A-Za-z0-9._:-]{8,128}$/)
  idempotencyKey: string;
}

export class CreateUsdtTopupDto extends CreateCardTopupDto {
  @ApiProperty({ enum: [PaymentChannelCode.USDT_TRC20, PaymentChannelCode.USDT_BEP20] })
  @IsEnum([PaymentChannelCode.USDT_TRC20, PaymentChannelCode.USDT_BEP20])
  network: PaymentChannelCode.USDT_TRC20 | PaymentChannelCode.USDT_BEP20;
}

export class StripeWebhookDto {
  @ApiProperty()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  type?: string;
}
