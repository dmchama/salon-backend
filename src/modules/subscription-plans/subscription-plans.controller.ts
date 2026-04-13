import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreatePlanDto } from './dto/create-plan.dto';
import { SubscriptionPlansService } from './subscription-plans.service';

@ApiTags('subscription-plans')
@Controller({ path: 'subscription-plans', version: '1' })
export class SubscriptionPlansController {
  constructor(private readonly subscriptionPlansService: SubscriptionPlansService) {}

  @Public()
  @Get()
  list() {
    return this.subscriptionPlansService.listPublic();
  }

  @Post()
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  create(@Body() dto: CreatePlanDto, @CurrentUser() user: JwtPayloadUser) {
    return this.subscriptionPlansService.create(dto, user.role as Role);
  }
}
