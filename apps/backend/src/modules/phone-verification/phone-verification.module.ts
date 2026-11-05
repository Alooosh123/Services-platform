import { Module } from '@nestjs/common';
import { PhoneVerificationController } from './phone-verification.controller';
import { PhoneVerificationService } from './phone-verification.service';
import { SandboxSmsAdapter } from './adapters/sandbox-sms.adapter';
import { ProductionSmsAdapter } from './adapters/production-sms.adapter';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [PhoneVerificationController],
  providers: [PhoneVerificationService, SandboxSmsAdapter, ProductionSmsAdapter],
  exports: [PhoneVerificationService],
})
export class PhoneVerificationModule {}
