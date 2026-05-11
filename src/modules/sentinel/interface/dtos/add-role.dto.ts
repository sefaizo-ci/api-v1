import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, Matches } from 'class-validator';
import { LOGIN_APPS, type LoginApp } from '../../core/enums/auth.enums';

export class AddRoleDto {
  @ApiProperty({
    description: 'User id returned by OTP verification',
    example: '3f588642-25d6-4d73-8ec8-55a5f95a892a',
  })
  @IsString()
  userId!: string;

  @ApiProperty({
    description: 'Current account PIN (4 digits)',
    example: '2580',
    minLength: 4,
    maxLength: 4,
  })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'PIN invalide.' })
  pin!: string;

  @ApiProperty({
    description: 'Role to add',
    enum: LOGIN_APPS,
    example: 'PROFESSIONAL',
  })
  @IsIn(LOGIN_APPS)
  role!: LoginApp;
}
