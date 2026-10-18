import {
  assertWithinBusinessHours,
  colomboDateString,
  dayWindowUtc,
  generateDaySlots,
  parseBusinessHours,
} from './availability.policy';

const NINE_TO_SIX = { open: '09:00', close: '18:00', closed: false };
const CLOSED = { open: '', close: '', closed: true };
const WEEK = {
  mon: NINE_TO_SIX,
  tue: NINE_TO_SIX,
  wed: NINE_TO_SIX,
  thu: NINE_TO_SIX,
  fri: NINE_TO_SIX,
  sat: NINE_TO_SIX,
  sun: CLOSED,
};

// 2026-10-19 is a Monday; 2026-10-25 is a Sunday.
const MONDAY = '2026-10-19';
const SUNDAY = '2026-10-25';
// A "now" long before the test days, so the notice window never applies.
const EARLY = new Date('2026-10-01T00:00:00Z');

/** Colombo local time → UTC Date (Colombo is UTC+05:30, no DST). */
function colombo(date: string, hhmm: string): Date {
  return new Date(`${date}T${hhmm}:00+05:30`);
}

function slotsFor(opts: Partial<Parameters<typeof generateDaySlots>[0]> = {}) {
  return generateDaySlots({
    date: MONDAY,
    hours: parseBusinessHours(WEEK),
    durationMin: 60,
    busy: [],
    now: EARLY,
    ...opts,
  });
}

describe('parseBusinessHours', () => {
  it('treats missing hours as closed every day (AC18)', () => {
    const week = parseBusinessHours(null);
    expect(Object.values(week).every((d) => d === null)).toBe(true);
  });

  it('treats closed, empty and close <= open as closed (AC4)', () => {
    const week = parseBusinessHours({
      mon: { closed: true, open: '09:00', close: '18:00' },
      tue: { closed: false, open: '', close: '' },
      wed: { closed: false, open: '08:00', close: '05:00' },
      thu: { closed: false, open: '09:00', close: '09:00' },
      fri: NINE_TO_SIX,
    });
    expect(week.mon).toBeNull();
    expect(week.tue).toBeNull();
    expect(week.wed).toBeNull();
    expect(week.thu).toBeNull();
    expect(week.fri).toEqual({ open: 540, close: 1080 });
    expect(week.sat).toBeNull();
  });
});

describe('dayWindowUtc', () => {
  it('converts Colombo opening hours to UTC (BR1)', () => {
    const w = dayWindowUtc(MONDAY, parseBusinessHours(WEEK));
    expect(w?.openAt.toISOString()).toBe('2026-10-19T03:30:00.000Z');
    expect(w?.closeAt.toISOString()).toBe('2026-10-19T12:30:00.000Z');
  });

  it('returns null on a closed day', () => {
    expect(dayWindowUtc(SUNDAY, parseBusinessHours(WEEK))).toBeNull();
  });
});

describe('colomboDateString', () => {
  it('uses the Colombo calendar day, not UTC', () => {
    // 20:00 UTC on the 18th is 01:30 on the 19th in Colombo.
    expect(colomboDateString(new Date('2026-10-18T20:00:00Z'))).toBe(
      '2026-10-19',
    );
  });
});

describe('generateDaySlots', () => {
  it('starts at opening time in 15-minute steps (AC6, BR2)', () => {
    expect(slotsFor().slice(0, 4)).toEqual([
      '09:00',
      '09:15',
      '09:30',
      '09:45',
    ]);
  });

  it('last slot lets the service finish by closing time (AC7)', () => {
    const slots = slotsFor();
    expect(slots[slots.length - 1]).toBe('17:00');
    expect(slots).toHaveLength(33);
  });

  it('allows a slot that ends exactly at closing time', () => {
    expect(slotsFor({ durationMin: 45 })).toContain('17:15');
    expect(slotsFor({ durationMin: 45 })).not.toContain('17:30');
  });

  it('returns no slots on a closed day (AC4)', () => {
    expect(slotsFor({ date: SUNDAY })).toEqual([]);
  });

  it('returns no slots when the service is longer than the open period (AC10)', () => {
    expect(slotsFor({ durationMin: 10 * 60 })).toEqual([]);
  });

  it('hides slots starting less than 30 minutes from now (AC8, BR7)', () => {
    const now = colombo(MONDAY, '10:20');
    const slots = slotsFor({ now, minNoticeMin: 30 });
    expect(slots[0]).toBe('11:00');
  });

  it('hides slots that overlap an existing booking (AC9)', () => {
    const busy = [
      { startAt: colombo(MONDAY, '11:00'), endAt: colombo(MONDAY, '12:00') },
    ];
    const slots = slotsFor({ busy });
    expect(slots).toContain('10:00');
    expect(slots).not.toContain('10:15');
    expect(slots).not.toContain('11:45');
    expect(slots).toContain('12:00');
  });
});

describe('assertWithinBusinessHours (AC16, BR4)', () => {
  const at = (hhmm: string, min = 60) => {
    const startAt = colombo(MONDAY, hhmm);
    return [startAt, new Date(startAt.getTime() + min * 60_000)] as const;
  };

  it('accepts a booking inside opening hours', () => {
    expect(() => assertWithinBusinessHours(...at('09:00'), WEEK)).not.toThrow();
    expect(() => assertWithinBusinessHours(...at('17:00'), WEEK)).not.toThrow();
  });

  it('rejects before opening', () => {
    expect(() => assertWithinBusinessHours(...at('08:45'), WEEK)).toThrow(
      expect.objectContaining({ code: 'OUTSIDE_BUSINESS_HOURS' }),
    );
  });

  it('rejects a booking ending one minute after closing', () => {
    expect(() => assertWithinBusinessHours(...at('17:00', 61), WEEK)).toThrow(
      expect.objectContaining({ code: 'OUTSIDE_BUSINESS_HOURS' }),
    );
  });

  it('rejects on a closed day', () => {
    const startAt = colombo(SUNDAY, '10:00');
    const endAt = new Date(startAt.getTime() + 3_600_000);
    expect(() => assertWithinBusinessHours(startAt, endAt, WEEK)).toThrow(
      expect.objectContaining({ code: 'OUTSIDE_BUSINESS_HOURS' }),
    );
  });

  it('rejects when the salon has no hours (AC18)', () => {
    expect(() => assertWithinBusinessHours(...at('10:00'), null)).toThrow(
      expect.objectContaining({ code: 'OUTSIDE_BUSINESS_HOURS' }),
    );
  });
});
