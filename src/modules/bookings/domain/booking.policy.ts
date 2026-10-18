import { BookingStatus } from '@prisma/client';
import { DomainException } from '../../../common/exceptions/domain.exception';

/**
 * Validates a booking's time window. `minNoticeMin` is the minimum gap between now
 * and the start (0 = only "in the future"; guest bookings use MIN_NOTICE_MIN).
 */
export function assertValidBookingWindow(
  startAt: Date,
  endAt: Date,
  now: Date = new Date(),
  minNoticeMin = 0,
): void {
  if (endAt <= startAt) {
    throw new DomainException('INVALID_WINDOW', 'endAt must be after startAt', 400);
  }
  if (startAt.getTime() < now.getTime() + minNoticeMin * 60_000) {
    throw new DomainException('PAST_START', 'Booking start must be in the future', 400);
  }
}

export function canTransitionStatus(
  current: BookingStatus,
  next: BookingStatus,
): boolean {
  if (current === BookingStatus.CANCELLED || current === BookingStatus.COMPLETED) {
    return false;
  }
  return true;
}
