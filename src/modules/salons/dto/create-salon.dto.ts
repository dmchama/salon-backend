import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateSalonDto {
  @ApiProperty({ example: 'Glamour Studio' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'glamour-studio' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  slug!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'Colombo' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ description: 'Salon phone shown to customers' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  contactPhone?: string;

  @ApiPropertyOptional({ description: 'Salon email shown to customers' })
  @IsOptional()
  @ValidateIf((_, v) => v != null && String(v).trim() !== '')
  @IsEmail()
  @MaxLength(255)
  contactEmail?: string;

  @ApiPropertyOptional({ description: 'Website or social profile URL' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  websiteUrl?: string;

  @ApiPropertyOptional({
    description: 'Weekly hours as JSON, e.g. { mon: { closed: false, open: "09:00", close: "18:00" } }',
  })
  @IsOptional()
  @IsObject()
  businessHours?: Record<string, unknown>;
}
