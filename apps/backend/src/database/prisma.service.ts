import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  getTenantExecutionContext,
  isPlatformAdminContext,
  isSaaSFinanceContext,
  isTenantResolverContext,
} from '../tenant/tenant-context.store';

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
  'ProductPrice',
  'ProductTierPrice',
  'SaaSSubscription',
  'SaaSInvoice',
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

const SAAS_GLOBAL_MODELS = new Set(['SaaSPlan']);
const SAAS_TENANT_MODELS = new Set(['SaaSTenant', 'SaaSSubscription', 'SaaSInvoice']);

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private tenantMiddlewareInstalled = false;

  private installTenantQueryScope(): void {
    if (this.tenantMiddlewareInstalled) return;
    this.tenantMiddlewareInstalled = true;

    this.$use(async (params, next) => {
      const executionContext = getTenantExecutionContext();
      const tenantId = executionContext?.tenantId ?? null;
      const model = params.model;
      const isPlatformAdmin = isPlatformAdminContext();
      const isSaaSFinance = isSaaSFinanceContext();
      const isTenantResolver = isTenantResolverContext();

      // No request is ever implicitly treated as a platform administrator.
      // Only a verified Super Admin JWT (or the narrow SaaS finance route)
      // enables cross-tenant access.
      if (!model || isPlatformAdmin || SAAS_GLOBAL_MODELS.has(model)) {
        return next(params);
      }

      if (SAAS_TENANT_MODELS.has(model)) {
        if (isTenantResolver || isSaaSFinance) {
          return next(params);
        }

        if (model === 'SaaSTenant') {
          const tenantScopeId = tenantId || '__NO_PLATFORM_TENANT_ACCESS__';
          if (
            params.action === 'create' ||
            params.action === 'createMany' ||
            params.action === 'upsert' ||
            params.action === 'update' ||
            params.action === 'updateMany' ||
            params.action === 'delete' ||
            params.action === 'deleteMany'
          ) {
            throw new ForbiddenException('Only the platform administrator can manage SaaS tenants.');
          }

          params.args = params.args || {};
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
              AND: [...existingAnd, { id: tenantScopeId }],
            };
          } else {
            params.args.where = { id: tenantScopeId };
          }
          return next(params);
        }

        // Subscriptions and invoices carry tenantId directly. On the platform
        // host without an authenticated platform role, NULL is the only visible
        // scope; tenant records are never returned implicitly.
        if (!tenantId && (
          params.action === 'create' ||
          params.action === 'createMany' ||
          params.action === 'upsert' ||
          params.action === 'update' ||
          params.action === 'updateMany' ||
          params.action === 'delete' ||
          params.action === 'deleteMany'
        )) {
          throw new ForbiddenException('A tenant context is required for SaaS billing writes.');
        }
      }

      params.args = params.args || {};

      // Product catalogue records are platform-wide, while tenant retail/tier
      // price rows included below must always be restricted to the current tenant.
      const applyNestedPriceScope = (node: any): void => {
        if (!node || typeof node !== 'object') return;
        for (const key of Object.keys(node)) {
          const value = node[key];
          if (
            (key === 'prices' || key === 'tierPrices' || key === 'productPrices' || key === 'agentPrices') &&
            value !== false &&
            value !== null
          ) {
            const relationArgs = value === true ? {} : value;
            const existingWhere = relationArgs.where || {};
            const tenantRelationFilter =
              key === 'agentPrices'
                ? { subAgent: { is: { tenantId } } }
                : { tenantId };
            node[key] = {
              ...relationArgs,
              where: {
                ...existingWhere,
                AND: [...(Array.isArray(existingWhere.AND) ? existingWhere.AND : existingWhere.AND ? [existingWhere.AND] : []), tenantRelationFilter],
              },
            };
            applyNestedPriceScope(node[key]);
          } else if (value && typeof value === 'object') {
            applyNestedPriceScope(value);
          }
        }
      };
      applyNestedPriceScope(params.args.include);
      applyNestedPriceScope(params.args.select);

      if (model === 'User') {
        if (params.action === 'create') {
          params.args.data = { ...params.args.data, tenantId };
        } else if (params.action === 'createMany') {
          const rows = Array.isArray(params.args.data) ? params.args.data : [params.args.data];
          params.args.data = rows.map((row: any) => ({ ...row, tenantId }));
        } else if (params.action === 'upsert') {
          params.args.create = { ...params.args.create, tenantId };
          params.args.update = { ...params.args.update, tenantId };
        } else if (params.action === 'update' || params.action === 'updateMany') {
          params.args.data = { ...params.args.data, tenantId };
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
          params.action === 'groupBy' ||
          params.action === 'updateMany' ||
          params.action === 'deleteMany'
        ) {
          params.args.where = { tenantId };
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
          params.args.update = { ...params.args.update, tenantId };
        } else if (params.action === 'update' || params.action === 'updateMany') {
          params.args.data = { ...params.args.data, tenantId };
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
          params.action === 'groupBy' ||
          params.action === 'updateMany' ||
          params.action === 'deleteMany'
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
        params.action === 'groupBy' ||
        params.action === 'updateMany' ||
        params.action === 'deleteMany'
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
