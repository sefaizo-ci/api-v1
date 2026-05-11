import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, Matches } from 'class-validator';
import {
  LOGIN_APPS,
  OTP_SEND_PURPOSES,
  type LoginApp,
  type OtpSendPurpose,
} from '../../core/enums/auth.enums';

export class SendOtpDto {
  @ApiProperty({
    description: 'Phone number (+225XXXXXXXXXX)',
    example: '+2250700000000',
  })
  @IsString()
  @Matches(/^\+225\d{10}$/, { message: 'Format : +225XXXXXXXXXX' })
  phone!: string;

  @ApiProperty({
    description: 'OTP purpose',
    enum: OTP_SEND_PURPOSES,
    example: 'REGISTRATION',
  })
  @IsIn(OTP_SEND_PURPOSES)
  purpose!: OtpSendPurpose;

  @ApiProperty({
    description: 'Target app (CLIENT or PROFESSIONAL)',
    enum: LOGIN_APPS,
    example: 'CLIENT',
  })
  @IsIn(LOGIN_APPS)
  app!: LoginApp;
}
