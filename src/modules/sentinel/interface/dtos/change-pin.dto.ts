import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class ChangePinDto {
  @ApiProperty({
    description: 'Current PIN code',
    example: '2580',
    minLength: 4,
    maxLength: 4,
  })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'PIN invalide.' })
  currentPin!: string;

  @ApiProperty({
    description: 'New PIN code (exactly 4 digits)',
    example: '3791',
    minLength: 4,
    maxLength: 4,
  })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'PIN invalide.' })
  newPin!: string;

  @ApiProperty({ description: 'New PIN confirmation', example: '3791' })
  @IsString()
  confirmNewPin!: string;
}
