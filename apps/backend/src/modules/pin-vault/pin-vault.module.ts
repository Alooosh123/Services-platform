import { Module } from '@nestjs/common';
import { PinVaultController } from './pin-vault.controller';
import { PinVaultService } from './pin-vault.service';

@Module({
  controllers: [PinVaultController],
  providers: [PinVaultService],
  exports: [PinVaultService],
})
export class PinVaultModule {}
