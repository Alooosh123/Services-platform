import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { ProfitEngineService } from './profit-engine.service';
import { DailyCloseService } from './daily-close.service';
import { OwnerEarningsService } from './owner-earnings.service';
import { LedgerModule } from '../ledger/ledger.module';
import { EncryptionService } from '../../security/encryption.service';

@Module({
  imports: [LedgerModule],
  controllers: [ReportsController],
  providers: [
    ReportsService,
    ProfitEngineService,
    DailyCloseService,
    OwnerEarningsService,
    EncryptionService,
  ],
  exports: [
    ReportsService,
    ProfitEngineService,
    DailyCloseService,
    OwnerEarningsService,
  ],
})
export class ReportsModule {}
