import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateTechnicianDto } from './dto/create-technician.dto';
import { UpdateTechnicianDto } from './dto/update-technician.dto';
import { PhotoUploadInterceptor } from './photo-upload.interceptor';
import { TechniciansService } from './technicians.service';

@ApiTags('technicians')
@Controller({ path: 'technicians', version: '1' })
export class TechniciansController {
  constructor(private readonly techniciansService: TechniciansService) {}

  @Post()
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SALON_ADMIN)
  create(@Body() dto: CreateTechnicianDto, @CurrentUser() user: JwtPayloadUser) {
    return this.techniciansService.create(dto, user.sub, user.role as Role);
  }

  @Get('manage/salon/:salonId')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SALON_ADMIN)
  listManageForSalon(@Param('salonId') salonId: string, @CurrentUser() user: JwtPayloadUser) {
    return this.techniciansService.listManageForSalon(salonId, user.sub, user.role as Role);
  }

  @Patch(':id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SALON_ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTechnicianDto,
    @CurrentUser() user: JwtPayloadUser,
  ) {
    return this.techniciansService.update(id, dto, user.sub, user.role as Role);
  }

  /** Upload or replace the team member's photo (spec 005). */
  @Post(':id/photo')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SALON_ADMIN)
  @UseInterceptors(PhotoUploadInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', required: ['photo'], properties: { photo: { type: 'string', format: 'binary' } } } })
  setPhoto(
    @Param('id') id: string,
    @UploadedFile() photo: Express.Multer.File | undefined,
    @CurrentUser() user: JwtPayloadUser,
  ) {
    return this.techniciansService.setPhoto(id, photo, user.sub);
  }

  @Delete(':id/photo')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SALON_ADMIN)
  removePhoto(@Param('id') id: string, @CurrentUser() user: JwtPayloadUser) {
    return this.techniciansService.removePhoto(id, user.sub);
  }

  @Public()
  @Get('salon/:salonId')
  listForSalon(@Param('salonId') salonId: string) {
    return this.techniciansService.listForSalonPublic(salonId);
  }
}
