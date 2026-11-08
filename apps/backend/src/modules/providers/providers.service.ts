import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ITopupProviderAdapter } from './adapters/provider-adapter.interface';
import { MockProviderAdapter } from './adapters/mock-provider.adapter';
import { ManualProviderAdapter } from './adapters/manual-provider.adapter';
import { ExternalApiAdapter } from './adapters/external-api.adapter';
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
    const adapter = this.getAdapter(providerCode);
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

    const adapter = this.getAdapter(provider.code);
    const startTime = Date.now();

    let response: TopupProviderOrderResponse;
    let errorMessage: string | undefined;

    try {
      response = await adapter.submitOrder(request);
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
      data.credentialsCiphertext = this.encryptionService.encryptJson({ apiKey: dto.apiKey });
      data.apiKey = null;
    }
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.type !== undefined) data.type = dto.type as any;

    const updated = await this.prisma.$transaction(async (tx) => {
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

  async testProviderConnectivity(providerId: string) {
    if (process.env.NODE_ENV !== 'test') {
      throw new ServiceUnavailableException(
        'Real provider connectivity checks are disabled until a verified provider HTTP adapter with authenticated health and balance endpoints is configured.',
      );
    }
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
    });

    if (!provider) {
      throw new NotFoundException(`Provider ${providerId} not found`);
    }

    const adapter = this.getAdapter(provider.code);
    const balanceInfo = await adapter.fetchBalance();

    await this.prisma.provider.update({
      where: { id: providerId },
      data: {
        balance: balanceInfo.balance,
        currency: (balanceInfo.currency as CurrencyCode) || CurrencyCode.USD,
      },
    });

    return {
      success: true,
      provider: provider.name,
      code: provider.code,
      status: 'ONLINE',
      balance: balanceInfo,
    };
  }
}
