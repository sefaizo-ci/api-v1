import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class LogoutDto {
  @ApiPropertyOptional({
    description: 'Optional if refresh token cookie is present.',
    example: '9d6f0ec68a4f0f4f6947be09f6e60f9ab8c6f6f5de8d8ec2d5f8f6c3c9f9a7b2',
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;

  @ApiPropertyOptional({
    description: 'Revoke all user sessions on all devices.',
    default: false,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  allDevices?: boolean;
}
