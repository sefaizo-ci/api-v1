import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export const UPLOAD_KINDS = [
  'gallery',
  'avatar',
  'service',
  'profile',
] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];

export const UPLOAD_MIME_TYPES = [
  'image/jpg',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export class CreateUploadIntentDto {
  @ApiProperty({ enum: UPLOAD_KINDS, example: 'gallery' })
  @IsIn(UPLOAD_KINDS)
  type!: UploadKind;

  @ApiProperty({ enum: UPLOAD_MIME_TYPES, example: 'image/webp' })
  @IsIn(UPLOAD_MIME_TYPES)
  mimeType!: (typeof UPLOAD_MIME_TYPES)[number];

  @ApiPropertyOptional({
    description: 'Requis uniquement quand type = "service".',
    example: 'b1a2c3d4-...',
  })
  @IsOptional()
  @IsUUID()
  serviceId?: string;
}

export class ConfirmUploadDto {
  @ApiProperty({
    description: 'Le uploadToken renvoyé par /media/upload-intent.',
  })
  @IsString()
  uploadToken!: string;
}
