import { Module } from '@nestjs/common';
import { ReconciliationService } from './reconciliation.service';
import { ReconciliationController } from './reconciliation.controller';
import { LedgerModule } from '../ledger/ledger.module';
import { DepositsModule } from '../deposits/deposits.module';
import { PayoutsModule } from '../payouts/payouts.module';
import { OperationalApprovalsModule } from '../operational-approvals/operational-approvals.module';

@Module({
  imports: [LedgerModule, DepositsModule, PayoutsModule, OperationalApprovalsModule],
  controllers: [ReconciliationController],
  providers: [ReconciliationService],
  exports: [ReconciliationService],
})
export class ReconciliationModule {}
