import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { OperationalApprovalsController } from './operational-approvals.controller';
import { OperationalApprovalsService } from './operational-approvals.service';

@Module({
  imports: [DatabaseModule],
  controllers: [OperationalApprovalsController],
  providers: [OperationalApprovalsService],
  exports: [OperationalApprovalsService],
})
export class OperationalApprovalsModule {}
