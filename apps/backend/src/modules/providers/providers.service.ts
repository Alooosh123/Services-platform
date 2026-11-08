import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ITopupProviderAdapter } from './adapters/provider-adapter.interface';
import { MockProviderAdapter } from './adapters/mock-provider.adapter';
import { ManualProviderAdapter } from './adapters/manual-provider.adapter';
import { ExternalApiAdapter, ExternalProviderIntegrationConfig } from './adapters/external-api.adapter';
import { EncryptionService } from '../../security/encryption.service';
import {
  PlayerValidationRequest,
  PlayerValidationResponse,
  TopupProviderOrderRequest,
  TopupProviderOrderResponse,
  CurrencyCode,
  UpdateProviderDto,
} from '@digital-topup/shared';

@Injectable()
export class ProvidersService {
  private readonly logger = new Logger(ProvidersService.name);
  private adapters: Map<string, ITopupProviderAdapter> = new Map();

  constructor(
    private prisma: PrismaService,
    private mockAdapter: MockProviderAdapter,
    private manualAdapter: ManualProviderAdapter,
    private externalAdapter: ExternalApiAdapter,
    private encryptionService: EncryptionService,
  ) {
    // Register all supported adapters
    this.adapters.set('MOCK', this.mockAdapter);
    this.adapters.set('MANUAL', this.manualAdapter);
    this.adapters.set('EXTERNAL_API', this.externalAdapter);
  }

  getAdapter(providerCode: string): ITopupProviderAdapter {
    const code = typeof providerCode === 'string' ? providerCode.trim().toUpperCase() : '';
    if (code === 'MOCK' && process.env.NODE_ENV !== 'test') {
      throw new ServiceUnavailableException('The MOCK provider adapter is available in automated tests only.');
    }
    const adapter = code ? this.adapters.get(code) : undefined;
    if (!adapter) {
      this.logger.error(`No provider adapter is registered for code "${code || 'EMPTY'}". Dispatch is blocked.`);
      throw new ServiceUnavailableException(`No fulfillment adapter is configured for provider "${code || 'unknown'}".`);
    }
    return adapter;
  }

  async validatePlayer(providerCode: string, req: PlayerValidationRequest): Promise<PlayerValidationResponse> {
    const code = providerCode.trim().toUpperCase();
    const provider = await this.prisma.provider.findFirst({ where: { code, isActive: true } });
    if (provider?.type === 'EXTERNAL_API') {
      return this.externalAdapter.validatePlayer(req, await this.loadExternalIntegration(provider));
    }
    const adapter = this.getAdapter(code);
    return adapter.validatePlayer(req);
  }

  /**
   * Execute TopUp order via provider adapter with audit logging
   */
  async dispatchTopupOrder(
    providerId: string,
    orderId: string,
    request: TopupProviderOrderRequest,
  ): Promise<TopupProviderOrderResponse> {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
    });

    if (!provider) {
      throw new NotFoundException(`Provider ${providerId} not found`);
    }

    if (!provider.isActive) throw new ServiceUnavailableException('Provider is disabled.');
    const adapter = provider.type === 'EXTERNAL_API' ? this.externalAdapter : this.getAdapter(provider.code);
    const integration = provider.type === 'EXTERNAL_API' ? await this.loadExternalIntegration(provider) : undefined;
    const startTime = Date.now();

    let response: TopupProviderOrderResponse;
    let errorMessage: string | undefined;

    try {
      response = provider.type === 'EXTERNAL_API'
        ? await this.externalAdapter.submitOrder(request, integration)
        : await adapter.submitOrder(request);
    } catch (err: any) {
      errorMessage = err?.message || 'Unknown network error';
      response = {
        success: false,
        status: 'PENDING',
        errorMessage: `Provider outcome is unknown; manual reconciliation is required. ${errorMessage}`,
        errorCode: 'PROVIDER_OUTCOME_UNKNOWN',
      };
    }

    const durationMs = Date.now() - startTime;

    // Record into AuditLog
    await this.prisma.auditLog.create({
      data: {
        action: 'PROVIDER_DISPATCH_ORDER',
        entityName: 'Order',
        entityId: orderId,
        newValues: {
          providerCode: provider.code,
          durationMs,
          status: response.status,
          success: response.success,
          errorMessage: response.errorMessage || null,
        },
      },
    });

    return response;
  }

  /**
   * List providers with sensitive API keys securely masked.
   */
  async listProviders() {
    const providers = await this.prisma.provider.findMany({
      include: {
        _count: {
          select: { orders: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return providers.map((p) => ({
      ...p,
      apiKey: p.apiKey
        ? p.apiKey.length > 8
          ? `${p.apiKey.slice(0, 4)}****${p.apiKey.slice(-4)}`
          : '********'
        : p.credentialsCiphertext
          ? '********'
          : null,
      credentialsCiphertext: undefined,
    }));
  }

  /**
   * Update provider configuration (name, baseUrl, apiKey, isActive, type).
   */
  async updateProvider(providerId: string, dto: UpdateProviderDto, actorUserId: string) {
    if (!actorUserId) throw new BadRequestException('Authenticated operator identity is required for provider configuration changes.');
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
    });

    if (!provider) {
      throw new NotFoundException(`Provider ${providerId} not found`);
    }

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.baseUrl !== undefined) data.baseUrl = dto.baseUrl;
    if (dto.apiKey !== undefined && dto.apiKey && !dto.apiKey.includes('****')) {
      data.apiKey = null;
    }
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.type !== undefined) data.type = dto.type as any;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.apiKey !== undefined && dto.apiKey && !dto.apiKey.includes('****')) {
        const previousCredentials = provider.credentialsCiphertext
          ? this.encryptionService.decryptJson<Record<string, unknown>>(provider.credentialsCiphertext)
          : {};
        data.credentialsCiphertext = this.encryptionService.encryptJson({ ...previousCredentials, apiKey: dto.apiKey });
      }
      const providerUpdate = await tx.provider.update({
        where: { id: providerId },
        data,
      });
      await tx.auditLog.create({
        data: {
          userId: actorUserId,
          action: 'PROVIDER_CONFIGURATION_UPDATED',
          entityName: 'Provider',
          entityId: providerId,
          newValues: {
            name: dto.name,
            baseUrl: dto.baseUrl,
            apiKeyChanged: Boolean(dto.apiKey && !dto.apiKey.includes('****')),
            isActive: dto.isActive,
            type: dto.type,
          },
        },
      });
      return providerUpdate;
    });

    return {
      ...updated,
      apiKey: updated.apiKey || updated.credentialsCiphertext ? '********' : null,
      credentialsCiphertext: undefined,
    };
  }

  async getProviderCredentials(providerId: string): Promise<Record<string, unknown>> {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      select: { apiKey: true, credentialsCiphertext: true },
    });
    if (!provider) {
      throw new NotFoundException(`Provider ${providerId} not found`);
    }
    if (provider.credentialsCiphertext) {
      return this.encryptionService.decryptJson<Record<string, unknown>>(provider.credentialsCiphertext);
    }
    return provider.apiKey ? { apiKey: provider.apiKey } : {};
  }

  private async loadExternalIntegration(provider: any): Promise<ExternalProviderIntegrationConfig> {
    if (provider.type !== 'EXTERNAL_API' || !provider.baseUrl || !provider.credentialsCiphertext) {
      throw new ServiceUnavailableException('External provider base URL and encrypted integration configuration are required.');
    }
    const credentials = this.encryptionService.decryptJson<Record<string, any>>(provider.credentialsCiphertext);
    if (!credentials.integration || typeof credentials.integration !== 'object') {
      throw new ServiceUnavailableException('No documented API endpoint mappings have been configured for this provider.');
    }
    return {
      ...credentials.integration,
      baseUrl: provider.baseUrl,
      timeoutMs: provider.timeoutMs || 10000,
      providerCode: provider.code,
    } as ExternalProviderIntegrationConfig;
  }

  async updateProviderIntegration(
    providerId: string,
    actorUserId: string,
    dto: {
      baseUrl: string;
      authentication: { type: 'NONE' | 'BEARER' | 'API_KEY_HEADER'; secret?: string; headerName?: string };
      endpoints: ExternalProviderIntegrationConfig['endpoints'];
      timeoutMs?: number;
    },
  ) {
    if (!actorUserId) throw new BadRequestException('Authenticated operator identity is required.');
    this.externalAdapter.validateEndpoint(dto.baseUrl);
    const provider = await this.prisma.provider.findUnique({ where: { id: providerId } });
    if (!provider) throw new NotFoundException('Provider configuration was not found.');
    const previous = provider.credentialsCiphertext
      ? this.encryptionService.decryptJson<Record<string, any>>(provider.credentialsCiphertext)
      : {};
    const secret = dto.authentication?.secret || previous.integration?.authentication?.secret || previous.apiKey;
    if (dto.authentication?.type && dto.authentication.type !== 'NONE' && !secret) {
      throw new BadRequestException('Authentication secret is required for the selected authentication type.');
    }
    const integration: ExternalProviderIntegrationConfig = {
      providerCode: provider.code,
      baseUrl: dto.baseUrl,
      timeoutMs: dto.timeoutMs || provider.timeoutMs || 10000,
      authentication: {
        type: dto.authentication?.type || 'NONE',
        secret,
        headerName: dto.authentication?.headerName || previous.integration?.authentication?.headerName,
      },
      endpoints: dto.endpoints,
    };
    this.externalAdapter.validateIntegrationConfig(integration);
    const payload = {
      ...previous,
      apiKey: undefined,
      integration,
    };
    const updated = await this.prisma.$transaction(async (tx) => {
      const record = await tx.provider.update({
        where: { id: providerId },
        data: {
          type: 'EXTERNAL_API',
          baseUrl: dto.baseUrl,
          timeoutMs: dto.timeoutMs || provider.timeoutMs || 10000,
          credentialsCiphertext: this.encryptionService.encryptJson(payload),
          apiKey: null,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: actorUserId, action: 'PROVIDER_INTEGRATION_CONFIGURED',
          entityName: 'Provider', entityId: providerId,
          newValues: { baseUrl: dto.baseUrl, endpoints: Object.keys(dto.endpoints || {}), authenticationType: integration.authentication.type },
        },
      });
      return record;
    }, { isolationLevel: 'Serializable' });
    return { success: true, providerId: updated.id, providerCode: updated.code, configuredEndpoints: Object.keys(dto.endpoints || {}), credentialsStoredEncrypted: true };
  }

  async testProviderConnectivity(providerId: string, actorUserId: string) {
    if (!actorUserId) throw new BadRequestException('Authenticated operator identity is required.');
    const provider = await this.prisma.provider.findUnique({ where: { id: providerId } });
    if (!provider) throw new NotFoundException(`Provider ${providerId} not found`);
    if (provider.type !== 'EXTERNAL_API') {
      throw new ServiceUnavailableException('Connection tests currently require an explicitly configured EXTERNAL_API provider.');
    }
    const config = await this.loadExternalIntegration(provider);
    const result = await this.externalAdapter.testConnection(config);
    let balance: any = undefined;
    if (result.balance) {
      balance = result.balance;
      await this.prisma.provider.update({
        where: { id: providerId },
        data: { balance: result.balance.balance, currency: result.balance.currency as CurrencyCode },
      });
    }
    await this.prisma.auditLog.create({
      data: {
        userId: actorUserId,
        action: 'PROVIDER_CONNECTION_TESTED', entityName: 'Provider', entityId: providerId,
        newValues: { status: result.status, latencyMs: result.latencyMs, httpStatus: result.httpStatus || null, balanceSynced: Boolean(balance) },
      },
    });
    return {
      success: true, provider: provider.name, code: provider.code,
      status: result.status, latencyMs: result.latencyMs, httpStatus: result.httpStatus,
      balance: balance ? { currency: balance.currency, balance: balance.balance, lastUpdated: balance.lastUpdated } : undefined,
    };
  }
}
