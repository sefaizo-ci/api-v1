import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class UploadGalleryItemDto {
  @ApiProperty({ example: 'https://example.com/img.jpg' })
  @IsString()
  @IsUrl({ require_protocol: true })
  imageUrl!: string;

  @ApiPropertyOptional({ example: 'Avant/Apres' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string;

  @ApiPropertyOptional({ example: 'Portfolio' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;
}

export class UpdateGalleryItemDto {
  @ApiPropertyOptional({ example: 'Nouveau caption' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string;

  @ApiPropertyOptional({ example: 'Avant/Apres' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;
}

export class ReorderGalleryItemDto {
  @ApiProperty({ example: 'uuid-item' })
  @IsString()
  @IsUUID()
  id!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(0)
  order!: number;
}

export class ReorderGalleryDto {
  @ApiProperty({ type: [ReorderGalleryItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderGalleryItemDto)
  itemOrders!: ReorderGalleryItemDto[];
}

export class PublishStateDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  isPublic!: boolean;
}

export class ReplaceGalleryDto {
  @ApiProperty({
    type: [String],
    description: 'IDs des items à conserver — les autres sont supprimés.',
  })
  @IsArray()
  @IsUUID('all', { each: true })
  keepIds!: string[];
}
