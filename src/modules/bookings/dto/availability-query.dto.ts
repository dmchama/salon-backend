import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { BOOKING_HORIZON_DAYS } from '../domain/availability.policy';

export class AvailabilityQueryDto {
  @ApiProperty()
  @IsString()
  @MaxLength(64)
  salonId!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  serviceId!: string;

  @ApiPropertyOptional({
    description: 'First day (YYYY-MM-DD, Asia/Colombo). Defaults to today.',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'from must be YYYY-MM-DD' })
  from?: string;

  @ApiPropertyOptional({
    default: BOOKING_HORIZON_DAYS,
    minimum: 1,
    maximum: BOOKING_HORIZON_DAYS,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(BOOKING_HORIZON_DAYS)
  days?: number;
}
