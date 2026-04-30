import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, Matches } from 'class-validator';
import {
  OTP_SEND_PURPOSES,
  type OtpSendPurpose,
} from '../../core/enums/auth.enums';

export class SendOtpDto {
  @ApiProperty({
    description: 'User phone number in Ivory Coast format',
    example: '+2250700000000',
  })
  @IsString()
  @Matches(/^\+225\d{10}$/, { message: 'Format : +225XXXXXXXXXX' })
  phone!: string;

  @ApiProperty({
    description: 'OTP use-case',
    enum: OTP_SEND_PURPOSES,
    example: 'REGISTRATION',
  })
  @IsIn(OTP_SEND_PURPOSES)
  purpose!: OtpSendPurpose;
}
