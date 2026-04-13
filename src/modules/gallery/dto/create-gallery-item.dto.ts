import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, IsUrl, MaxLength } from 'class-validator';

export class CreateGalleryItemDto {
  @ApiProperty()
  @IsUUID()
  salonId!: string;

  @ApiProperty({ description: 'Public URL of the image' })
  @IsUrl()
  @MaxLength(2048)
  url!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  caption?: string;
}
