import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DynamicFieldInputType, ProductType } from '@digital-topup/shared';

export class DynamicFieldDto {
  @ApiProperty({ example: 'player_id', description: 'Internal field key' })
  @IsNotEmpty()
  @IsString()
  key: string;

  @ApiProperty({ example: 'Player ID', description: 'English label' })
  @IsNotEmpty()
  @IsString()
  label: string;

  @ApiProperty({ example: 'معرف اللاعب', description: 'Arabic label', required: false })
  @IsOptional()
  @IsString()
  labelAr?: string;

  @ApiProperty({ enum: DynamicFieldInputType, example: DynamicFieldInputType.TEXT })
  @IsEnum(DynamicFieldInputType)
  type: DynamicFieldInputType;

  @ApiProperty({ example: true })
  @IsBoolean()
  required: boolean;

  @ApiProperty({ example: '^[0-9]{5,15}$', required: false })
  @IsOptional()
  @IsString()
  validationRegex?: string;

  @ApiProperty({ example: 'e.g. 5123456789', required: false })
  @IsOptional()
  @IsString()
  placeholder?: string;

  @ApiProperty({ example: 'مثال: 5123456789', required: false })
  @IsOptional()
  @IsString()
  placeholderAr?: string;

  @ApiProperty({ example: 'Found in your profile tab', required: false })
  @IsOptional()
  @IsString()
  helperText?: string;
}

export class CreateGameDto {
  @ApiProperty({ example: 'pubg-mobile' })
  @IsNotEmpty()
  @IsString()
  slug: string;

  @ApiProperty({ example: 'PUBG Mobile' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 'ببجي موبايل' })
  @IsNotEmpty()
  @IsString()
  nameAr: string;

  @ApiProperty({ example: 'Instant UC direct recharge', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'شحن شدات فوري', required: false })
  @IsOptional()
  @IsString()
  descriptionAr?: string;

  @ApiProperty({ example: '/images/games/pubg.png', required: false })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiProperty({ example: 'category-uuid-here', required: false })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({ type: [DynamicFieldDto], description: 'Dynamic fields required for this game' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DynamicFieldDto)
  playerFields: DynamicFieldDto[];

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsNumber()
  displayOrder?: number;
}

export class CreateProductPackageDto {
  @ApiProperty({ example: 'product-uuid-here' })
  @IsNotEmpty()
  @IsString()
  productId: string;

  @ApiProperty({ example: '60 UC' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: '60 شدة' })
  @IsNotEmpty()
  @IsString()
  nameAr: string;

  @ApiProperty({ example: 'PUBG-60-UC-V2' })
  @IsNotEmpty()
  @IsString()
  sku: string;

  @ApiProperty({ example: '60 UC' })
  @IsNotEmpty()
  @IsString()
  amountValue: string;

  @ApiProperty({ example: 0.88, description: 'Provider cost price' })
  @IsNumber()
  @IsPositive()
  costPrice: number;

  @ApiProperty({ example: 1.05, description: 'Retail price charged to customer' })
  @IsNumber()
  @IsPositive()
  retailPrice: number;

  @ApiProperty({ example: 'USD', required: false })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsNumber()
  displayOrder?: number;
}
