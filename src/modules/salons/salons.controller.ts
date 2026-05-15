import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateSalonDto } from './dto/create-salon.dto';
import { UpdateSalonDto } from './dto/update-salon.dto';
import { SetCoverDto } from './dto/set-cover.dto';
import { SalonsService } from './salons.service';

@ApiTags('salons')
@Controller({ path: 'salons', version: '1' })
export class SalonsController {
  constructor(private readonly salonsService: SalonsService) {}

  @Post()
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SALON_ADMIN)
  create(@Body() dto: CreateSalonDto, @CurrentUser() user: JwtPayloadUser) {
    return this.salonsService.create(dto, user.sub, user.role as Role);
  }

  @Get('mine')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SALON_ADMIN)
  listMine(@CurrentUser() user: JwtPayloadUser) {
    return this.salonsService.listMine(user.sub, user.role as Role);
  }

  @Patch(':id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SALON_ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateSalonDto, @CurrentUser() user: JwtPayloadUser) {
    return this.salonsService.update(id, dto, user.sub, user.role as Role);
  }

  @Post(':id/publish')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SALON_ADMIN)
  publish(@Param('id') id: string, @CurrentUser() user: JwtPayloadUser) {
    return this.salonsService.publish(id, user.sub, user.role as Role);
  }

  @Public()
  @Get('public/:slug')
  getPublic(@Param('slug') slug: string) {
    return this.salonsService.getPublicBySlug(slug);
  }

  @Public()
  @Get('public/:slug/branches')
  getBranches(@Param('slug') slug: string) {
    return this.salonsService.getBranchesBySlug(slug);
  }

  @Patch(':id/default')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SALON_ADMIN)
  setDefault(@Param('id') id: string, @CurrentUser() user: JwtPayloadUser) {
    return this.salonsService.setDefault(id, user.sub, user.role as Role);
  }

  @Patch(':id/cover')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SALON_ADMIN)
  setCover(@Param('id') id: string, @Body() dto: SetCoverDto, @CurrentUser() user: JwtPayloadUser) {
    return this.salonsService.setCoverImage(id, dto.galleryItemId, user.sub, user.role as Role);
  }

  @Patch(':id/listing-image')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SALON_ADMIN)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
          return cb(new BadRequestException('Only JPEG, PNG and WebP are allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
  setListingImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtPayloadUser,
  ) {
    if (!file) throw new BadRequestException('Image file is required');
    return this.salonsService.setListingImage(id, file, user.sub, user.role as Role);
  }
}
