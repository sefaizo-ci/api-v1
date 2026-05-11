import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, Length, Matches } from 'class-validator';
import {
  LOGIN_APPS,
  OTP_SEND_PURPOSES,
  type LoginApp,
  type OtpSendPurpose,
} from '../../core/enums/auth.enums';

export class VerifyOtpDto {
  @ApiProperty({
    description: 'Phone number (+225XXXXXXXXXX)',
    example: '+2250700000000',
  })
  @IsString()
  @Matches(/^\+225\d{10}$/)
  phone!: string;

  @ApiProperty({
    description: '4-digit OTP code',
    example: '4821',
    minLength: 4,
    maxLength: 4,
  })
  @IsString()
  @Length(4, 4)
  @Matches(/^\d{4}$/, { message: 'Code OTP invalide.' })
  code!: string;

  @ApiProperty({
    description: 'OTP purpose (REGISTRATION or PIN_RESET)',
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
