import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { LedgerModule } from '../ledger/ledger.module';
import { ProductsModule } from '../products/products.module';
import { ProvidersModule } from '../providers/providers.module';
import { PilotModule } from '../pilot/pilot.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [LedgerModule, ProductsModule, ProvidersModule, PilotModule, AuthModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
