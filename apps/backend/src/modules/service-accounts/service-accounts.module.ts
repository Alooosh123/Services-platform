import { Module } from '@nestjs/common';
import { ServiceAccountsController } from './service-accounts.controller';
import { AdminAccountReviewsController } from './admin-account-reviews.controller';
import { ServiceAccountsService } from './service-accounts.service';
import { DeterministicRulesEngine } from './engine/deterministic-rules.engine';
import { AiRiskEvaluatorService } from './engine/ai-risk-evaluator.service';
import { DatabaseModule } from '../../database/database.module';
import { EncryptionService } from '../../security/encryption.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ServiceAccountsController, AdminAccountReviewsController],
  providers: [
    ServiceAccountsService,
    EncryptionService,
    DeterministicRulesEngine,
    AiRiskEvaluatorService,
  ],
  exports: [ServiceAccountsService, AiRiskEvaluatorService],
})
export class ServiceAccountsModule {}
