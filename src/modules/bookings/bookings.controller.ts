import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, JwtPayloadUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { BookingsService } from './bookings.service';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';

@ApiTags('bookings')
@Controller({ path: 'bookings', version: '1' })
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Public()
  @Post()
  create(@Body() dto: CreateBookingDto) {
    return this.bookingsService.create(dto);
  }

  @Public()
  @Get('availability')
  availability(@Query() query: AvailabilityQueryDto) {
    return this.bookingsService.getAvailability(query);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('salon/:salonId')
  @Roles(Role.SUPER_ADMIN, Role.SALON_ADMIN)
  listForSalon(
    @Param('salonId') salonId: string,
    @CurrentUser() user: JwtPayloadUser,
  ) {
    return this.bookingsService.listForSalon(salonId, user.sub, user.role as Role);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id/status')
  @Roles(Role.SUPER_ADMIN, Role.SALON_ADMIN)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateBookingStatusDto,
    @CurrentUser() user: JwtPayloadUser,
  ) {
    return this.bookingsService.updateStatus(id, dto.status, user.sub, user.role as Role);
  }

}
