import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class RegisterNotificationDeviceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  platform!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  deviceId!: string;

  @IsString()
  @IsNotEmpty()
  pushToken!: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}
