// Uber's pay week — the only week this app knows.
//
// Uber Egypt closes a driver's earnings week on Monday at 04:00 local time:
// the week runs Monday 04:00 → the next Monday 03:59:59. Every weekly figure
// in the app (dashboard "This week", the weekly analytics, streaks, goals)
// is bucketed on that boundary, and trips from other platforms or typed by
// hand follow the same rule, so a driver's week here always matches the
// statement Uber will show them. All maths is in the server's local time
// (phase 1 runs on the driver's own machine, set to Egypt time).

export const WEEK_START_DOW = 1; // Monday (Date#getDay convention, 0 = Sunday)
export const WEEK_START_HOUR = 4; // 04:00
export const WEEK_MS = 7 * 86_400_000;

/** 04:00 on the Monday that opened the pay week containing `d`. */
export function weekStartFor(d: Date | string | number): Date {
  const x = new Date(d);
  // the "pay day" of an instant before 04:00 is still the previous calendar day
  const anchor = new Date(x.getFullYear(), x.getMonth(), x.getDate(), WEEK_START_HOUR, 0, 0, 0);
  if (x.getTime() < anchor.getTime()) anchor.setDate(anchor.getDate() - 1);
  const back = (anchor.getDay() - WEEK_START_DOW + 7) % 7;
  anchor.setDate(anchor.getDate() - back);
  return anchor;
}

/** Exclusive end: 04:00 the following Monday (wall clock, DST-safe). */
export function weekEndFor(start: Date): Date {
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return end;
}

export type WeekRange = { start: Date; end: Date; key: string };

/** The week `offset` weeks away from the one containing `now` (0 = current, -1 = last). */
export function weekRange(offset = 0, now: Date = new Date()): WeekRange {
  const start = weekStartFor(now);
  start.setDate(start.getDate() + offset * 7);
  return { start, end: weekEndFor(start), key: weekKey(start) };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Stable id for a week: the local calendar date of its opening Monday. */
export function weekKey(start: Date): string {
  return `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
}

/** Inverse of weekKey — 04:00 local on that Monday. Null for garbage input. */
export function parseWeekKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), WEEK_START_HOUR, 0, 0, 0);
  if (isNaN(d.getTime())) return null;
  // snap to the Monday 04:00 that actually opens the containing week, so a
  // mistyped mid-week date still resolves to a real week
  return weekStartFor(d);
}

/** Share of the current pay week already elapsed, 0..1. */
export function weekProgress(now: Date = new Date()): number {
  const { start, end } = weekRange(0, now);
  return Math.max(0, Math.min(1, (now.getTime() - start.getTime()) / (end.getTime() - start.getTime())));
}

/** Milliseconds left until the current week closes. */
export function msUntilWeekClose(now: Date = new Date()): number {
  return Math.max(0, weekRange(0, now).end.getTime() - now.getTime());
}

/**
 * The "pay day" a timestamp belongs to: a trip at 02:30 on Tuesday is still
 * Monday's work in Uber's book. Returns a local yyyy-mm-dd.
 */
export function payDayKey(d: Date | string | number): string {
  const x = new Date(d);
  const day = new Date(x.getFullYear(), x.getMonth(), x.getDate());
  if (x.getHours() < WEEK_START_HOUR) day.setDate(day.getDate() - 1);
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

/** Day index inside the pay week, 0 = Monday … 6 = Sunday. */
export function payDayIndex(d: Date | string | number): number {
  const x = new Date(d);
  const start = weekStartFor(x);
  return Math.min(6, Math.max(0, Math.floor((x.getTime() - start.getTime()) / 86_400_000)));
}

/** Clip [a, b) to [start, end) and return the overlap in ms (0 when disjoint). */
export function overlapMs(a: Date | string, b: Date | string, start: Date, end: Date): number {
  const s = Math.max(new Date(a).getTime(), start.getTime());
  const e = Math.min(new Date(b).getTime(), end.getTime());
  return Math.max(0, e - s);
}
