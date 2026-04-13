import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';

@ApiTags('bookings')
@ApiBearerAuth('access-token')
@Controller({ path: 'bookings', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @Roles(Role.CUSTOMER)
  create(@Body() dto: CreateBookingDto, @CurrentUser() user: JwtPayloadUser) {
    return this.bookingsService.create(dto, user.sub, user.role as Role);
  }

  @Get('me')
  @Roles(Role.CUSTOMER)
  listMine(@CurrentUser() user: JwtPayloadUser) {
    return this.bookingsService.listMine(user.sub, user.role as Role);
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN, Role.OWNER, Role.CUSTOMER)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateBookingStatusDto,
    @CurrentUser() user: JwtPayloadUser,
  ) {
    return this.bookingsService.updateStatus(id, dto.status, user.sub, user.role as Role);
  }
}
