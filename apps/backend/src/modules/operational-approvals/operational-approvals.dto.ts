import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateOperationalApprovalDto {
  @IsIn(['NETWORK_CHANGE', 'FINANCIAL_RECONCILIATION'])
  approvalType!: 'NETWORK_CHANGE' | 'FINANCIAL_RECONCILIATION';

  @IsIn(['MIKROTIK_ROUTER', 'RECONCILIATION_ITEM'])
  targetType!: 'MIKROTIK_ROUTER' | 'RECONCILIATION_ITEM';

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
