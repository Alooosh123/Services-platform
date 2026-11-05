import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, IsBoolean } from 'class-validator';
import {
  SystemAlertType,
  SystemAlertSeverity,
  BackupStatus,
} from '@digital-topup/shared';

export class ResolveAlertDto {
  @IsString()
  @IsOptional()
  resolutionNotes?: string;
}

export class CreateAlertDto {
  @IsEnum(SystemAlertType)
  @IsNotEmpty()
  alertType: SystemAlertType;

  @IsEnum(SystemAlertSeverity)
  @IsNotEmpty()
  severity: SystemAlertSeverity;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsString()
  @IsNotEmpty()
  source: string;

  @IsString()
  @IsOptional()
  escalationLevel?: string;

  @IsOptional()
  metrics?: Record<string, any>;
}

export class CreateBackupRecordDto {
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsNumber()
  sizeBytes: number;

  @IsString()
  @IsNotEmpty()
  checksumSha256: string;

  @IsString()
  @IsOptional()
  tablesIncluded?: string;

  @IsNumber()
  @IsOptional()
  recordsCount?: number;

  @IsNumber()
  @IsOptional()
  durationSeconds?: number;

  @IsString()
  @IsOptional()
  verificationNotes?: string;
}

export class RunDrillDto {
  @IsString()
  @IsOptional()
  environment?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class SimulateOutageDto {
  @IsString()
  @IsNotEmpty()
  serviceTarget: 'PAYMENT_GATEWAY' | 'FULFILLMENT_PROVIDER' | 'SMS_GATEWAY' | 'BACKGROUND_WORKER';

  @IsString()
  @IsNotEmpty()
  simulationMode: 'SAFE_FAILOVER' | 'MOCK_TIMEOUT' | 'DISCONNECT';
}
