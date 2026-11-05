import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class PinItemInputDto {
  @ApiProperty({ description: 'The plain PIN / Voucher code to be encrypted' })
  @IsString()
  @IsNotEmpty()
  pinCode: string;

  @ApiProperty({ required: false, description: 'Optional card serial number' })
  @IsOptional()
  @IsString()
  serialNumber?: string;

  @ApiProperty({ required: false, description: 'Batch tracking identifier' })
  @IsOptional()
  @IsString()
  batchNumber?: string;

  @ApiProperty({ required: false, description: 'Expiration date ISO string' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class ImportPinsBatchDto {
  @ApiProperty({ description: 'Product ID in catalog for this digital card or voucher' })
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ type: [PinItemInputDto], description: 'List of PIN items to import and encrypt' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PinItemInputDto)
  pins: PinItemInputDto[];
}
