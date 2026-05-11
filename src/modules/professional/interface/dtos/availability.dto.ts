import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { AvailabilityStatus } from '../../core/enums';

const TIME_REGEX = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;

export class SetAvailabilityDto {
  @ApiProperty({ example: 1, description: '0=Lundi ... 6=Dimanche' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @ApiProperty({ example: '08:00' })
  @IsString()
  @Matches(TIME_REGEX)
  startTime!: string;

  @ApiProperty({ example: '17:00' })
  @IsString()
  @Matches(TIME_REGEX)
  endTime!: string;

  @ApiPropertyOptional({ example: '12:00' })
  @IsOptional()
  @IsString()
  @Matches(TIME_REGEX)
  breakStartTime?: string;

  @ApiPropertyOptional({ example: '13:00' })
  @IsOptional()
  @IsString()
  @Matches(TIME_REGEX)
  breakEndTime?: string;
}

export class UpdateAvailabilityDto {
  @ApiPropertyOptional({ example: '09:00' })
  @IsOptional()
  @IsString()
  @Matches(TIME_REGEX)
  startTime?: string;

  @ApiPropertyOptional({ example: '18:00' })
  @IsOptional()
  @IsString()
  @Matches(TIME_REGEX)
  endTime?: string;

  @ApiPropertyOptional({ example: '12:30' })
  @IsOptional()
  @IsString()
  @Matches(TIME_REGEX)
  breakStartTime?: string;

  @ApiPropertyOptional({ example: '13:30' })
  @IsOptional()
  @IsString()
  @Matches(TIME_REGEX)
  breakEndTime?: string;
}

export class SetAvailabilityStatusDto {
  @ApiProperty({ enum: AvailabilityStatus, example: AvailabilityStatus.OPEN })
  @IsEnum(AvailabilityStatus)
  status!: AvailabilityStatus;
}

export class SetAvailabilityBulkDto {
  @ApiProperty({ type: [SetAvailabilityDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SetAvailabilityDto)
  availabilities!: SetAvailabilityDto[];
}

export class SetAvailabilityForWeekDto {
  @ApiProperty({ example: '08:00' })
  @IsString()
  @Matches(TIME_REGEX)
  startTime!: string;

  @ApiProperty({ example: '17:00' })
  @IsString()
  @Matches(TIME_REGEX)
  endTime!: string;

  @ApiPropertyOptional({ example: '12:00' })
  @IsOptional()
  @IsString()
  @Matches(TIME_REGEX)
  breakStartTime?: string;

  @ApiPropertyOptional({ example: '13:00' })
  @IsOptional()
  @IsString()
  @Matches(TIME_REGEX)
  breakEndTime?: string;

  @ApiPropertyOptional({ example: [5, 6] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  excludeDays?: number[];
}
