import { Module } from '@nestjs/common';
import { DepositsService } from './deposits.service';
import { DepositsController } from './deposits.controller';
import { AdminDepositsController } from './admin-deposits.controller';
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
import { OperationalApprovalsModule } from '../operational-approvals/operational-approvals.module';

@Module({
  imports: [LedgerModule, WalletModule, OperationalApprovalsModule],
  controllers: [DepositsController, AdminDepositsController],
  providers: [
    DepositsService,
    PaymentAdapterRegistry,
    JaibPaymentAdapter,
    JawaliPaymentAdapter,
    CashPaymentAdapter,
    OneCashPaymentAdapter,
    EasyPaymentAdapter,
    SandboxPaymentAdapter,
  ],
  exports: [DepositsService, PaymentAdapterRegistry],
})
export class DepositsModule {}
