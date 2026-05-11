import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, Matches } from 'class-validator';
import { LOGIN_APPS, type LoginApp } from '../../core/enums/auth.enums';

export class StartLoginDto {
  @ApiProperty({
    description: 'Phone number (+225XXXXXXXXXX)',
    example: '+2250700000000',
  })
  @IsString()
  @Matches(/^\+225\d{10}$/, { message: 'Format : +225XXXXXXXXXX' })
  phone!: string;

  @ApiProperty({
    description: 'PIN code (4 digits)',
    example: '2580',
    minLength: 4,
    maxLength: 4,
  })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'PIN invalide.' })
  pin!: string;

  @ApiProperty({
    description: 'Target app (CLIENT or PROFESSIONAL)',
    enum: LOGIN_APPS,
    example: 'CLIENT',
  })
  @IsIn(LOGIN_APPS)
  app!: LoginApp;
}
