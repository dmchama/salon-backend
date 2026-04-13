import { BookingStatus } from '@prisma/client';
import { DomainException } from '../../../common/exceptions/domain.exception';

export function assertValidBookingWindow(startAt: Date, endAt: Date): void {
  if (endAt <= startAt) {
    throw new DomainException('INVALID_WINDOW', 'endAt must be after startAt', 400);
  }
  if (startAt < new Date()) {
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
