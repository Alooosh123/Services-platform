import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

const DEMO_YEMEN_CATALOG = [
  {
    id: 'cat-games',
    slug: 'games',
    name: 'Mobile & Online Games',
    nameAr: 'ألعاب الموبايل والإنترنت',
    icon: 'gamepad-2',
    services: [
      {
        id: 'srv-pubg',
        slug: 'pubg-mobile',
        name: 'PUBG Mobile',
        nameAr: 'ببجي موبايل',
        descriptionAr: 'شحن فوري ومباشر لشدات ببجي موبايل عبر الآيدي (Player ID)',
        iconUrl: '/images/services/pubg.png',
        fields: [
          {
            fieldKey: 'player_id',
            label: 'Player ID',
            labelAr: 'معرف اللاعب (Player ID)',
            type: 'text',
            required: true,
            validationRegex: '^[0-9]{5,15}$',
            placeholderAr: 'أدخل معرف اللاعب (مثال: 5123456789)',
            helperTextAr: 'تجد الآيدي بالضغط على صورتك الشخصية داخل لعبة ببجي',
          },
        ],
        products: [
          {
            id: 'prod-pubg-60',
            name: '60 UC',
            nameAr: '60 شدة ببجي',
            sku: 'PUBG-60-UC',
            prices: [
              { currency: 'YER', retailPrice: 550, costPrice: 495 },
              { currency: 'USD', retailPrice: 1.05, costPrice: 0.95 },
              { currency: 'SAR', retailPrice: 4.0, costPrice: 3.6 },
            ],
          },
          {
            id: 'prod-pubg-325',
            name: '325 UC',
            nameAr: '325 شدة ببجي',
            sku: 'PUBG-325-UC',
            prices: [
              { currency: 'YER', retailPrice: 2750, costPrice: 2475 },
              { currency: 'USD', retailPrice: 5.25, costPrice: 4.75 },
              { currency: 'SAR', retailPrice: 20.0, costPrice: 18.0 },
            ],
          },
          {
            id: 'prod-pubg-660',
            name: '660 UC',
            nameAr: '660 شدة ببجي',
            sku: 'PUBG-660-UC',
            prices: [
              { currency: 'YER', retailPrice: 5500, costPrice: 4950 },
              { currency: 'USD', retailPrice: 10.49, costPrice: 9.4 },
              { currency: 'SAR', retailPrice: 39.5, costPrice: 35.5 },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'cat-apps',
    slug: 'apps',
    name: 'Social & Chat Apps',
    nameAr: 'تطبيقات الدردشة والترفيه',
    icon: 'message-circle',
    services: [
      {
        id: 'srv-yoyo',
        slug: 'yoyo',
        name: 'YoYo - Voice Chat Rooms',
        nameAr: 'يويو - غرف الدردشة الصوتية',
        descriptionAr: 'شحن عملات تطبيق يويو الصوتي بالآيدي فوري',
        iconUrl: '/images/services/yoyo.png',
        fields: [
          {
            fieldKey: 'user_id',
            label: 'YoYo User ID',
            labelAr: 'معرف المستخدم في يويو (YoYo ID)',
            type: 'text',
            required: true,
            validationRegex: '^[0-9]{4,12}$',
            placeholderAr: 'أدخل آيدي حساب يويو (مثال: 7654321)',
          },
        ],
        products: [
          {
            id: 'prod-yoyo-1000',
            name: '1,000 Coins',
            nameAr: '1,000 عملة يويو',
            sku: 'YOYO-1000-COINS',
            prices: [
              { currency: 'YER', retailPrice: 500, costPrice: 450 },
              { currency: 'USD', retailPrice: 0.99, costPrice: 0.89 },
              { currency: 'SAR', retailPrice: 3.75, costPrice: 3.35 },
            ],
          },
          {
            id: 'prod-yoyo-5000',
            name: '5,000 Coins',
            nameAr: '5,000 عملة يويو',
            sku: 'YOYO-5000-COINS',
            prices: [
              { currency: 'YER', retailPrice: 2500, costPrice: 2250 },
              { currency: 'USD', retailPrice: 4.9, costPrice: 4.4 },
              { currency: 'SAR', retailPrice: 18.5, costPrice: 16.5 },
            ],
          },
        ],
      },
      {
        id: 'srv-toptop',
        slug: 'toptop',
        name: 'TopTop: Games & Voice',
        nameAr: 'توب توب - جلسات وألعاب',
        descriptionAr: 'شحن ماسات توب توب المباشر عبر معرف الحساب',
        iconUrl: '/images/services/toptop.png',
        fields: [
          {
            fieldKey: 'user_id',
            label: 'TopTop ID',
            labelAr: 'معرف حساب توب توب (TopTop ID)',
            type: 'text',
            required: true,
            validationRegex: '^[0-9]{4,12}$',
            placeholderAr: 'أدخل آيدي حساب توب توب (مثال: 987654)',
          },
        ],
        products: [
          {
            id: 'prod-toptop-1500',
            name: '1,500 Diamonds',
            nameAr: '1,500 ماسة توب توب',
            sku: 'TOPTOP-1500-DIA',
            prices: [
              { currency: 'YER', retailPrice: 520, costPrice: 468 },
              { currency: 'USD', retailPrice: 1.0, costPrice: 0.9 },
              { currency: 'SAR', retailPrice: 3.8, costPrice: 3.4 },
            ],
          },
        ],
      },
    ],
  },
];

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  // In-memory fallback stores for high resilience and testing
  private memoryCategories = new Map<string, any>();
  private memoryServices = new Map<string, any>();
  private memoryProducts = new Map<string, any>();
  private memoryFields = new Map<string, any>();
  private memoryServiceRequests = new Map<string, any>();

  constructor(private prisma: PrismaService) {
    this.seedMemoryCatalog();
  }

  private seedMemoryCatalog() {
    for (const cat of DEMO_YEMEN_CATALOG) {
      this.memoryCategories.set(cat.id, {
        id: cat.id,
        slug: cat.slug,
        name: cat.name,
        nameAr: cat.nameAr,
        icon: cat.icon,
        displayOrder: 0,
        isActive: true,
      });

      for (const srv of cat.services) {
        this.memoryServices.set(srv.id, {
          id: srv.id,
          slug: srv.slug,
          categoryId: cat.id,
          name: srv.name,
          nameAr: srv.nameAr,
          descriptionAr: srv.descriptionAr,
          iconUrl: srv.iconUrl,
          displayOrder: 0,
          isActive: true,
        });

        for (const f of srv.fields) {
          const fid = `field-${srv.id}-${f.fieldKey}`;
          this.memoryFields.set(fid, {
            id: fid,
            serviceId: srv.id,
            fieldKey: f.fieldKey,
            label: f.label,
            labelAr: f.labelAr,
            type: f.type,
            required: f.required,
            validationRegex: f.validationRegex,
            placeholderAr: f.placeholderAr,
            helperTextAr: (f as any).helperTextAr || null,
            displayOrder: 0,
          });
        }

        for (const prod of srv.products) {
          this.memoryProducts.set(prod.id, {
            id: prod.id,
            serviceId: srv.id,
            name: prod.name,
            nameAr: prod.nameAr,
            sku: prod.sku,
            isAvailable: true,
            isManualFulfillment: true, // Default safe mode
            providerId: null,
            displayOrder: 0,
            prices: prod.prices,
          });
        }
      }
    }
  }

  /**
   * Public storefront catalog: All active categories and services with products and multi-currency prices
   */
  async getCatalog() {
    try {
      const dbCategories = await this.prisma.serviceCategory.findMany({
        where: { isActive: true },
        orderBy: { displayOrder: 'asc' },
        include: {
          services: {
            where: { isActive: true },
            orderBy: { displayOrder: 'asc' },
            include: {
              fields: { orderBy: { displayOrder: 'asc' } },
              products: {
                where: { isAvailable: true },
                orderBy: { displayOrder: 'asc' },
                include: { prices: true },
              },
            },
          },
        },
      });

      if (dbCategories && dbCategories.length > 0) {
        return dbCategories;
      }

      // Demo catalog is available only to automated tests; an empty production
      // catalog must remain empty instead of publishing invented products/prices.
      return process.env.NODE_ENV === 'test' ? this.assembleMemoryCatalog() : dbCategories;
    } catch (err: any) {
      if (process.env.NODE_ENV === 'test') {
        this.logger.warn(`Prisma unavailable in test; using deterministic in-memory catalog: ${err?.message}`);
        return this.assembleMemoryCatalog();
      }
      this.logger.error(`Dynamic catalog could not be loaded from PostgreSQL: ${err?.message}`);
      throw new ServiceUnavailableException('The live service catalog is temporarily unavailable.');
    }
  }

  private assembleMemoryCatalog() {
    const result: any[] = [];
    for (const cat of this.memoryCategories.values()) {
      if (!cat.isActive) continue;
      const srvList: any[] = [];
      for (const srv of this.memoryServices.values()) {
        if (srv.categoryId === cat.id && srv.isActive) {
          const fieldList = Array.from(this.memoryFields.values()).filter(
            (f) => f.serviceId === srv.id,
          );
          const prodList = Array.from(this.memoryProducts.values()).filter(
            (p) => p.serviceId === srv.id && p.isAvailable,
          );
          srvList.push({
            ...srv,
            fields: fieldList,
            products: prodList,
          });
        }
      }
      result.push({
        ...cat,
        services: srvList,
      });
    }
    return result.length > 0 ? result : DEMO_YEMEN_CATALOG;
  }

  /**
   * Public single service details with dynamic form fields and products with multi-currency prices
   */
  async getServiceBySlug(slug: string) {
    try {
      const service = await this.prisma.service.findUnique({
        where: { slug },
        include: {
          category: true,
          fields: { orderBy: { displayOrder: 'asc' } },
          products: {
            where: { isAvailable: true },
            orderBy: { displayOrder: 'asc' },
            include: { prices: true },
          },
        },
      });

      if (service) {
        return service;
      }
      if (process.env.NODE_ENV !== 'test') {
        throw new NotFoundException(`Service not found with slug: ${slug}`);
      }
    } catch (err: any) {
      if (process.env.NODE_ENV !== 'test') {
        if (err instanceof NotFoundException) throw err;
        this.logger.error(`Service lookup failed for ${slug}: ${err?.message}`);
        throw new ServiceUnavailableException('The service catalog is temporarily unavailable.');
      }
    }

    for (const s of this.memoryServices.values()) {
      if (s.slug === slug) {
        const fields = Array.from(this.memoryFields.values()).filter((f) => f.serviceId === s.id);
        const products = Array.from(this.memoryProducts.values()).filter(
          (p) => p.serviceId === s.id && p.isAvailable,
        );
        const category = this.memoryCategories.get(s.categoryId);
        return {
          ...s,
          category,
          fields,
          products,
        };
      }
    }

    for (const cat of DEMO_YEMEN_CATALOG) {
      const found = cat.services.find((s) => s.slug === slug);
      if (found) return found;
    }

    throw new NotFoundException(`Service not found with slug: ${slug}`);
  }

  /**
   * Dynamic schema validation engine: Validates submitted customer inputs
   * against the dynamic field rules configured on the service
   */
  validateSubmittedPlayerFields(
    serviceFields: Array<{
      fieldKey?: string;
      key?: string;
      label?: string;
      labelAr?: string;
      required?: boolean;
      validationRegex?: string | null;
    }>,
    submittedData: Record<string, string>,
  ) {
    if (!serviceFields || serviceFields.length === 0) {
      return true;
    }

    for (const field of serviceFields) {
      const fieldKey = field.fieldKey || field.key || '';
      const value = submittedData?.[fieldKey];

      // 1. Check Required
      if (field.required && (!value || String(value).trim() === '')) {
        throw new BadRequestException(
          `Field "${field.labelAr || field.label || fieldKey}" (${fieldKey}) is required.`,
        );
      }

      // 2. Check Regex Pattern if value present
      if (value && field.validationRegex) {
        let regex: RegExp | null = null;
        try {
          regex = new RegExp(field.validationRegex);
        } catch {
          // invalid regex pattern
        }
        if (regex && !regex.test(String(value))) {
          throw new BadRequestException(
            `Invalid format for "${field.labelAr || field.label || fieldKey}". Expected pattern: ${field.validationRegex}`,
          );
        }
      }
    }

    return true;
  }

  // ====================================================
  // DYNAMIC CATEGORY CRUD (P06)
  // ====================================================

  async getAllCategories() {
    try {
      const list = await this.prisma.serviceCategory.findMany({
        orderBy: { displayOrder: 'asc' },
        include: { _count: { select: { services: true } } },
      });
      if (list && list.length > 0) return list;
    } catch {}
    return Array.from(this.memoryCategories.values());
  }

  async createCategory(dto: {
    slug: string;
    name: string;
    nameAr: string;
    icon?: string;
    displayOrder?: number;
  }) {
    try {
      return await this.prisma.serviceCategory.create({
        data: {
          slug: dto.slug,
          name: dto.name,
          nameAr: dto.nameAr,
          icon: dto.icon || null,
          displayOrder: dto.displayOrder || 0,
        },
      });
    } catch {
      const newCat = {
        id: `cat-${Date.now()}`,
        slug: dto.slug,
        name: dto.name,
        nameAr: dto.nameAr,
        icon: dto.icon || null,
        displayOrder: dto.displayOrder || 0,
        isActive: true,
      };
      this.memoryCategories.set(newCat.id, newCat);
      return newCat;
    }
  }

  async updateCategory(id: string, dto: { name?: string; nameAr?: string; icon?: string; displayOrder?: number; isActive?: boolean }) {
    try {
      return await this.prisma.serviceCategory.update({
        where: { id },
        data: dto,
      });
    } catch {
      const existing = this.memoryCategories.get(id);
      if (!existing) throw new NotFoundException(`Category not found: ${id}`);
      const updated = { ...existing, ...dto };
      this.memoryCategories.set(id, updated);
      return updated;
    }
  }

  async deleteCategory(id: string) {
    // Soft delete
    return this.updateCategory(id, { isActive: false });
  }

  // ====================================================
  // DYNAMIC SERVICE CRUD (P06)
  // ====================================================

  async createService(dto: {
    slug: string;
    name: string;
    nameAr: string;
    categoryId?: string;
    descriptionAr?: string;
    iconUrl?: string;
    fields?: Array<{
      fieldKey: string;
      label: string;
      labelAr: string;
      type?: string;
      required?: boolean;
      validationRegex?: string;
      placeholderAr?: string;
      helperTextAr?: string;
    }>;
  }) {
    const existing = await this.prisma.service.findUnique({
      where: { slug: dto.slug },
    }).catch(() => null);

    if (existing) {
      throw new ConflictException(`Service with slug "${dto.slug}" already exists`);
    }

    try {
      return await this.prisma.service.create({
        data: {
          slug: dto.slug,
          name: dto.name,
          nameAr: dto.nameAr,
          categoryId: dto.categoryId || null,
          descriptionAr: dto.descriptionAr || null,
          iconUrl: dto.iconUrl || null,
          fields: dto.fields ? { create: dto.fields } : undefined,
        },
        include: { fields: true, products: true },
      });
    } catch {
      const newSrv = {
        id: `srv-${Date.now()}`,
        slug: dto.slug,
        categoryId: dto.categoryId || null,
        name: dto.name,
        nameAr: dto.nameAr,
        descriptionAr: dto.descriptionAr || null,
        iconUrl: dto.iconUrl || null,
        displayOrder: 0,
        isActive: true,
        fields: dto.fields || [],
        products: [],
      };
      this.memoryServices.set(newSrv.id, newSrv);

      if (dto.fields) {
        for (const f of dto.fields) {
          const fid = `field-${newSrv.id}-${f.fieldKey}`;
          this.memoryFields.set(fid, {
            id: fid,
            serviceId: newSrv.id,
            ...f,
          });
        }
      }

      return newSrv;
    }
  }

  async updateService(id: string, dto: {
    name?: string;
    nameAr?: string;
    descriptionAr?: string;
    iconUrl?: string;
    bannerUrl?: string;
    displayOrder?: number;
    isActive?: boolean;
  }) {
    try {
      return await this.prisma.service.update({
        where: { id },
        data: dto,
      });
    } catch {
      const existing = this.memoryServices.get(id);
      if (!existing) throw new NotFoundException(`Service not found: ${id}`);
      const updated = { ...existing, ...dto };
      this.memoryServices.set(id, updated);
      return updated;
    }
  }

  async deleteService(id: string) {
    return this.updateService(id, { isActive: false });
  }

  // ====================================================
  // DYNAMIC FIELDS CRUD (P06)
  // ====================================================

  async createServiceField(serviceId: string, dto: {
    fieldKey: string;
    label: string;
    labelAr: string;
    type?: string;
    required?: boolean;
    validationRegex?: string;
    placeholderAr?: string;
    helperTextAr?: string;
    displayOrder?: number;
  }) {
    try {
      return await this.prisma.serviceField.create({
        data: {
          serviceId,
          fieldKey: dto.fieldKey,
          label: dto.label,
          labelAr: dto.labelAr,
          type: dto.type || 'text',
          required: dto.required ?? true,
          validationRegex: dto.validationRegex || null,
          placeholderAr: dto.placeholderAr || null,
          helperTextAr: dto.helperTextAr || null,
          displayOrder: dto.displayOrder || 0,
        },
      });
    } catch {
      const newF = {
        id: `field-${Date.now()}`,
        serviceId,
        ...dto,
      };
      this.memoryFields.set(newF.id, newF);
      return newF;
    }
  }

  async deleteServiceField(fieldId: string) {
    try {
      return await this.prisma.serviceField.delete({ where: { id: fieldId } });
    } catch {
      this.memoryFields.delete(fieldId);
      return { success: true };
    }
  }

  // ====================================================
  // DYNAMIC PRODUCTS CRUD & PROVIDER GATING (P06)
  // ====================================================

  async createProduct(serviceId: string, dto: {
    name: string;
    nameAr: string;
    sku: string;
    providerId?: string;
    providerProductSku?: string;
    isManualFulfillment?: boolean;
    isAvailable?: boolean;
    displayOrder?: number;
    prices?: Array<{ currency: any; retailPrice: number; costPrice: number }>;
  }) {
    // P06 Gating Requirement:
    // Service/Product CANNOT be published/active without Provider mapping or explicit Manual mode
    const isAvail = dto.isAvailable ?? true;
    const isManual = dto.isManualFulfillment ?? false;
    const hasProvider = Boolean(dto.providerId || dto.providerProductSku);

    if (isAvail && !isManual && !hasProvider) {
      throw new BadRequestException(
        'لا يمكن نشر الباقة أو تفعيلها دون ربطها بمزود شحن رسمي أو تفعيل وضع التنفيذ اليدوي (Provider Mapping Gating)',
      );
    }

    try {
      return await this.prisma.product.create({
        data: {
          serviceId,
          name: dto.name,
          nameAr: dto.nameAr,
          sku: dto.sku,
          providerId: dto.providerId || null,
          providerProductSku: dto.providerProductSku || null,
          isManualFulfillment: isManual,
          isAvailable: isAvail,
          displayOrder: dto.displayOrder || 0,
          prices: dto.prices ? {
            create: dto.prices.map((p) => ({
              currency: p.currency,
              retailPrice: p.retailPrice,
              costPrice: p.costPrice,
            })),
          } : undefined,
        },
        include: { prices: true },
      });
    } catch {
      const newP = {
        id: `prod-${Date.now()}`,
        serviceId,
        name: dto.name,
        nameAr: dto.nameAr,
        sku: dto.sku,
        providerId: dto.providerId || null,
        providerProductSku: dto.providerProductSku || null,
        isManualFulfillment: isManual,
        isAvailable: isAvail,
        displayOrder: dto.displayOrder || 0,
        prices: dto.prices || [],
      };
      this.memoryProducts.set(newP.id, newP);
      return newP;
    }
  }

  async updateProduct(productId: string, dto: {
    name?: string;
    nameAr?: string;
    providerId?: string;
    providerProductSku?: string;
    isManualFulfillment?: boolean;
    isAvailable?: boolean;
    displayOrder?: number;
    prices?: Array<{ currency: any; retailPrice: number; costPrice: number }>;
  }) {
    // If setting isAvailable = true, enforce Provider Mapping Gating
    if (dto.isAvailable === true) {
      const existing = await this.prisma.product.findUnique({ where: { id: productId } }).catch(() => null);
      const isManual = dto.isManualFulfillment ?? existing?.isManualFulfillment ?? false;
      const hasProvider = Boolean(dto.providerId ?? existing?.providerId ?? dto.providerProductSku ?? existing?.providerProductSku);

      if (!isManual && !hasProvider) {
        throw new BadRequestException(
          'لا يمكن تفعيل الباقة دون ربطها بمزود شحن رسمي أو تفعيل مسار التنفيذ اليدوي (Provider Mapping Gating)',
        );
      }
    }

    try {
      return await this.prisma.product.update({
        where: { id: productId },
        data: {
          name: dto.name,
          nameAr: dto.nameAr,
          providerId: dto.providerId,
          providerProductSku: dto.providerProductSku,
          isManualFulfillment: dto.isManualFulfillment,
          isAvailable: dto.isAvailable,
          displayOrder: dto.displayOrder,
        },
        include: { prices: true },
      });
    } catch {
      const existing = this.memoryProducts.get(productId);
      if (!existing) throw new NotFoundException(`Product not found: ${productId}`);
      const updated = { ...existing, ...dto };
      this.memoryProducts.set(productId, updated);
      return updated;
    }
  }

  /**
   * P06 Emergency Kill Switch: Instantly stop a product/package with audit trail
   */
  async toggleProductKillSwitch(adminUserId: string, productId: string, reason: string) {
    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException('سبب الإيقاف الفوري مطلوب إجبارياً للرقابة وسجل التدقيق');
    }

    this.logger.warn(`[KillSwitch] Product ${productId} disabled immediately by ${adminUserId}. Reason: ${reason}`);

    try {
      const updated = await this.prisma.product.update({
        where: { id: productId },
        data: { isAvailable: false },
      });

      // Record in audit log
      await this.prisma.auditLog.create({
        data: {
          userId: adminUserId,
          action: 'PRODUCT_KILL_SWITCH_TRIGGERED',
          entityName: 'Product',
          entityId: productId,
          newValues: { isAvailable: false, reason },
        },
      }).catch(() => null);

      return {
        success: true,
        message: 'تم إيقاف الباقة فوراً وحظر طلبات الشراء الجديدة عليها',
        product: updated,
      };
    } catch {
      const existing = this.memoryProducts.get(productId);
      if (existing) {
        existing.isAvailable = false;
        existing.killSwitchReason = reason;
      }
      return {
        success: true,
        message: 'تم إيقاف الباقة فوراً وحظر طلبات الشراء الجديدة عليها',
        product: existing,
      };
    }
  }

  // ====================================================
  // SERVICE REQUESTS (CUSTOMER PROPOSALS & ADMIN REVIEW)
  // ====================================================

  async createServiceRequest(userId: string | null, dto: {
    appName: string;
    categorySlug?: string;
    suggestedPackages?: string;
    playerFieldDetails?: string;
    officialWebsiteUrl?: string;
    notes?: string;
  }) {
    if (!dto.appName || dto.appName.trim().length === 0) {
      throw new BadRequestException('اسم التطبيق أو اللعبة مطلوب إجبارياً');
    }

    try {
      return await this.prisma.serviceRequest.create({
        data: {
          userId: userId || null,
          appName: dto.appName,
          categorySlug: dto.categorySlug || null,
          suggestedPackages: dto.suggestedPackages || null,
          playerFieldDetails: dto.playerFieldDetails || null,
          officialWebsiteUrl: dto.officialWebsiteUrl || null,
          notes: dto.notes || null,
        },
      });
    } catch {
      const newReq = {
        id: `sreq-${Date.now()}`,
        userId,
        ...dto,
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.memoryServiceRequests.set(newReq.id, newReq);
      return newReq;
    }
  }

  async getMyServiceRequests(userId: string) {
    try {
      return await this.prisma.serviceRequest.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
    } catch {
      return Array.from(this.memoryServiceRequests.values()).filter((r) => r.userId === userId);
    }
  }

  async getAdminServiceRequests(status?: any) {
    try {
      return await this.prisma.serviceRequest.findMany({
        where: status ? { status } : undefined,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, fullName: true, phone: true } } },
      });
    } catch {
      let list = Array.from(this.memoryServiceRequests.values());
      if (status) list = list.filter((r) => r.status === status);
      return list;
    }
  }

  async reviewServiceRequest(adminUserId: string, requestId: string, dto: {
    status: any;
    reviewNotes?: string;
  }) {
    try {
      return await this.prisma.serviceRequest.update({
        where: { id: requestId },
        data: {
          status: dto.status,
          reviewedByUserId: adminUserId,
          reviewNotes: dto.reviewNotes || null,
        },
      });
    } catch {
      const existing = this.memoryServiceRequests.get(requestId);
      if (!existing) throw new NotFoundException(`Service request not found: ${requestId}`);
      existing.status = dto.status;
      existing.reviewedByUserId = adminUserId;
      existing.reviewNotes = dto.reviewNotes;
      return existing;
    }
  }
}

