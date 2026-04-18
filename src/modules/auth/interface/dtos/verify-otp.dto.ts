import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';
import {
  LOGIN_APPS,
  OTP_PUBLIC_PURPOSES,
  type LoginApp,
  type PublicOtpPurpose,
} from '../../core/enums/auth.enums';

export class VerifyOtpDto {
  @ApiProperty({
    description: 'User phone number in Ivory Coast format',
    example: '+2250700000000',
  })
  @IsString()
  @Matches(/^\+225\d{10}$/)
  phone!: string;

  @ApiProperty({
    description: '6-digit OTP code sent to the user',
    example: '123456',
    minLength: 6,
    maxLength: 6,
  })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'Code OTP invalide.' })
  code!: string;

  @ApiProperty({
    description: 'OTP use-case',
    enum: OTP_PUBLIC_PURPOSES,
    example: 'REGISTRATION',
  })
  @IsIn(OTP_PUBLIC_PURPOSES)
  purpose!: PublicOtpPurpose;

  @ApiPropertyOptional({
    description:
      'Application context for LOGIN OTP verification. Defaults to CLIENT when omitted.',
    enum: LOGIN_APPS,
    example: 'PROFESSIONAL',
  })
  @IsOptional()
  @IsIn(LOGIN_APPS)
  app?: LoginApp;
}
