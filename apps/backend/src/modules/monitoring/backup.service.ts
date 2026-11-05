import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  BackupStatus,
  BackupRecordDto,
  DisasterRecoveryDrillResultDto,
} from '@digital-topup/shared';
import { CreateBackupRecordDto, RunDrillDto } from './dto/monitoring.dto';

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Retrieves list of database backups
   */
  async getBackups(): Promise<BackupRecordDto[]> {
    const records = await (this.prisma as any).backupRecord.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return records.map((r: any) => ({
      id: r.id,
      fileName: r.fileName,
      sizeBytes: Number(r.sizeBytes),
      checksumSha256: r.checksumSha256,
      status: r.status as BackupStatus,
      environment: r.environment,
      tablesIncluded: r.tablesIncluded.split(','),
      recordsCount: r.recordsCount,
      durationSeconds: r.durationSeconds,
      rtoSecondsTarget: r.rtoTargetSeconds,
      rpoSecondsTarget: r.rpoTargetSeconds,
      verifiedAt: r.verifiedAt ? r.verifiedAt.toISOString() : undefined,
      verificationNotes: r.verificationNotes,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /**
   * Backup records are written only by the command that creates the artifact.
   */
  async createBackupRecord(_dto: CreateBackupRecordDto): Promise<BackupRecordDto> {
    this.logger.error(
      '[BACKUP_RECORD_REJECTED] Manual backup records cannot prove that a PostgreSQL backup artifact exists.',
    );
    throw new ServiceUnavailableException(
      'Create backups with the managed encrypted PostgreSQL backup command. Manual backup records are disabled.',
    );
  }

  /**
   * AT-20 Acceptance Test & Disaster Recovery Drill:
   * Validates ledger double-entry integrity before and after simulated restore
   */
  async runDisasterRecoveryDrill(dto?: RunDrillDto): Promise<DisasterRecoveryDrillResultDto> {
    const environment = dto?.environment || process.env.NODE_ENV || 'unknown';
    this.logger.error(
      `[DR_DRILL_BLOCKED] A real isolated PostgreSQL restore drill is not configured for ${environment}.`,
    );
    throw new ServiceUnavailableException(
      'Disaster-recovery verification is unavailable until an isolated PostgreSQL restore environment is configured. No drill result was recorded.',
    );
  }
}
