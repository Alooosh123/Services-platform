import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { PaymentChannelCode, PaymentSenderIdentifierType } from '@digital-topup/shared';

export class SavePaymentSenderAccountDto {
  @ApiProperty({ enum: PaymentChannelCode })
  @IsEnum(PaymentChannelCode)
  channelCode: PaymentChannelCode;

  @ApiProperty({ enum: PaymentSenderIdentifierType })
  @IsEnum(PaymentSenderIdentifierType)
  identifierType: PaymentSenderIdentifierType;

  @ApiProperty({ example: '+9677XXXXXXXX' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  identifier: string;

  @ApiProperty({ description: 'Customer explicitly consents to encrypted storage for transfer matching.' })
  @IsBoolean()
  consentAccepted: boolean;
}
