import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches } from 'class-validator';
import { LOGIN_APPS, type LoginApp } from '../../core/enums/auth.enums';

export class InitAuthFlowDto {
  @ApiProperty({
    description: 'User phone number in Ivory Coast format',
    example: '+2250700000000',
  })
  @IsString()
  @Matches(/^\+225\d{10}$/, { message: 'Format : +225XXXXXXXXXX' })
  phone!: string;

  @ApiPropertyOptional({
    description:
      'Target app context. When provided, response distinguishes login / new registration / add-role flows.',
    enum: LOGIN_APPS,
    example: 'PROFESSIONAL',
  })
  @IsOptional()
  @IsIn(LOGIN_APPS)
  app?: LoginApp;
}
