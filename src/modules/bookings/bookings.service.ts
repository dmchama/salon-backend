import { Injectable, Logger } from '@nestjs/common';
import { BookingStatus, Role } from '@prisma/client';
import { DomainException } from '../../common/exceptions/domain.exception';
import { PlanGuardService } from '../plan-guard/plan-guard.service';
import { NotificationProducerService } from '../notifications/notification-producer.service';
import { SmslenzService } from '../notifications/providers/smslenz.service';
import { PromoCodesService } from '../promo-codes/promo-codes.service';
import { assertValidBookingWindow, canTransitionStatus } from './domain/booking.policy';
import {
  BOOKING_HORIZON_DAYS,
  MIN_NOTICE_MIN,
  SLOT_INTERVAL_MIN,
  addDays,
  assertWithinBusinessHours,
  colomboDateString,
  dayHours,
  dayWindowUtc,
  formatDayHours,
  generateDaySlots,
  parseBusinessHours,
} from './domain/availability.policy';
import { BookingsRepository } from './repositories/bookings.repository';
import { CreateBookingDto } from './dto/create-booking.dto';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Colombo' });
}
function fmtTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Colombo' });
}

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

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
    this.logger.log(
      `[create] START guest="${dto.guestName}" phone=${dto.guestPhone} ` +
      `salon=${dto.salonId} service=${dto.serviceId} slot=${dto.startAt}`,
    );

    const salon = await this.prisma.salon.findFirst({
      where: { id: dto.salonId, status: 'PUBLISHED' },
      include: { owner: { select: { id: true } } },
    });
    if (!salon) {
      this.logger.warn(`[create] FAIL salon not found or not published: ${dto.salonId}`);
      throw new DomainException('SALON_NOT_FOUND', 'Salon not available', 404);
    }
    this.logger.log(`[create] Salon found: "${salon.name}" owner=${salon.owner.id}`);

    await this.planGuard.requireApprovedAccount(salon.owner.id);
    await this.planGuard.requireActiveSubscription(salon.owner.id);
    const isOverage = await this.planGuard.isBookingOverage(salon.owner.id);
    this.logger.log(`[create] Plan guard passed — isOverage=${isOverage}`);

    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId, salonId: dto.salonId, active: true },
    });
    if (!service) {
      this.logger.warn(`[create] FAIL service not found: ${dto.serviceId}`);
      throw new DomainException('SERVICE_NOT_FOUND', 'Service not found for this salon', 404);
    }
    this.logger.log(`[create] Service found: "${service.name}" (${service.durationMin} min)`);

    const startAt = new Date(dto.startAt);
    const endAt = new Date(startAt.getTime() + service.durationMin * 60 * 1000);
    assertValidBookingWindow(startAt, endAt, new Date(), MIN_NOTICE_MIN);
    assertWithinBusinessHours(startAt, endAt, salon.businessHours);
    this.logger.log(`[create] Slot: ${fmtDate(startAt)} ${fmtTime(startAt)} → ${fmtTime(endAt)}`);

    let technicianConnect: { connect: { id: string } } | undefined;
    if (dto.technicianId) {
      const tech = await this.prisma.technician.findFirst({
        where: { id: dto.technicianId, salonId: dto.salonId, active: true },
      });
      if (!tech) {
        this.logger.warn(`[create] FAIL technician not found: ${dto.technicianId}`);
        throw new DomainException('TECHNICIAN_NOT_FOUND', 'Technician not available for this salon', 404);
      }
      technicianConnect = { connect: { id: tech.id } };
      this.logger.log(`[create] Technician: "${tech.name}" (${tech.id})`);
    }

    let appliedPromo: { id: string; discountPct: number } | undefined;
    if (dto.promoCode) {
      const promo = await this.promoCodes.validate(dto.promoCode, dto.salonId, dto.serviceId);
      appliedPromo = { id: promo.id, discountPct: promo.discountPct };
      this.logger.log(`[create] Promo applied: "${dto.promoCode}" ${promo.discountPct}% off`);
    }

    // Serializable transaction: overlap check + insert are atomic.
    // Concurrent requests for the same slot will queue at the DB level —
    // only the first one commits, the second sees the overlap and throws.
    this.logger.log(`[create] Opening serializable transaction…`);
    const created = await this.prisma.$transaction(async (tx) => {
      const overlap = await tx.booking.findFirst({
        where: {
          salonId: dto.salonId,
          status: { not: BookingStatus.CANCELLED },
          AND: [{ startAt: { lt: endAt } }, { endAt: { gt: startAt } }],
        },
      });
      if (overlap) {
        this.logger.warn(`[create] FAIL slot overlap with booking ${overlap.id}`);
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
    this.logger.log(`[create] Booking created id=${created.id} status=CONFIRMED`);

    if (appliedPromo) {
      await this.promoCodes.incrementUsage(appliedPromo.id);
      this.logger.log(`[create] Promo usage incremented: ${appliedPromo.id}`);
    }

    const booking =
      (await this.prisma.booking.findUnique({
        where: { id: created.id },
        include: { technician: true, salon: true, service: true },
      })) ?? created;

    // Fire-and-forget queue (for email/other channels)
    this.logger.log(`[create] Enqueuing notification for booking ${booking.id}`);
    this.notifications.enqueueBookingCreated({
      bookingId: booking.id,
      idempotencyKey: `${booking.id}-created`,
    }).catch((err) => this.logger.warn(`[create] Notification queue error: ${err?.message}`));

    // Send SMS directly — bypass Redis queue for reliability
    const guestPhone = booking.guestPhone;
    this.logger.log(`[create] SMS check — guestPhone=${guestPhone ?? 'NONE'}`);
    if (guestPhone) {
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
      this.logger.log(`[create] Sending confirmation SMS to ${guestPhone} (${lines.length} lines)`);
      this.sms.sendBulkSms([guestPhone], lines.join('\n')).catch((err) =>
        this.logger.warn(`[create] SMS send error: ${err?.message}`),
      );
    } else {
      this.logger.warn(`[create] No guestPhone — SMS skipped`);
    }

    this.logger.log(`[create] DONE booking=${booking.id}`);
    return booking;
  }

  /** Public: free start times per day for a salon + service (feature 001). */
  async getAvailability(query: AvailabilityQueryDto) {
    this.logger.log(
      `[getAvailability] START salon=${query.salonId} service=${query.serviceId} from=${query.from ?? 'today'} days=${query.days ?? BOOKING_HORIZON_DAYS}`,
    );

    const now = new Date();
    const today = colomboDateString(now);
    const from = query.from ?? today;
    const days = query.days ?? BOOKING_HORIZON_DAYS;
    const lastAllowed = addDays(today, BOOKING_HORIZON_DAYS - 1);
    if (from < today || addDays(from, days - 1) > lastAllowed) {
      this.logger.warn(
        `[getAvailability] FAIL range ${from}+${days} outside ${today}..${lastAllowed}`,
      );
      throw new DomainException(
        'INVALID_RANGE',
        `Dates must be between ${today} and ${lastAllowed}`,
        400,
      );
    }

    const salon = await this.prisma.salon.findFirst({
      where: { id: query.salonId, status: 'PUBLISHED' },
      select: { id: true, businessHours: true },
    });
    if (!salon) {
      this.logger.warn(
        `[getAvailability] FAIL salon not found or not published: ${query.salonId}`,
      );
      throw new DomainException('SALON_NOT_FOUND', 'Salon not available', 404);
    }
    const service = await this.prisma.service.findFirst({
      where: { id: query.serviceId, salonId: salon.id, active: true },
      select: { durationMin: true },
    });
    if (!service) {
      this.logger.warn(
        `[getAvailability] FAIL service not found: ${query.serviceId}`,
      );
      throw new DomainException(
        'SERVICE_NOT_FOUND',
        'Service not found for this salon',
        404,
      );
    }

    const hours = parseBusinessHours(salon.businessHours);
    const dates = Array.from({ length: days }, (_, i) => addDays(from, i));
    const windows = dates
      .map((d) => dayWindowUtc(d, hours))
      .filter((w) => w !== null);
    const busy = windows.length
      ? await this.bookingsRepository.findBusyIntervals(
          salon.id,
          windows[0]!.openAt,
          windows[windows.length - 1]!.closeAt,
        )
      : [];

    const result = dates.map((date) => {
      const h = dayHours(date, hours);
      return {
        date,
        closed: h === null,
        ...formatDayHours(h),
        slots: generateDaySlots({
          date,
          hours,
          durationMin: service.durationMin,
          busy,
          now,
        }),
      };
    });

    this.logger.log(
      `[getAvailability] OK days=${result.length} busy=${busy.length} ` +
        `openDays=${result.filter((d) => d.slots.length).length}`,
    );
    return {
      timezone: 'Asia/Colombo',
      slotIntervalMin: SLOT_INTERVAL_MIN,
      serviceDurationMin: service.durationMin,
      days: result,
    };
  }

  async updateStatus(
    bookingId: string,
    nextStatus: BookingStatus,
    actorId: string,
    actorRole: Role,
  ) {
    this.logger.log(`[updateStatus] START booking=${bookingId} nextStatus=${nextStatus} actor=${actorId} role=${actorRole}`);

    const booking = await this.bookingsRepository.findByIdWithRelations(bookingId);
    if (!booking) {
      this.logger.warn(`[updateStatus] FAIL booking not found: ${bookingId}`);
      throw new DomainException('NOT_FOUND', 'Booking not found', 404);
    }
    this.logger.log(`[updateStatus] Found: currentStatus=${booking.status} salon=${booking.salon?.name}`);

    if (actorRole === Role.SUPER_ADMIN) {
      // full access
    } else if (actorRole === Role.SALON_ADMIN) {
      if (booking.salon.ownerId !== actorId) {
        this.logger.warn(`[updateStatus] FAIL forbidden — actor ${actorId} does not own salon`);
        throw new DomainException('FORBIDDEN', 'Not your salon booking', 403);
      }
    } else {
      this.logger.warn(`[updateStatus] FAIL forbidden — role ${actorRole} cannot update bookings`);
      throw new DomainException('FORBIDDEN', 'Cannot update booking', 403);
    }

    if (!canTransitionStatus(booking.status, nextStatus)) {
      this.logger.warn(`[updateStatus] FAIL invalid transition ${booking.status} → ${nextStatus}`);
      throw new DomainException('INVALID_STATUS', 'Invalid status transition', 400);
    }

    if (booking.status === nextStatus) {
      this.logger.log(`[updateStatus] No-op: already ${nextStatus}`);
      return booking;
    }

    const updated = await this.bookingsRepository.updateStatus(bookingId, nextStatus);
    this.logger.log(`[updateStatus] Status updated: ${booking.status} → ${nextStatus}`);

    // Fire-and-forget queue (for email/other channels)
    this.notifications.enqueueBookingStatusUpdated({
      bookingId: updated.id,
      idempotencyKey: `${updated.id}-status-${nextStatus}`,
    }).catch((err) => this.logger.warn(`[updateStatus] Notification queue error: ${err?.message}`));

    // Send cancellation SMS directly — bypass Redis queue for reliability
    if (nextStatus === BookingStatus.CANCELLED && booking.guestPhone) {
      this.logger.log(`[updateStatus] Sending cancellation SMS to ${booking.guestPhone}`);
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
      this.sms.sendBulkSms([booking.guestPhone], msg).catch((err) =>
        this.logger.warn(`[updateStatus] SMS send error: ${err?.message}`),
      );
    }

    this.logger.log(`[updateStatus] DONE booking=${bookingId}`);
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
    this.logger.log(`[reschedule] START booking=${bookingId} newSlot=${startAtIso} actor=${actorId}`);

    const booking = await this.bookingsRepository.findByIdWithRelations(bookingId);
    if (!booking) {
      this.logger.warn(`[reschedule] FAIL booking not found: ${bookingId}`);
      throw new DomainException('NOT_FOUND', 'Booking not found', 404);
    }
    if (actorRole === Role.SALON_ADMIN && booking.salon.ownerId !== actorId) {
      throw new DomainException('FORBIDDEN', 'Not your salon booking', 403);
    }
    if (actorRole !== Role.SALON_ADMIN && actorRole !== Role.SUPER_ADMIN) {
      throw new DomainException('FORBIDDEN', 'Cannot reschedule', 403);
    }
    if (booking.status === BookingStatus.CANCELLED || booking.status === BookingStatus.COMPLETED) {
      this.logger.warn(`[reschedule] FAIL cannot reschedule status=${booking.status}`);
      throw new DomainException('INVALID_STATUS', 'Cannot reschedule this booking', 400);
    }

    const startAt = new Date(startAtIso);
    const endAt = new Date(startAt.getTime() + booking.service.durationMin * 60 * 1000);
    assertValidBookingWindow(startAt, endAt);
    this.logger.log(`[reschedule] New slot: ${fmtDate(startAt)} ${fmtTime(startAt)} → ${fmtTime(endAt)}`);

    const overlap = await this.bookingsRepository.hasOverlappingBooking(
      booking.salonId,
      startAt,
      endAt,
      bookingId,
    );
    if (overlap) {
      this.logger.warn(`[reschedule] FAIL slot overlap`);
      throw new DomainException('SLOT_TAKEN', 'Selected time slot is not available', 409);
    }

    const result = await this.bookingsRepository.updateSchedule(bookingId, startAt, endAt);
    this.logger.log(`[reschedule] DONE booking=${bookingId}`);
    return result;
  }
}
