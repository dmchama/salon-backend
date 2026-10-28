import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** Bank details shown to owners on the registration payment step (spec 002 BR8). */
export class PaymentDetailsDto {
  @ApiProperty({ example: 'Commercial Bank PLC' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  bankName!: string;

  @ApiProperty({ example: 'SaloonBooking (Pvt) Ltd' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  accountName!: string;

  @ApiProperty({ example: '1234 5678 9012' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  accountNumber!: string;

  @ApiPropertyOptional({ example: 'Colombo 03' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  branch?: string;

  @ApiPropertyOptional({ example: 'Use your email as the payment reference.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  instructions?: string;
}
