import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrencyCode, PaymentChannelCode } from '@digital-topup/shared';

export class CreateOrderDto {
  @ApiProperty({ example: 'product-uuid-here', description: 'Product to purchase' })
  @IsOptional()
  @IsString()
  productId?: string;

  // Backward-compatibility field
  @ApiProperty({ example: 'product-uuid-here', required: false })
  @IsOptional()
  @IsString()
  packageId?: string;

  @ApiProperty({
    enum: CurrencyCode,
    example: CurrencyCode.YER,
    description: 'Purchase currency (YER, USD, SAR)',
    default: CurrencyCode.YER,
  })
  @IsOptional()
  @IsEnum(CurrencyCode)
  currency?: CurrencyCode;

  @ApiProperty({
    example: { player_id: '5123456789' },
    description: 'Beneficiary credentials dynamic key-value pairs',
  })
  @IsObject()
  playerFields: Record<string, string>;

  @ApiProperty({
    example: 'IDEMP-ORD-9911223344',
    description: 'Unique client-generated idempotency key to prevent double charge',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(128)
  idempotencyKey: string;

  @ApiProperty({
    enum: PaymentChannelCode,
    example: PaymentChannelCode.WALLET,
    required: false,
    default: PaymentChannelCode.WALLET,
  })
  @IsOptional()
  @IsEnum(PaymentChannelCode)
  paymentMethod?: PaymentChannelCode;
}

export class RetryOrderDto {
  @ApiProperty({ example: 'Retrying after provider server maintenance', required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}
