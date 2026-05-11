import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

const PLATFORMS = ['IOS', 'ANDROID', 'WEB'] as const;

export class RegisterPushTokenDto {
  @ApiProperty({
    description: 'Client platform',
    enum: PLATFORMS,
    example: 'IOS',
  })
  @IsIn(PLATFORMS)
  platform!: string;

  @ApiProperty({
    description: 'Stable device identifier (generated on first install)',
    example: 'uuid-device-stable',
  })
  @IsString()
  deviceId!: string;

  @ApiProperty({
    description: 'FCM / APNs push token',
    example: 'fcm_token_here',
  })
  @IsString()
  pushToken!: string;
}
