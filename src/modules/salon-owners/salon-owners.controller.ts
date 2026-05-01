import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SalonOwnersService } from './salon-owners.service';

@ApiTags('salon-owners')
@ApiBearerAuth('access-token')
@Controller({ path: 'salon-owners', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SALON_ADMIN)
export class SalonOwnersController {
  constructor(private readonly salonOwnersService: SalonOwnersService) {}

  @Get('me/dashboard')
  dashboard(@CurrentUser() user: JwtPayloadUser) {
    return this.salonOwnersService.dashboard(user.sub, user.role as Role);
  }

  @Get('campaign/customers')
  getOwnerCampaignCustomers(
    @CurrentUser() user: JwtPayloadUser,
    @Query('salonId') salonId: string,
    @Query('segment') segment: string,
  ) {
    return this.salonOwnersService.getOwnerCampaignCustomers(user.sub, salonId, segment ?? 'all');
  }

  @Get('campaign/services')
  getOwnerCampaignServices(
    @CurrentUser() user: JwtPayloadUser,
    @Query('salonId') salonId: string,
  ) {
    return this.salonOwnersService.getOwnerCampaignServices(user.sub, salonId);
  }

  @Post('campaign/sms')
  sendOwnerSmsCampaign(
    @CurrentUser() user: JwtPayloadUser,
    @Body() body: any,
  ) {
    return this.salonOwnersService.sendOwnerSmsCampaign(user.sub, body);
  }
}
