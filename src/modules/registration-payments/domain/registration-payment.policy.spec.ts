import { AccountStatus, RegistrationPaymentStatus } from '@prisma/client';
import {
  assertCanReupload,
  assertCanReview,
  subscriptionPeriodFrom,
} from './registration-payment.policy';

describe('assertCanReview (BR4)', () => {
  it('allows only PENDING payments', () => {
    expect(() =>
      assertCanReview(RegistrationPaymentStatus.PENDING),
    ).not.toThrow();
    for (const s of [
      RegistrationPaymentStatus.APPROVED,
      RegistrationPaymentStatus.REJECTED,
    ]) {
      expect(() => assertCanReview(s)).toThrow(
        expect.objectContaining({
          code: 'PAYMENT_NOT_PENDING',
          statusCode: 409,
        }),
      );
    }
  });
});

describe('assertCanReupload (AC13, BR4)', () => {
  it('allows a PENDING account whose latest receipt was rejected', () => {
    expect(() =>
      assertCanReupload(
        AccountStatus.PENDING,
        RegistrationPaymentStatus.REJECTED,
      ),
    ).not.toThrow();
  });

  it('allows a PENDING account with no receipt yet', () => {
    expect(() => assertCanReupload(AccountStatus.PENDING, null)).not.toThrow();
  });

  it('rejects while the latest receipt is pending or approved', () => {
    for (const s of [
      RegistrationPaymentStatus.PENDING,
      RegistrationPaymentStatus.APPROVED,
    ]) {
      expect(() => assertCanReupload(AccountStatus.PENDING, s)).toThrow(
        expect.objectContaining({
          code: 'PAYMENT_ALREADY_PENDING',
          statusCode: 409,
        }),
      );
    }
  });

  it('rejects when the account is no longer pending', () => {
    for (const a of [AccountStatus.ACTIVE, AccountStatus.SUSPENDED]) {
      expect(() =>
        assertCanReupload(a, RegistrationPaymentStatus.REJECTED),
      ).toThrow(
        expect.objectContaining({
          code: 'ACCOUNT_ALREADY_ACTIVE',
          statusCode: 409,
        }),
      );
    }
  });
});

describe('subscriptionPeriodFrom (BR10)', () => {
  it('starts at approval and adds the plan interval', () => {
    const approvedAt = new Date('2026-10-28T05:30:00Z');
    const { startsAt, expiresAt } = subscriptionPeriodFrom(approvedAt, 1);
    expect(startsAt.toISOString()).toBe('2026-10-28T05:30:00.000Z');
    expect(expiresAt.toISOString()).toBe('2026-11-28T05:30:00.000Z');
  });

  it('handles multi-month intervals across a year end', () => {
    const { expiresAt } = subscriptionPeriodFrom(
      new Date('2026-11-15T00:00:00Z'),
      3,
    );
    expect(expiresAt.toISOString()).toBe('2027-02-15T00:00:00.000Z');
  });

  it('clamps to the last day of a shorter month', () => {
    const { expiresAt } = subscriptionPeriodFrom(
      new Date('2027-01-31T10:00:00Z'),
      1,
    );
    expect(expiresAt.toISOString()).toBe('2027-02-28T10:00:00.000Z');
  });
});
