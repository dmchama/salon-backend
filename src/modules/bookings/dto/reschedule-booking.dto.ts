import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601 } from 'class-validator';

export class RescheduleBookingDto {
  @ApiProperty({ description: 'New appointment start (ISO 8601)' })
  @IsISO8601()
  startAt!: string;
}
