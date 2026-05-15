import { IsOptional, IsString } from 'class-validator';

export class SetCoverDto {
  @IsOptional()
  @IsString()
  galleryItemId?: string | null;
}
