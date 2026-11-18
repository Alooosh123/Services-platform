import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewPaymentSenderAccountDto {
  @ApiPropertyOptional({ description: 'Optional owner review note', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewNotes?: string;
}

export class RejectPaymentSenderAccountDto {
  @ApiPropertyOptional({ description: 'Mandatory reason sent back to the customer', maxLength: 500 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  rejectionReason: string;
}
