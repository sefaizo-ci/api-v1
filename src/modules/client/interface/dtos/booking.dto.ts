import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateClientBookingDto {
  @ApiProperty({ example: 'a03ad34e-7ac5-4dd6-8ef0-0cbbe2f4e5d2' })
  @IsUUID()
  professionalId!: string;

  @ApiProperty({ example: '2a49900b-bc27-4bfd-b7f1-78a9a32f43e7' })
  @IsUUID()
  serviceId!: string;

  @ApiProperty({ example: '2026-05-05T09:00:00.000Z' })
  @IsDateString()
  scheduledAt!: string;

  @ApiProperty({ example: 'Cocody' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  commune!: string;

  @ApiPropertyOptional({ example: 'Rue des Jardins, Abidjan' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional({ example: 'Merci de me contacter 10 min avant' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  clientNotes?: string;
}

export class UpdatePendingBookingDto {
  @ApiPropertyOptional({ example: '2026-05-05T10:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional({ example: 'Marcory' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  commune?: string;

  @ApiPropertyOptional({ example: 'Zone 4, Abidjan' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional({ example: 'Je serai a la maison apres 18h' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  clientNotes?: string;
}

export class RequestBookingCancellationDto {
  @ApiPropertyOptional({ example: 'Empêchement personnel' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
