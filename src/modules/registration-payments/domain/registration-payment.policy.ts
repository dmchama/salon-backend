import { AccountStatus, RegistrationPaymentStatus } from '@prisma/client';
import { DomainException } from '../../../common/exceptions/domain.exception';

/** Only a PENDING registration payment can be approved or rejected (BR4). */
export function assertCanReview(status: RegistrationPaymentStatus): void {
  if (status !== RegistrationPaymentStatus.PENDING) {
    throw new DomainException(
      'PAYMENT_NOT_PENDING',
      'This payment has already been reviewed',
      409,
    );
  }
}

/**
 * An owner may upload a (new) receipt only while their account is PENDING and their
 * latest receipt was rejected, or they have none yet (AC13, BR4).
 */
export function assertCanReupload(
  accountStatus: AccountStatus,
  latestStatus: RegistrationPaymentStatus | null,
): void {
  if (accountStatus !== AccountStatus.PENDING) {
    throw new DomainException(
      'ACCOUNT_ALREADY_ACTIVE',
      'Your account is not waiting for payment',
      409,
    );
  }
  if (
    latestStatus === RegistrationPaymentStatus.PENDING ||
    latestStatus === RegistrationPaymentStatus.APPROVED
  ) {
    throw new DomainException(
      'PAYMENT_ALREADY_PENDING',
      'Your receipt is already waiting for review',
      409,
    );
  }
}

/**
 * Subscription period counted from the approval time (BR10). Adds whole months in UTC and
 * clamps to the last day of a shorter month (31 Jan + 1 month → 28/29 Feb).
 */
export function subscriptionPeriodFrom(
  approvedAt: Date,
  intervalMonths: number,
): { startsAt: Date; expiresAt: Date } {
  const startsAt = new Date(approvedAt.getTime());
  const y = startsAt.getUTCFullYear();
  const m = startsAt.getUTCMonth() + intervalMonths;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const expiresAt = new Date(
    Date.UTC(
      y,
      m,
      Math.min(startsAt.getUTCDate(), lastDay),
      startsAt.getUTCHours(),
      startsAt.getUTCMinutes(),
      startsAt.getUTCSeconds(),
      startsAt.getUTCMilliseconds(),
    ),
  );
  return { startsAt, expiresAt };
}
