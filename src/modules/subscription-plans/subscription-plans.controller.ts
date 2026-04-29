import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { SubscriptionPlansService } from './subscription-plans.service';

@ApiTags('subscription-plans')
@Controller({ path: 'subscription-plans', version: '1' })
export class SubscriptionPlansController {
  constructor(private readonly subscriptionPlansService: SubscriptionPlansService) {}

  /** Public — active plans only (for pricing page / registration) */
  @Public()
  @Get()
  list() {
    return this.subscriptionPlansService.listPublic();
  }

  /** Admin — all plans with subscriber counts */
  @Get('admin')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  listAdmin(@CurrentUser() user: JwtPayloadUser) {
    return this.subscriptionPlansService.listAdmin(user.role as Role);
  }

  /** Admin — create plan */
  @Post()
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  create(@Body() dto: CreatePlanDto, @CurrentUser() user: JwtPayloadUser) {
    return this.subscriptionPlansService.create(dto, user.role as Role);
  }

  /** Admin — update plan */
  @Patch(':id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePlanDto,
    @CurrentUser() user: JwtPayloadUser,
  ) {
    return this.subscriptionPlansService.update(id, dto, user.role as Role);
  }

  /** Admin — delete plan (blocked if active subscribers exist) */
  @Delete(':id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  deletePlan(@Param('id') id: string, @CurrentUser() user: JwtPayloadUser) {
    return this.subscriptionPlansService.deletePlan(id, user.role as Role);
  }
}
