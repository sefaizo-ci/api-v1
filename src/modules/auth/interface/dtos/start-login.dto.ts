import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class StartLoginDto {
  @ApiProperty({
    description: 'User phone number in Ivory Coast format',
    example: '+2250700000000',
  })
  @IsString()
  @Matches(/^\+225\d{10}$/, { message: 'Format : +225XXXXXXXXXX' })
  phone!: string;

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
