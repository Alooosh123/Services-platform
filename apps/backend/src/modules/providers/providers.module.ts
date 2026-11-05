import { Module } from '@nestjs/common';
import { ProvidersService } from './providers.service';
import { ProvidersController } from './providers.controller';
import { MockProviderAdapter } from './adapters/mock-provider.adapter';
import { ManualProviderAdapter } from './adapters/manual-provider.adapter';
import { ExternalApiAdapter } from './adapters/external-api.adapter';
import { FulfillmentService } from './fulfillment.service';
import { SupplierBalanceService } from './supplier-balance.service';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [LedgerModule],
  controllers: [ProvidersController],
  providers: [
    ProvidersService,
    FulfillmentService,
    SupplierBalanceService,
    MockProviderAdapter,
    ManualProviderAdapter,
    ExternalApiAdapter,
  ],
  exports: [ProvidersService, FulfillmentService, SupplierBalanceService],
})
export class ProvidersModule {}
