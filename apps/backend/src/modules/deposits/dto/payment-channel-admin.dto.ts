import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { CurrencyCode, PaymentChannelCode, PaymentChannelMode } from '@digital-topup/shared';

export class CreatePaymentChannelDto {
  @IsEnum(PaymentChannelCode)
  code!: PaymentChannelCode;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nameAr!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(64)
  accountNumber!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  accountHolderName!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(1200)
  instructionsAr!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(CurrencyCode, { each: true })
  supportedCurrencies!: CurrencyCode[];

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  minAmount!: number;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  maxAmount!: number;
}

export class ProposePaymentChannelAccountDto {
  @IsString()
  @MinLength(5)
  @MaxLength(64)
  accountNumber!: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  feePercentage?: number;

  @IsString()
  @MinLength(12)
  @MaxLength(1000)
  reason!: string;
}

export class ApprovePaymentChannelChangeDto {
  approved!: boolean;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(1000)
  financeNotes?: string;
}

export class SwitchPaymentChannelModeDto {
  @IsEnum(PaymentChannelMode)
  mode!: PaymentChannelMode;
}

export class KillPaymentChannelDto {
  @IsString()
  @MinLength(12)
  @MaxLength(1000)
  reason!: string;
}
