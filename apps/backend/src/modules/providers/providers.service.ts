import { Injectable, Logger, NotFoundException, ServiceUnavailableException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ITopupProviderAdapter } from './adapters/provider-adapter.interface';
import { MockProviderAdapter } from './adapters/mock-provider.adapter';
import { ManualProviderAdapter } from './adapters/manual-provider.adapter';
import { ExternalApiAdapter } from './adapters/external-api.adapter';
import { EncryptionService } from '../../security/encryption.service';
import { getCurrentTenantId } from '../../tenant/tenant-context.store';
import { isIP } from 'net';
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
    if (dto.baseUrl !== undefined) {
      const parsed = this.validateProviderBaseUrl(dto.baseUrl);
      data.baseUrl = parsed;
    }
    if (dto.apiKey && dto.credentials) {
      throw new BadRequestException('أرسل apiKey القديم أو كائن credentials متعدد الحقول، وليس الاثنين معاً.');
    }
    if (dto.credentials !== undefined) {
      const credentials = this.validateProviderCredentials(dto.credentials);
      data.credentialsCiphertext = this.encryptionService.encryptJson(credentials);
      data.apiKey = null;
    } else if (dto.apiKey !== undefined && dto.apiKey && !dto.apiKey.includes('****')) {
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

  private validateProviderCredentials(input: Record<string, string>): Record<string, string> {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('بيانات اعتماد المزود يجب أن تكون كائناً منظماً.');
    }
    const entries = Object.entries(input);
    if (!entries.length || entries.length > 40) {
      throw new BadRequestException('يجب إدخال حقل اعتماد واحد على الأقل وبحد أقصى 40 حقلاً.');
    }
    const result: Record<string, string> = {};
    let totalBytes = 0;
    for (const [key, value] of entries) {
      const normalizedKey = key.trim();
      if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(normalizedKey)) {
        throw new BadRequestException('اسم حقل اعتماد المزود غير صالح.');
      }
      if (typeof value !== 'string' || !value.trim() || value.length > 4096) {
        throw new BadRequestException(`قيمة الاعتماد للحقل ${normalizedKey} غير صالحة.`);
      }
      totalBytes += Buffer.byteLength(normalizedKey + value, 'utf8');
      result[normalizedKey] = value.trim();
    }
    if (totalBytes > 16384) {
      throw new BadRequestException('حجم بيانات اعتماد المزود يتجاوز الحد المسموح.');
    }
    return result;
  }

  private validateProviderBaseUrl(raw: string): string {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new BadRequestException('عنوان API للمزود غير صالح.');
    }
    if (
      !['https:', ...(process.env.NODE_ENV === 'test' ? ['http:'] : [])].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new BadRequestException('يجب أن يكون عنوان API رابط HTTPS عاماً دون بيانات دخول أو query أو fragment.');
    }
    const hostname = url.hostname.toLowerCase();
    const unbracketedHost = hostname.replace(/^\[|\]$/g, '');
    const ipVersion = isIP(unbracketedHost);
    const isLocalHost =
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      unbracketedHost === '::1' ||
      unbracketedHost === '::' ||
      unbracketedHost === '0.0.0.0';
    const octets = unbracketedHost.split('.').map(Number);
    const isPrivateIpv4 = ipVersion === 4 && (
      octets[0] === 10 ||
      octets[0] === 127 ||
      (octets[0] === 192 && octets[1] === 168) ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 169 && octets[1] === 254) ||
      octets[0] === 0
    );
    const isPrivateIpv6 = ipVersion === 6 && (
      unbracketedHost.startsWith('fc') ||
      unbracketedHost.startsWith('fd') ||
      unbracketedHost.startsWith('fe80:') ||
      unbracketedHost.startsWith('::ffff:127.') ||
      unbracketedHost.startsWith('::ffff:10.')
    );
    const allowedHosts = (process.env.PROVIDER_ALLOWED_HOSTS || '')
      .split(',')
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean);
    if (
      isLocalHost ||
      isPrivateIpv4 ||
      isPrivateIpv6 ||
      (process.env.NODE_ENV === 'production' && ipVersion !== 0) ||
      (process.env.NODE_ENV === 'production' && !allowedHosts.includes(hostname))
    ) {
      throw new BadRequestException('يمنع توجيه اتصالات المزود إلى عنوان محلي أو غير مدرج ضمن نطاقات المزود المعتمدة.');
    }
    return url.toString().replace(/\/$/, '');
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
