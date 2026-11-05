import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BackupService } from './backup.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@digital-topup/shared';
import { CreateBackupRecordDto, RunDrillDto } from './dto/monitoring.dto';

@ApiTags('Database Backups & Disaster Recovery (Phase 10)')
@Controller('backups')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.FINANCE_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List database backups history and verification records' })
  async getBackups() {
    return this.backupService.getBackups();
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Record a completed database backup snapshot' })
  async createBackup(@Body() dto: CreateBackupRecordDto) {
    return this.backupService.createBackupRecord(dto);
  }

  @Post('drill')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.FINANCE_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Execute AT-20 Disaster Recovery restoration drill with strict ledger balance verification' })
  async runDisasterRecoveryDrill(@Body() dto: RunDrillDto) {
    return this.backupService.runDisasterRecoveryDrill(dto);
  }
}
