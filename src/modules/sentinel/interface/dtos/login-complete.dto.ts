import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class LoginCompleteDto {
  @ApiProperty({
    description: '4-digit OTP code received by SMS/WhatsApp',
    example: '7314',
    minLength: 4,
    maxLength: 4,
  })
  @IsString()
  @Length(4, 4)
  @Matches(/^\d{4}$/, { message: 'Code OTP invalide.' })
  code!: string;
}
