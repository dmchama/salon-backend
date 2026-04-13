import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateBookingDto {
  @ApiProperty()
  @IsUUID()
  salonId!: string;

  @ApiProperty()
  @IsUUID()
  serviceId!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @Type(() => Date)
  @IsDate()
  startAt!: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
