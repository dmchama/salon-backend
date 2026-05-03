import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEmail, IsOptional, IsString, IsUUID, MaxLength, MinLength, Length } from 'class-validator';

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

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  guestName!: string;

  @ApiProperty()
  @IsEmail()
  @MaxLength(255)
  guestEmail!: string;

  @ApiProperty()
  @IsString()
  @MinLength(5)
  @MaxLength(40)
  guestPhone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ description: 'Optional preferred staff member (must belong to this salon)' })
  @IsOptional()
  @IsUUID()
  technicianId?: string;

  @ApiPropertyOptional({ description: 'Optional promo code from an SMS campaign' })
  @IsOptional()
  @IsString()
  @Length(6, 16)
  promoCode?: string;
}
