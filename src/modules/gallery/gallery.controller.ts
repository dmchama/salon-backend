import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { memoryStorage } from 'multer';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { GalleryService } from './gallery.service';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

@ApiTags('gallery')
@Controller({ path: 'gallery', version: '1' })
export class GalleryController {
  constructor(private readonly galleryService: GalleryService) {}

  @Post('upload')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SALON_ADMIN)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME.includes(file.mimetype)) {
          return cb(new BadRequestException('Only JPEG, PNG and WebP images are allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('salonId') salonId: string,
    @Body('caption') caption: string | undefined,
    @CurrentUser() user: JwtPayloadUser,
  ) {
    if (!file) throw new BadRequestException('Image file is required');
    if (!salonId) throw new BadRequestException('salonId is required');
    return this.galleryService.addItemFromUpload(file, salonId, caption, user.sub, user.role as Role);
  }

  @Public()
  @Get('salon/:salonId')
  list(@Param('salonId') salonId: string) {
    return this.galleryService.listForSalon(salonId);
  }

  @Delete(':id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SALON_ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayloadUser) {
    return this.galleryService.remove(id, user.sub, user.role as Role);
  }
}
