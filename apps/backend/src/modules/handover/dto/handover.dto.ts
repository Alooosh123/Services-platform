import {
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RunDrillDto {
  @ApiProperty({
    enum: [
      'SUPPORT_FAILED_ORDER_DIAGNOSIS',
      'NEW_STAFF_DAILY_CLOSE',
      'HISTORICAL_RECONCILIATION_AUDIT',
    ],
    description: 'The type of operational drill to execute',
  })
  @IsString()
  drillType:
    | 'SUPPORT_FAILED_ORDER_DIAGNOSIS'
    | 'NEW_STAFF_DAILY_CLOSE'
    | 'HISTORICAL_RECONCILIATION_AUDIT';

  @ApiPropertyOptional({ description: 'Target order or report identifier to simulate' })
  @IsOptional()
  @IsString()
  simulatedTargetId?: string;

  @ApiProperty({ description: 'Name of the operator running the drill' })
  @IsString()
  operatorName: string;

  @ApiPropertyOptional({ description: 'Drill execution notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class SignHandoverDto {
  @ApiProperty({
    enum: [
      'TECHNICAL_LEAD',
      'FINANCE_CONTROLLER',
      'SUPPORT_LEAD',
      'OPERATIONS_MANAGER',
      'PROJECT_OWNER',
    ],
    description: 'Role of the signing authority',
  })
  @IsString()
  role:
    | 'TECHNICAL_LEAD'
    | 'FINANCE_CONTROLLER'
    | 'SUPPORT_LEAD'
    | 'OPERATIONS_MANAGER'
    | 'PROJECT_OWNER';

  @ApiProperty({ description: 'Full name of signer' })
  @IsString()
  signerName: string;

  @ApiPropertyOptional({ description: 'Handover sign-off notes or acceptance conditions' })
  @IsOptional()
  @IsString()
  notes?: string;
}
