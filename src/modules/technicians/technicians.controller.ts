import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateTechnicianDto } from './dto/create-technician.dto';
import { UpdateTechnicianDto } from './dto/update-technician.dto';
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

  @Public()
  @Get('salon/:salonId')
  listForSalon(@Param('salonId') salonId: string) {
    return this.techniciansService.listForSalonPublic(salonId);
  }
}
