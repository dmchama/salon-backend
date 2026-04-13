import { Injectable } from '@nestjs/common';
import { BookingStatus, Role } from '@prisma/client';
import { DomainException } from '../../common/exceptions/domain.exception';
import { NotificationProducerService } from '../notifications/notification-producer.service';
import { assertValidBookingWindow, canTransitionStatus } from './domain/booking.policy';
import { BookingsRepository } from './repositories/bookings.repository';
import { CreateBookingDto } from './dto/create-booking.dto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingsRepository: BookingsRepository,
    private readonly notifications: NotificationProducerService,
  ) {}

  async create(dto: CreateBookingDto, customerId: string, customerRole: Role) {
    if (customerRole !== Role.CUSTOMER) {
      throw new DomainException('FORBIDDEN', 'Only customers can create bookings', 403);
    }

    const salon = await this.prisma.salon.findFirst({
      where: { id: dto.salonId, status: 'PUBLISHED' },
    });
    if (!salon) {
      throw new DomainException('SALON_NOT_FOUND', 'Salon not available', 404);
    }

    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId, salonId: dto.salonId, active: true },
    });
    if (!service) {
      throw new DomainException('SERVICE_NOT_FOUND', 'Service not found for this salon', 404);
    }

    const startAt = new Date(dto.startAt);
    const endAt = new Date(startAt.getTime() + service.durationMin * 60 * 1000);
    assertValidBookingWindow(startAt, endAt);

    const overlap = await this.bookingsRepository.hasOverlappingBooking(
      dto.salonId,
      startAt,
      endAt,
    );
    if (overlap) {
      throw new DomainException('SLOT_TAKEN', 'Selected time slot is not available', 409);
    }

    const booking = await this.bookingsRepository.create({
      customer: { connect: { id: customerId } },
      salon: { connect: { id: dto.salonId } },
      service: { connect: { id: dto.serviceId } },
      startAt,
      endAt,
      status: BookingStatus.PENDING,
      notes: dto.notes,
    });

    await this.notifications.enqueueBookingCreated({
      bookingId: booking.id,
      idempotencyKey: `${booking.id}-created`,
    });

    return booking;
  }

  async listMine(customerId: string, role: Role) {
    if (role !== Role.CUSTOMER) {
      throw new DomainException('FORBIDDEN', 'Only customers can list own bookings', 403);
    }
    return this.bookingsRepository.listForCustomer(customerId);
  }

  async updateStatus(
    bookingId: string,
    nextStatus: BookingStatus,
    actorId: string,
    actorRole: Role,
  ) {
    const booking = await this.bookingsRepository.findByIdWithRelations(bookingId);
    if (!booking) {
      throw new DomainException('NOT_FOUND', 'Booking not found', 404);
    }

    if (actorRole === Role.ADMIN) {
      // full access
    } else if (actorRole === Role.OWNER) {
      if (booking.salon.ownerId !== actorId) {
        throw new DomainException('FORBIDDEN', 'Not your salon booking', 403);
      }
    } else if (actorRole === Role.CUSTOMER) {
      if (booking.customerId !== actorId) {
        throw new DomainException('FORBIDDEN', 'Not your booking', 403);
      }
    } else {
      throw new DomainException('FORBIDDEN', 'Cannot update booking', 403);
    }

    if (!canTransitionStatus(booking.status, nextStatus)) {
      throw new DomainException('INVALID_STATUS', 'Invalid status transition', 400);
    }

    if (booking.status === nextStatus) {
      return booking;
    }

    const updated = await this.bookingsRepository.updateStatus(bookingId, nextStatus);

    await this.notifications.enqueueBookingStatusUpdated({
      bookingId: updated.id,
      idempotencyKey: `${updated.id}-status-${nextStatus}`,
    });

    return updated;
  }
}
