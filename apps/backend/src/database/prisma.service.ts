import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { getCurrentTenantId } from '../tenant/tenant-context.store';

const TENANT_DIRECT_MODELS = new Set([
  'LedgerAccount',
  'LedgerTransaction',
  'LedgerEntry',
  'ReconciliationBatch',
  'SupplierAccount',
  'PriceRuleVersion',
  'DailyCloseReport',
  'OwnerEarningsWallet',
  'PinVault',
  'ProviderApiLog',
  'PaymentChannelConfig',
]);

const TENANT_RELATION_FILTERS: Record<string, Record<string, any>> = {
  Wallet: { user: { is: { tenantId: '__TENANT_ID__' } } },
  UserDevice: { user: { is: { tenantId: '__TENANT_ID__' } } },
  MerchantApiCredential: { user: { is: { tenantId: '__TENANT_ID__' } } },
  Session: { user: { is: { tenantId: '__TENANT_ID__' } } },
  CurrencyExchange: { user: { is: { tenantId: '__TENANT_ID__' } } },
  WalletLedgerEntry: { wallet: { is: { user: { is: { tenantId: '__TENANT_ID__' } } } } },
  DepositRequest: { user: { is: { tenantId: '__TENANT_ID__' } } },
  DepositStatusHistory: {
    depositRequest: { is: { user: { is: { tenantId: '__TENANT_ID__' } } } },
  },
  WalletTopup: { user: { is: { tenantId: '__TENANT_ID__' } } },
  Payment: { user: { is: { tenantId: '__TENANT_ID__' } } },
  Order: { user: { is: { tenantId: '__TENANT_ID__' } } },
  OrderStatusHistory: { order: { is: { user: { is: { tenantId: '__TENANT_ID__' } } } } },
  ManualFulfillment: { order: { is: { user: { is: { tenantId: '__TENANT_ID__' } } } } },
  AuditLog: { user: { is: { tenantId: '__TENANT_ID__' } } },
  PayoutRequest: { user: { is: { tenantId: '__TENANT_ID__' } } },
  ServiceRequest: { user: { is: { tenantId: '__TENANT_ID__' } } },
  PayoutBeneficiary: { user: { is: { tenantId: '__TENANT_ID__' } } },
  SupportTicket: { user: { is: { tenantId: '__TENANT_ID__' } } },
  TicketMessage: { ticket: { is: { user: { is: { tenantId: '__TENANT_ID__' } } } } },
  Notification: { user: { is: { tenantId: '__TENANT_ID__' } } },
  AgentProductPrice: { subAgent: { is: { tenantId: '__TENANT_ID__' } } },
  SupplierTransaction: { account: { is: { tenantId: '__TENANT_ID__' } } },
  ReconciliationItem: { batch: { is: { tenantId: '__TENANT_ID__' } } },
  DailyCloseAdjustment: { report: { is: { tenantId: '__TENANT_ID__' } } },
  OwnerPayoutTransaction: {
    beneficiary: { is: { user: { is: { tenantId: '__TENANT_ID__' } } } },
  },
  PaymentWebhookEvent: { payment: { is: { user: { is: { tenantId: '__TENANT_ID__' } } } } },
};

const SAAS_PLATFORM_MODELS = new Set([
  'SaaSPlan',
  'SaaSTenant',
  'SaaSSubscription',
  'SaaSInvoice',
]);

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private tenantMiddlewareInstalled = false;

  private installTenantQueryScope(): void {
    if (this.tenantMiddlewareInstalled) return;
    this.tenantMiddlewareInstalled = true;

    this.$use(async (params, next) => {
      const tenantId = getCurrentTenantId();
      const model = params.model;

      if (!tenantId || !model || SAAS_PLATFORM_MODELS.has(model)) {
        return next(params);
      }

      params.args = params.args || {};

      if (model === 'User') {
        if (params.action === 'create') {
          params.args.data = { ...params.args.data, tenantId };
        } else if (params.action === 'createMany') {
          const rows = Array.isArray(params.args.data) ? params.args.data : [params.args.data];
          params.args.data = rows.map((row: any) => ({ ...row, tenantId }));
        } else if (params.action === 'upsert') {
          params.args.create = { ...params.args.create, tenantId };
        }

        if (params.args.where) {
          params.args.where = {
            ...params.args.where,
            tenantId,
          };
        }
        return next(params);
      }

      if (TENANT_DIRECT_MODELS.has(model)) {
        if (params.action === 'create') {
          params.args.data = { ...params.args.data, tenantId };
        } else if (params.action === 'createMany') {
          const rows = Array.isArray(params.args.data) ? params.args.data : [params.args.data];
          params.args.data = rows.map((row: any) => ({ ...row, tenantId }));
        } else if (params.action === 'upsert') {
          params.args.create = { ...params.args.create, tenantId };
        }

        if (params.args.where) {
          const originalWhere = params.args.where;
          const existingAnd = Array.isArray(originalWhere.AND)
            ? originalWhere.AND
            : originalWhere.AND
              ? [originalWhere.AND]
              : [];
          const { AND: _ignoredAnd, ...uniqueSelector } = originalWhere;
          params.args.where = {
            ...uniqueSelector,
            AND: [...existingAnd, { tenantId }],
          };
        } else if (
          params.action === 'findMany' ||
          params.action === 'findFirst' ||
          params.action === 'findFirstOrThrow' ||
          params.action === 'count' ||
          params.action === 'aggregate' ||
          params.action === 'groupBy'
        ) {
          params.args.where = { tenantId };
        }
        return next(params);
      }

      const rawFilter = TENANT_RELATION_FILTERS[model];
      if (!rawFilter) return next(params);

      const replaceTenantMarker = (value: any): any => {
        if (Array.isArray(value)) return value.map(replaceTenantMarker);
        if (value && typeof value === 'object') {
          return Object.fromEntries(
            Object.entries(value).map(([key, child]) => [
              key,
              key === 'tenantId' && child === '__TENANT_ID__'
                ? tenantId
                : replaceTenantMarker(child),
            ]),
          );
        }
        return value;
      };
      const tenantFilter = replaceTenantMarker(rawFilter);

      // Keep unique selector fields at the root (required by Prisma's extended
      // WhereUniqueInput) and add the tenant condition as a mandatory AND clause.
      if (params.args.where) {
        const originalWhere = params.args.where;
        const existingAnd = Array.isArray(originalWhere.AND)
          ? originalWhere.AND
          : originalWhere.AND
            ? [originalWhere.AND]
            : [];
        const { AND: _ignoredAnd, ...uniqueSelector } = originalWhere;
        params.args.where = {
          ...uniqueSelector,
          AND: [...existingAnd, tenantFilter],
        };
      } else if (
        params.action === 'findMany' ||
        params.action === 'findFirst' ||
        params.action === 'findFirstOrThrow' ||
        params.action === 'count' ||
        params.action === 'aggregate' ||
        params.action === 'groupBy'
      ) {
        params.args.where = tenantFilter;
      }

      return next(params);
    });
  }

  async onModuleInit() {
    this.installTenantQueryScope();
    try {
      await this.$connect();
      this.logger.log('Successfully connected to PostgreSQL database.');
    } catch (error: any) {
      this.logger.error(
        `PostgreSQL connection failed: ${error?.message || 'Unreachable'}`,
      );
      // Production must not boot with an unavailable database and silently switch to memory.
      if (process.env.NODE_ENV === 'production') {
        throw error;
      }
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
    } catch {
      // ignore shutdown disconnect errors
    }
  }
}
