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
    description: 'PIN code (4 to 6 digits)',
    example: '2580',
    minLength: 4,
    maxLength: 6,
  })
  @IsString()
  @Matches(/^\d{4,6}$/, { message: 'PIN invalide.' })
  pin!: string;
}
