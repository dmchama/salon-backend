import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength, IsUUID } from 'class-validator';

export class CreateGalleryItemDto {
  @ApiProperty()
  @IsUUID()
  salonId!: string;

  @ApiProperty({ description: 'Image location (URL or path handled by your hosting)' })
  @IsString()
  @MinLength(1)
  url!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  caption?: string;
}
