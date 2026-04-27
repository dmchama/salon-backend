import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateSalonDto } from './dto/create-salon.dto';
import { UpdateSalonDto } from './dto/update-salon.dto';
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
}
