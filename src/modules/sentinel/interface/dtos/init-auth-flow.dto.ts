import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class InitAuthFlowDto {
  @ApiProperty({
    description: 'User phone number in Ivory Coast format',
    example: '+2250700000000',
  })
  @IsString()
  @Matches(/^\+225\d{10}$/, { message: 'Format : +225XXXXXXXXXX' })
  phone!: string;
}
