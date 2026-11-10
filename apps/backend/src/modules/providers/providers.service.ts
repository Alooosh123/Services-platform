import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ITopupProviderAdapter } from './adapters/provider-adapter.interface';
import { MockProviderAdapter } from './adapters/mock-provider.adapter';
import { ManualProviderAdapter } from './adapters/manual-provider.adapter';
import { ExternalApiAdapter } from './adapters/external-api.adapter';
import { EncryptionService } from '../../security/encryption.service';
import { getCurrentTenantId } from '../../tenant/tenant-context.store';
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
    const code = providerCode?.trim().toUpperCase();
    if (!code) throw new ServiceUnavailableException('لم يتم تعيين مزود تنفيذ للمنتج.');
    if (
      code === 'MOCK' &&
      (
        process.env.NODE_ENV === 'production' ||
        !!getCurrentTenantId() ||
        (process.env.NODE_ENV !== 'test' && process.env.ENABLE_MOCK_PROVIDERS !== 'true')
      )
    ) {
      throw new ServiceUnavailableException('محول MOCK محظور خارج اختبارات النظام أو بيئة تطوير محلية مفعلة صراحةً.');
    }
    const adapter = this.adapters.get(code);
    if (!adapter) {
      throw new ServiceUnavailableException(`لا يوجد محول مسجل للمزود ${code}؛ تم رفض التنفيذ دون تحويل إلى MOCK.`);
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
        errorCode: 'PROVIDER_RESULT_UNKNOWN',
        errorMessage: errorMessage + ' — النتيجة غير مؤكدة؛ تم الاحتفاظ بالحالة للمطابقة ومنع إعادة التنفيذ التلقائية.',
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
  async updateProvider(providerId: string, dto: UpdateProviderDto) {
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

    const updated = await this.prisma.provider.update({
      where: { id: providerId },
      data,
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
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
    });

    if (!provider) {
      throw new NotFoundException(`Provider ${providerId} not found`);
    }

    if (provider.code === 'MOCK' || provider.code === 'MANUAL') {
      throw new ServiceUnavailableException('لا يمكن اعتبار MOCK أو MANUAL اتصالاً خارجياً أو مزوداً برصيد آلي.');
    }
    const adapter = this.getAdapter(provider.code);
    // A provider-specific authenticated adapter is required for a live test.
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
