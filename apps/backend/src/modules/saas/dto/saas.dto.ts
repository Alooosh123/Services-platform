import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  SaaSBillingCycle,
  SaaSSubscriptionStatus,
  SaaSTenantStatus,
  CurrencyCode,
} from '@digital-topup/shared';

export class CreateTenantDto {
  @ApiProperty({ description: 'اسم المنصة / المتجر للمشترك', example: 'متجر الصقر للخدمات الرقمية' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'المعرف الفريد (Slug)', example: 'falcon-topup' })
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiPropertyOptional({ description: 'النطاق المخصص أو الفرعي', example: 'topup.falcon.ye' })
  @IsString()
  @IsOptional()
  domain?: string;

  @ApiProperty({ description: 'اسم مالك المتجر / المسؤول', example: 'م. أحمد الحميري' })
  @IsString()
  @IsNotEmpty()
  ownerName: string;

  @ApiProperty({ description: 'البريد الإلكتروني لمالك المتجر', example: 'falcon@store.ye' })
  @IsString()
  @IsNotEmpty()
  ownerEmail: string;

  @ApiProperty({ description: 'رقم هاتف المالك للتواصل والتوثيق', example: '+967771234567' })
  @IsString()
  @IsNotEmpty()
  ownerPhone: string;

  @ApiProperty({
    description: 'دورة الاشتراك المختارة (WEEKLY: أسبوعي، MONTHLY: شهري، ANNUAL: سنوي)',
    enum: SaaSBillingCycle,
    example: SaaSBillingCycle.MONTHLY,
  })
  @IsEnum(SaaSBillingCycle)
  billingCycle: SaaSBillingCycle;

  @ApiPropertyOptional({ description: 'ملاحظات إضافية', example: 'مشترك معتمد بمحافظة تعز' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateTenantStatusDto {
  @ApiProperty({
    description: 'حالة المشترك الجديدة',
    enum: SaaSTenantStatus,
    example: SaaSTenantStatus.ACTIVE,
  })
  @IsEnum(SaaSTenantStatus)
  status: SaaSTenantStatus;

  @ApiPropertyOptional({ description: 'سبب التعديل أو التعليق إن وجد' })
  @IsString()
  @IsOptional()
  reason?: string;
}

export class RenewSubscriptionDto {
  @ApiProperty({
    description: 'دورة التجديد (WEEKLY: أسبوعي، MONTHLY: شهري، ANNUAL: سنوي)',
    enum: SaaSBillingCycle,
    example: SaaSBillingCycle.MONTHLY,
  })
  @IsEnum(SaaSBillingCycle)
  billingCycle: SaaSBillingCycle;

  @ApiPropertyOptional({ description: 'عملة الفاتورة', enum: CurrencyCode, default: CurrencyCode.USD })
  @IsEnum(CurrencyCode)
  @IsOptional()
  currency?: CurrencyCode;
}

export class UpdatePlanPriceDto {
  @ApiProperty({ description: 'السعر بالدولار الأمريكي', example: 49.0 })
  @IsNumber()
  @Min(0)
  priceUsd: number;

  @ApiProperty({ description: 'السعر بالريال اليمني', example: 35000.0 })
  @IsNumber()
  @Min(0)
  priceYer: number;

  @ApiProperty({ description: 'السعر بالريال السعودي', example: 185.0 })
  @IsNumber()
  @Min(0)
  priceSar: number;
}

export class CreateInvoiceDto {
  @ApiProperty({ description: 'معرف المتجر' })
  @IsString()
  @IsNotEmpty()
  tenantId: string;

  @ApiProperty({ description: 'المبلغ المستحق', example: 49.0 })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({ enum: CurrencyCode, default: CurrencyCode.USD })
  @IsEnum(CurrencyCode)
  currency: CurrencyCode;

  @ApiProperty({ enum: SaaSBillingCycle })
  @IsEnum(SaaSBillingCycle)
  billingCycle: SaaSBillingCycle;

  @ApiPropertyOptional({ description: 'معرف الاشتراك المرتبط بالفاتورة' })
  @IsString()
  @IsOptional()
  subscriptionId?: string;
}

export class MarkSaasInvoicePaidDto {
  @ApiProperty({ description: 'قناة أو طريقة الدفع المستخدمة', example: 'JAIB_MANUAL' })
  @IsString()
  @IsNotEmpty()
  paymentMethod: string;

  @ApiProperty({ description: 'رقم مرجع الحوالة أو إيصال الدفع', example: 'TX-2026-000123' })
  @IsString()
  @IsNotEmpty()
  referenceNumber: string;
}
