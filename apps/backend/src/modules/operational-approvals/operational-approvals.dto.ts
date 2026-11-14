import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateOperationalApprovalDto {
  @IsIn(['NETWORK_CHANGE', 'FINANCIAL_RECONCILIATION', 'PAYMENT_CHANNEL_REACTIVATION'])
  approvalType!: 'NETWORK_CHANGE' | 'FINANCIAL_RECONCILIATION' | 'PAYMENT_CHANNEL_REACTIVATION';

  @IsIn(['MIKROTIK_ROUTER', 'RECONCILIATION_ITEM', 'DEPOSIT_REQUEST', 'PAYMENT_CHANNEL_CONFIG'])
  targetType!: 'MIKROTIK_ROUTER' | 'RECONCILIATION_ITEM' | 'DEPOSIT_REQUEST' | 'PAYMENT_CHANNEL_CONFIG';

  @IsOptional()
  @IsUUID()
  targetId?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(64)
  action!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(1000)
  reason!: string;
}

export class DecideOperationalApprovalDto {
  @IsIn(['APPROVE', 'REJECT'])
  decision!: 'APPROVE' | 'REJECT';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class CloseoutOperationalApprovalDto {
  @IsString()
  @MinLength(4)
  @MaxLength(191)
  executionReference!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsUUID()
  ledgerTransactionId?: string;
}
