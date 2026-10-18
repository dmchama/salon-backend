import { DomainException } from '../../../common/exceptions/domain.exception';

/** Start times are offered every 15 minutes (feature 001, BR2). */
export const SLOT_INTERVAL_MIN = 15;
/** Guests can book today + 59 days (BR5). */
export const BOOKING_HORIZON_DAYS = 60;
/** A start time must be at least 30 minutes from now (BR7). */
export const MIN_NOTICE_MIN = 30;
/** Asia/Colombo is UTC+05:30 all year (Sri Lanka has no DST). */
export const COLOMBO_OFFSET_MIN = 330;

const DAY_CODES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export type DayCode = (typeof DAY_CODES)[number];

/** Opening hours of one day as minutes from local midnight, or null when closed. */
export type DayHours = { open: number; close: number } | null;
export type WeekHours = Record<DayCode, DayHours>;

export interface BusyInterval {
  startAt: Date;
  endAt: Date;
}

function parseHHmm(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function toHHmm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Reads `Salon.businessHours` JSON. A day is closed when it is marked closed,
 * has no times, or closes at/before it opens (overnight hours are not supported).
 */
export function parseBusinessHours(raw: unknown): WeekHours {
  const week = {} as WeekHours;
  const obj =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  for (const day of DAY_CODES) {
    const row = obj[day] as Record<string, unknown> | undefined;
    const open = parseHHmm(row?.open);
    const close = parseHHmm(row?.close);
    week[day] =
      row && !row.closed && open !== null && close !== null && close > open
        ? { open, close }
        : null;
  }
  return week;
}

/** Calendar date (YYYY-MM-DD) in Asia/Colombo for an instant. */
export function colomboDateString(at: Date): string {
  return new Date(at.getTime() + COLOMBO_OFFSET_MIN * 60_000)
    .toISOString()
    .slice(0, 10);
}

/** Adds whole days to a YYYY-MM-DD date. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function dayCodeOf(date: string): DayCode {
  const [y, m, d] = date.split('-').map(Number);
  return DAY_CODES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** Colombo local date + minutes from midnight → UTC instant. */
function colomboToUtc(date: string, minutes: number): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, minutes - COLOMBO_OFFSET_MIN));
}

export function dayHours(date: string, hours: WeekHours): DayHours {
  return hours[dayCodeOf(date)];
}

/** Opening and closing instants (UTC) of a Colombo date, or null when closed. */
export function dayWindowUtc(
  date: string,
  hours: WeekHours,
): { openAt: Date; closeAt: Date } | null {
  const h = dayHours(date, hours);
  if (!h) return null;
  return {
    openAt: colomboToUtc(date, h.open),
    closeAt: colomboToUtc(date, h.close),
  };
}

export function formatDayHours(h: DayHours): {
  open: string | null;
  close: string | null;
} {
  return h
    ? { open: toHHmm(h.open), close: toHHmm(h.close) }
    : { open: null, close: null };
}

/**
 * Free start times (Colombo "HH:mm") for one date: from opening time in fixed steps,
 * finishing by closing time, at least `minNoticeMin` after `now`, and not overlapping
 * any busy interval (BR2, BR3, BR7).
 */
export function generateDaySlots(opts: {
  date: string;
  hours: WeekHours;
  durationMin: number;
  busy: BusyInterval[];
  now: Date;
  minNoticeMin?: number;
  intervalMin?: number;
}): string[] {
  const h = dayHours(opts.date, opts.hours);
  if (!h) return [];
  const interval = opts.intervalMin ?? SLOT_INTERVAL_MIN;
  const earliest =
    opts.now.getTime() + (opts.minNoticeMin ?? MIN_NOTICE_MIN) * 60_000;
  const slots: string[] = [];
  for (
    let start = h.open;
    start + opts.durationMin <= h.close;
    start += interval
  ) {
    const startAt = colomboToUtc(opts.date, start).getTime();
    const endAt = startAt + opts.durationMin * 60_000;
    if (startAt < earliest) continue;
    const overlaps = opts.busy.some(
      (b) => b.startAt.getTime() < endAt && b.endAt.getTime() > startAt,
    );
    if (!overlaps) slots.push(toHHmm(start));
  }
  return slots;
}

/** Throws OUTSIDE_BUSINESS_HOURS unless the booking fits inside that day's hours (BR4). */
export function assertWithinBusinessHours(
  startAt: Date,
  endAt: Date,
  rawHours: unknown,
): void {
  const window = dayWindowUtc(
    colomboDateString(startAt),
    parseBusinessHours(rawHours),
  );
  if (!window || startAt < window.openAt || endAt > window.closeAt) {
    throw new DomainException(
      'OUTSIDE_BUSINESS_HOURS',
      'The salon is not open for the whole of this time',
      400,
    );
  }
}
