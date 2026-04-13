import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min, MinLength } from 'class-validator';

export class CreateServiceDto {
  @ApiProperty()
  @IsUUID()
  salonId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 45 })
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(480)
  durationMin!: number;

  @ApiProperty({ example: 5000, description: 'Price in minor units (cents)' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceCents!: number;
}
