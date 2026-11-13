import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { NetworkMonitoringController } from './network-monitoring.controller';
import { NetworkMonitoringService } from './network-monitoring.service';
import { NetworkDiagnosisService } from './network-diagnosis.service';
import { MikroTikReadOnlyClient } from './mikrotik-readonly.client';

@Module({
  imports: [DatabaseModule],
  controllers: [NetworkMonitoringController],
  providers: [NetworkMonitoringService, NetworkDiagnosisService, MikroTikReadOnlyClient],
  exports: [NetworkMonitoringService],
})
export class NetworkMonitoringModule {}
