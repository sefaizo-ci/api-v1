import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ServiceLocation } from '../../core/enums';

export class CreateProfessionalProfileDto {
  @ApiProperty({ example: 'Salon Excellence' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  agencyName!: string;

  @ApiPropertyOptional({ example: 'Coiffure premium et soins capillaires.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;

  @ApiPropertyOptional({
    enum: ServiceLocation,
    example: ServiceLocation.SALON,
  })
  @IsOptional()
  @IsEnum(ServiceLocation)
  location?: ServiceLocation;

  @ApiPropertyOptional({ example: 'Cocody, Abidjan' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional({ example: 5.3517 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ example: -4.0012 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({ example: ['WiFi', 'Parking', 'Climatisation'], maxItems: 3 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  @MaxLength(35, { each: true })
  amenities?: string[];

  @ApiPropertyOptional({
    example: ['uuid-categorie-1', 'uuid-categorie-2'],
    description: 'IDs des catégories principales (max 3)',
    maxItems: 3,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  mainCategories?: string[];
}

export class UpdateProfessionalProfileDto {
  @ApiPropertyOptional({ example: 'Salon Excellence Plus' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  agencyName?: string;

  @ApiPropertyOptional({ example: 'Nouveau bio professionnel.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;

  @ApiPropertyOptional({ enum: ServiceLocation, example: ServiceLocation.BOTH })
  @IsOptional()
  @IsEnum(ServiceLocation)
  location?: ServiceLocation;

  @ApiPropertyOptional({ example: 'Marcory, Abidjan' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional({ example: 5.36 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ example: -3.99 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({ example: ['WiFi', 'Parking'], maxItems: 3 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  @MaxLength(35, { each: true })
  amenities?: string[];

  @ApiPropertyOptional({
    example: ['uuid-categorie-1'],
    description: 'IDs des catégories principales (max 3)',
    maxItems: 3,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  mainCategories?: string[];
}

export class SuspendProfessionalDto {
  @ApiPropertyOptional({ example: 'Documents incomplets' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class RejectProfessionalDto {
  @ApiProperty({
    example: 'Pièces justificatives insuffisantes ou non conformes.',
  })
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason!: string;
}

export class UpdateProfessionalSettingsDto {
  @ApiProperty({
    example: 30,
    description:
      'Temps de déplacement (en minutes) bloqué après chaque réservation à domicile',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(120)
  travelBufferMin!: number;
}
