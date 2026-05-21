import { Injectable } from '@nestjs/common';
import { BookingStatus, Role } from '@prisma/client';
import { DomainException } from '../../common/exceptions/domain.exception';
import { PlanGuardService } from '../plan-guard/plan-guard.service';
import { NotificationProducerService } from '../notifications/notification-producer.service';
import { SmslenzService } from '../notifications/providers/smslenz.service';
import { PromoCodesService } from '../promo-codes/promo-codes.service';
import { assertValidBookingWindow, canTransitionStatus } from './domain/booking.policy';
import { BookingsRepository } from './repositories/bookings.repository';
import { CreateBookingDto } from './dto/create-booking.dto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Colombo' });
}
function fmtTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Colombo' });
}

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingsRepository: BookingsRepository,
    private readonly notifications: NotificationProducerService,
    private readonly sms: SmslenzService,
    private readonly promoCodes: PromoCodesService,
    private readonly planGuard: PlanGuardService,
  ) {}

  /** Public guest booking (no account). */
  async create(dto: CreateBookingDto) {
    const salon = await this.prisma.salon.findFirst({
      where: { id: dto.salonId, status: 'PUBLISHED' },
      include: { owner: { select: { id: true } } },
    });
    if (!salon) {
      throw new DomainException('SALON_NOT_FOUND', 'Salon not available', 404);
    }

    await this.planGuard.requireActiveSubscription(salon.owner.id);
    const isOverage = await this.planGuard.isBookingOverage(salon.owner.id);

    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId, salonId: dto.salonId, active: true },
    });
    if (!service) {
      throw new DomainException('SERVICE_NOT_FOUND', 'Service not found for this salon', 404);
    }

    const startAt = new Date(dto.startAt);
    const endAt = new Date(startAt.getTime() + service.durationMin * 60 * 1000);
    assertValidBookingWindow(startAt, endAt);

    let technicianConnect: { connect: { id: string } } | undefined;
    if (dto.technicianId) {
      const tech = await this.prisma.technician.findFirst({
        where: { id: dto.technicianId, salonId: dto.salonId, active: true },
      });
      if (!tech) {
        throw new DomainException('TECHNICIAN_NOT_FOUND', 'Technician not available for this salon', 404);
      }
      technicianConnect = { connect: { id: tech.id } };
    }

    let appliedPromo: { id: string; discountPct: number } | undefined;
    if (dto.promoCode) {
      const promo = await this.promoCodes.validate(dto.promoCode, dto.salonId, dto.serviceId);
      appliedPromo = { id: promo.id, discountPct: promo.discountPct };
    }

    // Serializable transaction: overlap check + insert are atomic.
    // Concurrent requests for the same slot will queue at the DB level —
    // only the first one commits, the second sees the overlap and throws.
    const created = await this.prisma.$transaction(async (tx) => {
      const overlap = await tx.booking.findFirst({
        where: {
          salonId: dto.salonId,
          status: { not: BookingStatus.CANCELLED },
          AND: [{ startAt: { lt: endAt } }, { endAt: { gt: startAt } }],
        },
      });
      if (overlap) {
        throw new DomainException('SLOT_TAKEN', 'Selected time slot is not available', 409);
      }
      return tx.booking.create({
        data: {
          salon: { connect: { id: dto.salonId } },
          service: { connect: { id: dto.serviceId } },
          ...(technicianConnect ? { technician: technicianConnect } : {}),
          ...(appliedPromo ? { promoCode: { connect: { id: appliedPromo.id } }, discountPct: appliedPromo.discountPct } : {}),
          startAt,
          endAt,
          status: BookingStatus.CONFIRMED,
          isOverage,
          guestName: dto.guestName.trim(),
          guestEmail: dto.guestEmail.trim().toLowerCase(),
          guestPhone: dto.guestPhone.trim(),
          notes: dto.notes?.trim() || null,
        },
      });
    }, { isolationLevel: 'Serializable' });

    if (appliedPromo) {
      await this.promoCodes.incrementUsage(appliedPromo.id);
    }

    const booking =
      (await this.prisma.booking.findUnique({
        where: { id: created.id },
        include: { technician: true, salon: true, service: true },
      })) ?? created;

    // Fire-and-forget queue (for email/other channels)
    this.notifications.enqueueBookingCreated({
      bookingId: booking.id,
      idempotencyKey: `${booking.id}-created`,
    }).catch(() => {/* non-fatal */});

    // Send SMS directly — bypass Redis queue for reliability
    if (booking.guestPhone) {
      const salonName = (booking as any).salon?.name as string | undefined;
      const serviceName = (booking as any).service?.name as string | undefined;
      const salonCity = (booking as any).salon?.city as string | undefined;
      const salonPhone = (booking as any).salon?.contactPhone as string | undefined;
      const guestName = booking.guestName ?? 'Customer';
      const lines = [
        `Hi ${guestName},`,
        serviceName ? `Your ${serviceName} booking is confirmed.` : `Your booking is confirmed.`,
        `Date: ${fmtDate(booking.startAt)}`,
        `Time: ${fmtTime(booking.startAt)}`,
      ];
      if (salonName) lines.push(salonName);
      if (salonCity) lines.push(salonCity);
      if (salonPhone) lines.push(`Contact: ${salonPhone}`);
      this.sms.sendBulkSms([booking.guestPhone], lines.join('\n')).catch(() => {/* non-fatal */});
    }

    return booking;
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

    if (actorRole === Role.SUPER_ADMIN) {
      // full access
    } else if (actorRole === Role.SALON_ADMIN) {
      if (booking.salon.ownerId !== actorId) {
        throw new DomainException('FORBIDDEN', 'Not your salon booking', 403);
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

    // Fire-and-forget queue (for email/other channels)
    this.notifications.enqueueBookingStatusUpdated({
      bookingId: updated.id,
      idempotencyKey: `${updated.id}-status-${nextStatus}`,
    }).catch(() => {/* non-fatal */});

    // Send cancellation SMS directly — bypass Redis queue for reliability
    if (nextStatus === BookingStatus.CANCELLED && booking.guestPhone) {
      const salonName = booking.salon?.name ?? 'the salon';
      const salonPhone = booking.salon?.contactPhone;
      const guestName = booking.guestName ?? 'Customer';
      const msg = [
        `Hi ${guestName},`,
        `Your booking at ${salonName} has been cancelled.`,
        `Date: ${fmtDate(booking.startAt)}`,
        `Time: ${fmtTime(booking.startAt)}`,
        salonPhone ? `To rebook, call us: ${salonPhone}` : `Please contact us to rebook.`,
      ].join('\n');
      this.sms.sendBulkSms([booking.guestPhone], msg).catch(() => {/* non-fatal */});
    }

    return updated;
  }

  async listForSalon(salonId: string, actorId: string, actorRole: Role) {
    const salon = await this.prisma.salon.findFirst({ where: { id: salonId } });
    if (!salon) {
      throw new DomainException('NOT_FOUND', 'Salon not found', 404);
    }
    if (actorRole === Role.SALON_ADMIN && salon.ownerId !== actorId) {
      throw new DomainException('FORBIDDEN', 'Not your salon', 403);
    }
    if (actorRole !== Role.SALON_ADMIN && actorRole !== Role.SUPER_ADMIN) {
      throw new DomainException('FORBIDDEN', 'Cannot list bookings', 403);
    }
    return this.bookingsRepository.listForSalon(salonId);
  }

  async reschedule(bookingId: string, startAtIso: string, actorId: string, actorRole: Role) {
    const booking = await this.bookingsRepository.findByIdWithRelations(bookingId);
    if (!booking) {
      throw new DomainException('NOT_FOUND', 'Booking not found', 404);
    }
    if (actorRole === Role.SALON_ADMIN && booking.salon.ownerId !== actorId) {
      throw new DomainException('FORBIDDEN', 'Not your salon booking', 403);
    }
    if (actorRole !== Role.SALON_ADMIN && actorRole !== Role.SUPER_ADMIN) {
      throw new DomainException('FORBIDDEN', 'Cannot reschedule', 403);
    }
    if (booking.status === BookingStatus.CANCELLED || booking.status === BookingStatus.COMPLETED) {
      throw new DomainException('INVALID_STATUS', 'Cannot reschedule this booking', 400);
    }

    const startAt = new Date(startAtIso);
    const endAt = new Date(startAt.getTime() + booking.service.durationMin * 60 * 1000);
    assertValidBookingWindow(startAt, endAt);

    const overlap = await this.bookingsRepository.hasOverlappingBooking(
      booking.salonId,
      startAt,
      endAt,
      bookingId,
    );
    if (overlap) {
      throw new DomainException('SLOT_TAKEN', 'Selected time slot is not available', 409);
    }

    return this.bookingsRepository.updateSchedule(bookingId, startAt, endAt);
  }
}
