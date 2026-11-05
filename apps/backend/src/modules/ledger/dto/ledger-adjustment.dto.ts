import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, MinLength } from 'class-validator';
import { CurrencyCode } from '@digital-topup/shared';

export class AdminBalanceAdjustmentDto {
  @ApiProperty({ example: 'customer-uuid-here', description: 'Target customer User ID' })
  @IsNotEmpty()
  @IsString()
  userId: string;

  @ApiProperty({
    enum: CurrencyCode,
    example: CurrencyCode.YER,
    description: 'Wallet currency (YER, USD, SAR)',
  })
  @IsEnum(CurrencyCode)
  currency: CurrencyCode;

  @ApiProperty({
    enum: ['CREDIT', 'DEBIT'],
    example: 'CREDIT',
    description: 'CREDIT adds to customer balance, DEBIT subtracts from customer balance',
  })
  @IsNotEmpty()
  @IsString()
  type: 'CREDIT' | 'DEBIT';

  @ApiProperty({ example: 5000, description: 'Positive adjustment amount' })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({
    example: 'Manual compensation approved by finance ticket #4928',
    description: 'Mandatory justification for this administrative balance modification',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  reason: string;

  @ApiProperty({ example: 'ADJ-REQ-998822', description: 'Unique idempotency key for this request' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class DepositFundsDto {
  @ApiProperty({
    enum: CurrencyCode,
    example: CurrencyCode.YER,
  })
  @IsEnum(CurrencyCode)
  currency: CurrencyCode;

  @ApiProperty({ example: 10000, description: 'Deposit amount' })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({ example: 'DEP-IDEMP-00192', description: 'Idempotency key to avoid double deposit' })
  @IsNotEmpty()
  @IsString()
  idempotencyKey: string;
}
