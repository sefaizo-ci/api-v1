import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiPropertyOptional({
    description:
      'Refresh token. Optional when refreshToken cookie is already present.',
    example: 'raw_refresh_token',
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
