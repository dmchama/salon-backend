import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEmail, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateTechnicianDto {
  @ApiProperty()
  @IsUUID()
  salonId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  specialization?: string;

  @ApiPropertyOptional({ description: 'Lower numbers appear first' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(9999)
  sortOrder?: number;
}
