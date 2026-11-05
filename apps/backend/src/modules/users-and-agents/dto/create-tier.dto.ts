import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';

export class CreateTierDto {
  @ApiProperty()
  @IsString()
  code: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  nameAr: string;

  @ApiProperty({ default: 0 })
  @IsNumber()
  @Min(0)
  @Max(100)
  defaultDiscountPercent: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  dailyTransactionLimit?: number;

  @ApiProperty({ default: 0 })
  @IsInt()
  displayOrder: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
