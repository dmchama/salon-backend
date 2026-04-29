import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminService } from './admin.service';

@ApiTags('admin')
@ApiBearerAuth('access-token')
@Controller({ path: 'admin', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  stats(@CurrentUser() user: JwtPayloadUser) {
    return this.adminService.stats(user.role as Role);
  }

  @Get('owners')
  listOwners() {
    return this.adminService.listOwners();
  }

  @Get('salons')
  listSalons() {
    return this.adminService.listSalons();
  }

  @Patch('salons/:id/publish')
  publishSalon(@Param('id') id: string) {
    return this.adminService.publishSalon(id);
  }

  @Patch('salons/:id/suspend')
  suspendSalon(@Param('id') id: string) {
    return this.adminService.suspendSalon(id);
  }

  @Patch('salons/:id/draft')
  draftSalon(@Param('id') id: string) {
    return this.adminService.draftSalon(id);
  }

  @Patch('owners/:id/approve')
  approveOwner(@Param('id') id: string) {
    return this.adminService.approveOwner(id);
  }

  @Patch('owners/:id/suspend')
  suspendOwner(@Param('id') id: string) {
    return this.adminService.suspendOwner(id);
  }

  @Patch('owners/:id/activate')
  activateOwner(@Param('id') id: string) {
    return this.adminService.activateOwner(id);
  }
}
