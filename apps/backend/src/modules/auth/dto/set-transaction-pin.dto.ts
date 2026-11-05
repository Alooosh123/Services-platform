import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, Matches, MinLength } from 'class-validator';

export class SetTransactionPinDto {
  @ApiProperty({ description: 'Current account password' })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  currentPassword: string;

  @ApiProperty({ description: 'Six-digit financial transaction PIN', example: '482615' })
  @IsNotEmpty()
  @IsString()
  @Length(6, 6)
  @Matches(/^[0-9]{6}$/)
  pin: string;
}
