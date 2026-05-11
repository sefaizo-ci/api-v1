import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';

export class AddServiceDto {
  @ApiProperty({ example: 'Brushing' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: 'Brushing rapide 30 minutes' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ example: 30 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  durationMin!: number;

  @ApiProperty({ example: 8000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  basePrice!: number;

  @ApiProperty({ example: 'Coiffage' })
  @IsString()
  @MaxLength(80)
  category!: string;

  @ApiPropertyOptional({ example: 'https://example.com/brushing.jpg' })
  @IsOptional()
  @IsUrl()
  imageUrl?: string;
}

export class UpdateServiceDto {
  @ApiPropertyOptional({ example: 'Brushing VIP' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: 'Brushing premium avec soin' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ example: 45 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  durationMin?: number;

  @ApiPropertyOptional({ example: 12000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  basePrice?: number;

  @ApiPropertyOptional({ example: 'Coiffage' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @ApiPropertyOptional({ example: 'https://example.com/brushing-vip.jpg' })
  @IsOptional()
  @IsUrl()
  imageUrl?: string;
}

export class SetCommuneFeeDto {
  @ApiProperty({ example: 'Cocody' })
  @IsString()
  @MaxLength(120)
  commune!: string;

  @ApiProperty({ example: 2000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  travelFee!: number;
}

export class CreateServiceCategoryDto {
  @ApiProperty({ example: 'Coiffure' })
  @IsString()
  @MaxLength(80)
  name!: string;

  @ApiPropertyOptional({ example: 'Prestations liees a la coiffure' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}

export class UpdateServiceCategoryDto {
  @ApiPropertyOptional({ example: 'Coiffure femme' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({ example: 'Prestations de coiffure feminine' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}

export class CreateServiceCategoryRequestDto {
  @ApiProperty({ example: 'Extensions et lace frontal HD' })
  @IsString()
  @MaxLength(80)
  proposedName!: string;

  @ApiPropertyOptional({
    example: 'Pose, customisation et entretien lace frontal HD',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  proposedDescription?: string;
}

export class ApproveServiceCategoryRequestDto {
  @ApiPropertyOptional({ example: 'Extensions et lace frontal' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  approvedName?: string;

  @ApiPropertyOptional({
    example: 'Prestations de pose et entretien lace frontal',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  approvedDescription?: string;
}

export class RejectServiceCategoryRequestDto {
  @ApiPropertyOptional({
    example: "Categorie trop proche d'une categorie existante",
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewNote?: string;
}
