import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class InventoryQueryDto {
  @ApiProperty({ required: false, description: 'Filter inventory by specific product ID' })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiProperty({ required: false, default: 5, description: 'Low stock warning threshold' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  lowStockThreshold?: number;
}
