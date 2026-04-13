import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateOwnerSubscriptionDto } from './dto/create-owner-subscription.dto';
import { OwnerSubscriptionsService } from './owner-subscriptions.service';

@ApiTags('owner-subscriptions')
@ApiBearerAuth('access-token')
@Controller({ path: 'owner-subscriptions', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.OWNER)
export class OwnerSubscriptionsController {
  constructor(private readonly ownerSubscriptionsService: OwnerSubscriptionsService) {}

  @Post()
  subscribe(@Body() dto: CreateOwnerSubscriptionDto, @CurrentUser() user: JwtPayloadUser) {
    return this.ownerSubscriptionsService.subscribe(dto, user.sub, user.role as Role);
  }

  @Get('me')
  list(@CurrentUser() user: JwtPayloadUser) {
    return this.ownerSubscriptionsService.listMine(user.sub, user.role as Role);
  }
}
