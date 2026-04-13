import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateServiceDto } from './dto/create-service.dto';
import { ServicesOfferedService } from './services-offered.service';

@ApiTags('services')
@Controller({ path: 'services', version: '1' })
export class ServicesOfferedController {
  constructor(private readonly servicesOfferedService: ServicesOfferedService) {}

  @Post()
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  create(@Body() dto: CreateServiceDto, @CurrentUser() user: JwtPayloadUser) {
    return this.servicesOfferedService.create(dto, user.sub, user.role as Role);
  }

  @Public()
  @Get('salon/:salonId')
  listForSalon(@Param('salonId') salonId: string) {
    return this.servicesOfferedService.listForSalon(salonId);
  }
}
