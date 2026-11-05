import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class AssignTierDto {
  @ApiProperty()
  @IsString()
  tierId: string;
}
