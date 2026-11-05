import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { PricingEngineService } from './pricing-engine.service';
import { PricingController } from './pricing.controller';

@Module({
  controllers: [ProductsController, PricingController],
  providers: [ProductsService, PricingEngineService],
  exports: [ProductsService, PricingEngineService],
})
export class ProductsModule {}
