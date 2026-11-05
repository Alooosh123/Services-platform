import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CurrencyCode,
  PaymentChannelCode,
  PilotCohortType,
  PilotDecisionGateStatus,
} from '@digital-topup/shared';

export class UpdatePilotConfigDto {
  @ApiPropertyOptional({ description: 'Whether pilot restriction mode is active' })
  @IsOptional()
  @IsBoolean()
  isPilotActive?: boolean;

  @ApiPropertyOptional({ description: 'Max allowed order amount in YER' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxOrderAmountYER?: number;

  @ApiPropertyOptional({ description: 'Max allowed order amount in USD' })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  maxOrderAmountUSD?: number;

  @ApiPropertyOptional({ description: 'Max daily wallet spend cap per pilot user in YER' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxDailyWalletLimitYER?: number;

  @ApiPropertyOptional({ description: 'Comma separated allowed product IDs, or ALL' })
  @IsOptional()
  @IsString()
  allowedProductIds?: string;

  @ApiPropertyOptional({ description: 'Comma separated allowed payment channels' })
  @IsOptional()
  @IsString()
  allowedChannelCodes?: string;

  @ApiPropertyOptional({ enum: PilotCohortType, description: 'Target user cohort' })
  @IsOptional()
  @IsEnum(PilotCohortType)
  cohortType?: PilotCohortType;

  @ApiPropertyOptional({ description: 'Comma separated whitelisted user IDs' })
  @IsOptional()
  @IsString()
  whitelistedUserIds?: string;

  @ApiPropertyOptional({ enum: PilotDecisionGateStatus, description: 'Go/No-Go Decision' })
  @IsOptional()
  @IsEnum(PilotDecisionGateStatus)
  goNoGoDecision?: PilotDecisionGateStatus;

  @ApiPropertyOptional({ description: 'Launch operational notes' })
  @IsOptional()
  @IsString()
  launchNotes?: string;
}

export class RunPilotCycleDto {
  @ApiProperty({ enum: CurrencyCode, default: CurrencyCode.YER })
  @IsEnum(CurrencyCode)
  currency: CurrencyCode;

  @ApiProperty({ description: 'Amount for test transaction', default: 2500 })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiPropertyOptional({ enum: PaymentChannelCode, default: PaymentChannelCode.JAIB })
  @IsOptional()
  @IsEnum(PaymentChannelCode)
  channelCode?: PaymentChannelCode;

  @ApiPropertyOptional({ description: 'Target product ID for pilot run' })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional({ description: 'Custom cycle name identifier' })
  @IsOptional()
  @IsString()
  cycleName?: string;
}

export class SignGoNoGoDto {
  @ApiProperty({ enum: ['TECHNICAL_LEAD', 'FINANCE_CONTROLLER', 'GENERAL_MANAGER'] })
  @IsString()
  role: 'TECHNICAL_LEAD' | 'FINANCE_CONTROLLER' | 'GENERAL_MANAGER';

  @ApiProperty({ description: 'Signer full name' })
  @IsString()
  signerName: string;

  @ApiProperty({ enum: PilotDecisionGateStatus, default: PilotDecisionGateStatus.GO })
  @IsEnum(PilotDecisionGateStatus)
  decision: PilotDecisionGateStatus;

  @ApiPropertyOptional({ description: 'Sign-off approval notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
