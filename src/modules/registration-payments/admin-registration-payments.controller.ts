import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import {
  CurrentUser,
  JwtPayloadUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RejectRegistrationPaymentDto } from './dto/reject-registration-payment.dto';
import { RegistrationPaymentsService } from './registration-payments.service';

/** Platform admin review of owners' registration payments (spec 002). */
@ApiTags('admin')
@ApiBearerAuth('access-token')
@Controller({ path: 'admin', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class AdminRegistrationPaymentsController {
  constructor(
    private readonly registrationPayments: RegistrationPaymentsService,
  ) {}

  @Get('owners/:ownerId/registration-payment')
  getForOwner(@Param('ownerId') ownerId: string) {
    return this.registrationPayments.getForOwner(ownerId);
  }

  @Patch('registration-payments/:id/approve')
  approve(@Param('id') id: string, @CurrentUser() user: JwtPayloadUser) {
    return this.registrationPayments.approve(id, user.sub);
  }

  @Patch('registration-payments/:id/reject')
  reject(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: RejectRegistrationPaymentDto,
  ) {
    return this.registrationPayments.reject(id, user.sub, dto.reason);
  }
}
