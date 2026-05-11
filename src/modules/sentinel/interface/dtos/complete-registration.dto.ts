import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class CompleteRegistrationDto {
  @ApiProperty({
    description: 'PIN code (exactly 4 digits)',
    example: '2847',
    minLength: 4,
    maxLength: 4,
  })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'PIN invalide.' })
  pin!: string;

  @ApiProperty({
    description: 'PIN confirmation (must match pin)',
    example: '2847',
  })
  @IsString()
  confirmPin!: string;
}
