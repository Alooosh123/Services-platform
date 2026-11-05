import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SendPhoneOtpDto {
  @ApiProperty({
    description: 'رقم الهاتف اليمني (محلي 77XXXXXXX أو دولي +9677XXXXXXX)',
    example: '770123456',
  })
  @IsNotEmpty({ message: 'رقم الهاتف مطلوب' })
  @IsString()
  phone: string;
}
