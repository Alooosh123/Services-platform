import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { MonitoringService } from './monitoring.service';
import { BackupService } from './backup.service';
import { HealthController } from './health.controller';
import { MonitoringController } from './monitoring.controller';
import { BackupController } from './backup.controller';
import { SecurityCoreModule } from '../../security/security-core.module';

@Module({
  imports: [DatabaseModule, SecurityCoreModule],
  controllers: [HealthController, MonitoringController, BackupController],
  providers: [MonitoringService, BackupService],
  exports: [MonitoringService, BackupService],
})
export class MonitoringModule {}
