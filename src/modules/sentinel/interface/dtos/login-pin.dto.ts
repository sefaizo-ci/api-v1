import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class LoginPinDto {
  @ApiProperty({
    description: 'User id returned by OTP verification',
    example: '3f588642-25d6-4d73-8ec8-55a5f95a892a',
  })
  @IsString()
  userId!: string;

  @ApiProperty({
    description: 'PIN code (exactly 4 digits)',
    example: '2580',
    minLength: 4,
    maxLength: 4,
  })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'PIN invalide.' })
  pin!: string;
}
