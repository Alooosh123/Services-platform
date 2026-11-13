import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProductsModule } from './modules/products/products.module';
import { OrdersModule } from './modules/orders/orders.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { ProvidersModule } from './modules/providers/providers.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AuditModule } from './modules/audit/audit.module';
import { CurrenciesModule } from './modules/currencies/currencies.module';
import { DepositsModule } from './modules/deposits/deposits.module';
import { PhoneVerificationModule } from './modules/phone-verification/phone-verification.module';
import { ServiceAccountsModule } from './modules/service-accounts/service-accounts.module';
import { PayoutsModule } from './modules/payouts/payouts.module';
import { ReconciliationModule } from './modules/reconciliation/reconciliation.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SupportModule } from './modules/support/support.module';
import { PrivacyModule } from './modules/privacy/privacy.module';
import { MonitoringModule } from './modules/monitoring/monitoring.module';
import { PilotModule } from './modules/pilot/pilot.module';
import { HandoverModule } from './modules/handover/handover.module';
import { SaasModule } from './modules/saas/saas.module';
import { SecurityCoreModule } from './security/security-core.module';
import { UsersAndAgentsModule } from './modules/users-and-agents/users-and-agents.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { NetworkMonitoringModule } from './modules/network-monitoring/network-monitoring.module';
import { OperationalApprovalsModule } from './modules/operational-approvals/operational-approvals.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    DatabaseModule,
    SecurityCoreModule,
    UsersAndAgentsModule,
    PaymentsModule,
    NetworkMonitoringModule,
    OperationalApprovalsModule,
    AuthModule,
    ProductsModule,
    OrdersModule,
    LedgerModule,
    WalletModule,
    DepositsModule,
    CurrenciesModule,
    ProvidersModule,
    ReportsModule,
    AuditModule,
    PhoneVerificationModule,
    ServiceAccountsModule,
    PayoutsModule,
    ReconciliationModule,
    NotificationsModule,
    SupportModule,
    PrivacyModule,
    MonitoringModule,
    PilotModule,
    HandoverModule,
    SaasModule,
  ],
})
export class AppModule {}
