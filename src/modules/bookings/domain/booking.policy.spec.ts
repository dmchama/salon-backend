import { assertValidBookingWindow } from './booking.policy';

describe('assertValidBookingWindow', () => {
  const now = new Date('2026-10-19T04:00:00Z');
  const inMinutes = (min: number) => new Date(now.getTime() + min * 60_000);

  it('by default only requires a future start', () => {
    expect(() =>
      assertValidBookingWindow(inMinutes(5), inMinutes(65), now),
    ).not.toThrow();
  });

  it('rejects a start inside the minimum notice window with PAST_START (BR7)', () => {
    expect(() =>
      assertValidBookingWindow(inMinutes(29), inMinutes(89), now, 30),
    ).toThrow(expect.objectContaining({ code: 'PAST_START' }));
    expect(() =>
      assertValidBookingWindow(inMinutes(30), inMinutes(90), now, 30),
    ).not.toThrow();
  });

  it('rejects an end before the start', () => {
    expect(() =>
      assertValidBookingWindow(inMinutes(60), inMinutes(60), now),
    ).toThrow(expect.objectContaining({ code: 'INVALID_WINDOW' }));
  });
});
