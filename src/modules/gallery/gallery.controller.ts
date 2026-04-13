import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateGalleryItemDto } from './dto/create-gallery-item.dto';
import { GalleryService } from './gallery.service';

@ApiTags('gallery')
@Controller({ path: 'gallery', version: '1' })
export class GalleryController {
  constructor(private readonly galleryService: GalleryService) {}

  @Post()
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  add(@Body() dto: CreateGalleryItemDto, @CurrentUser() user: JwtPayloadUser) {
    return this.galleryService.addItem(dto, user.sub, user.role as Role);
  }

  @Public()
  @Get('salon/:salonId')
  list(@Param('salonId') salonId: string) {
    return this.galleryService.listForSalon(salonId);
  }
}
