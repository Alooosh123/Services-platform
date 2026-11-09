import { Module } from '@nestjs/common';
import { DepositsService } from './deposits.service';
import { DepositsController } from './deposits.controller';
import { AdminDepositsController } from './admin-deposits.controller';
import { WalletAgentOperationsService } from './wallet-agent-operations.service';
import { WalletAgentOperationsController } from './wallet-agent-operations.controller';
import {
  PaymentAdapterRegistry,
  JaibPaymentAdapter,
  JawaliPaymentAdapter,
  CashPaymentAdapter,
  OneCashPaymentAdapter,
  EasyPaymentAdapter,
  SandboxPaymentAdapter,
} from './adapters/yemen-payment.adapters';
import { LedgerModule } from '../ledger/ledger.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [LedgerModule, WalletModule],
  controllers: [DepositsController, AdminDepositsController, WalletAgentOperationsController],
  providers: [
    DepositsService,
    WalletAgentOperationsService,
    PaymentAdapterRegistry,
    JaibPaymentAdapter,
    JawaliPaymentAdapter,
    CashPaymentAdapter,
    OneCashPaymentAdapter,
    EasyPaymentAdapter,
    SandboxPaymentAdapter,
  ],
  exports: [DepositsService, PaymentAdapterRegistry, WalletAgentOperationsService],
})
export class DepositsModule {}
