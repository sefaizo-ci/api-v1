import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectBookingDto {
  @ApiPropertyOptional({ example: 'Horaire non disponible' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
