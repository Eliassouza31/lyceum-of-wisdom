/**
 * Time helpers. The database stores UTC; people type and read times in their
 * business's time zone. A "local date" is a plain calendar day, "YYYY-MM-DD",
 * and a "local time" is "HH:mm" on a 24-hour clock.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Formats a UTC timestamp in the business's time zone, e.g. "Oct 20, 2026, 4:05 PM CDT". */
export function formatDateTime(iso: string, timeZone: string): string {
  const date = new Date(iso);
  const dateTime = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(date);
  const zone = zoneName(date, timeZone);
  return zone ? `${dateTime} ${zone}` : dateTime;
}

/** Short zone name at that moment, e.g. "CDT" or "CST". */
export function zoneName(date: Date, timeZone: string): string | undefined {
  return new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" })
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;
}

/** Clock time in the business's time zone, e.g. "4:05 PM". */
export function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeStyle: "short",
    timeZone,
  }).format(new Date(iso));
}

type WallClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function wallClock(date: Date, timeZone: string): WallClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

const pad = (value: number) => String(value).padStart(2, "0");

/** The calendar day of a UTC timestamp in the business's time zone. */
export function localDateOf(iso: string | Date, timeZone: string): string {
  const { year, month, day } = wallClock(new Date(iso), timeZone);
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** The "HH:mm" clock time of a UTC timestamp in the business's time zone. */
export function localTimeOf(iso: string | Date, timeZone: string): string {
  const { hour, minute } = wallClock(new Date(iso), timeZone);
  return `${pad(hour)}:${pad(minute)}`;
}

/** Today's calendar day in the business's time zone. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  return localDateOf(now, timeZone);
}

/** First day of the current month in the time zone, as usage is counted. */
export function monthStartIn(timeZone: string, now: Date = new Date()): string {
  return `${todayIn(timeZone, now).slice(0, 8)}01`;
}

function parseLocalDate(value: string) {
  const match = LOCAL_DATE.exec(value);
  if (!match) return null;
  const [year, month, day] = [match[1], match[2], match[3]].map(Number) as [
    number,
    number,
    number,
  ];
  const date = new Date(Date.UTC(year, month - 1, day));
  // Rejects impossible days such as 2026-02-30.
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return { year, month, day };
}

export function isLocalDate(value: string): boolean {
  return parseLocalDate(value) !== null;
}

export function isLocalTime(value: string): boolean {
  return LOCAL_TIME.test(value);
}

/**
 * Converts a date and clock time typed in the business's time zone to UTC.
 *
 * - Returns null when that clock time does not exist on that day (for example
 *   2:30 AM on the day clocks spring forward in the US).
 * - When the clock time happens twice (1:30 AM on the day clocks fall back),
 *   the first occurrence, still on daylight time, is used.
 */
export function zonedTimeToUtc(
  date: string,
  time: string,
  timeZone: string,
): Date | null {
  const day = parseLocalDate(date);
  const clock = LOCAL_TIME.exec(time);
  if (!day || !clock) return null;
  const hour = Number(clock[1]);
  const minute = Number(clock[2]);
  const naive = Date.UTC(day.year, day.month - 1, day.day, hour, minute);

  // The zone's UTC offset can only be one of the offsets in force around that
  // day; try each and keep the ones that land on the requested clock time.
  const offsets = new Set(
    [naive - DAY_MS, naive, naive + DAY_MS].map((instant) => {
      const wall = wallClock(new Date(instant), timeZone);
      const asUtc = Date.UTC(
        wall.year,
        wall.month - 1,
        wall.day,
        wall.hour,
        wall.minute,
      );
      return asUtc - Math.floor(instant / 60_000) * 60_000;
    }),
  );
  const matches = [...offsets]
    .map((offset) => new Date(naive - offset))
    .filter((candidate) => {
      const wall = wallClock(candidate, timeZone);
      return (
        wall.year === day.year &&
        wall.month === day.month &&
        wall.day === day.day &&
        wall.hour === hour &&
        wall.minute === minute
      );
    })
    .sort((a, b) => a.getTime() - b.getTime());
  return matches[0] ?? null;
}

/**
 * The UTC instant a calendar day starts in the business's time zone. US zones
 * never skip midnight, but if a zone did, the first minute of the day is used.
 */
export function startOfLocalDay(date: string, timeZone: string): Date {
  for (let minutes = 0; minutes < 24 * 60; minutes += 30) {
    const start = zonedTimeToUtc(
      date,
      `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`,
      timeZone,
    );
    if (start) return start;
  }
  throw new Error(`Invalid local date: ${date}`);
}

/** Adds whole days to a calendar day. */
export function addDays(date: string, days: number): string {
  const day = parseLocalDate(date);
  if (!day) throw new Error(`Invalid local date: ${date}`);
  const result = new Date(Date.UTC(day.year, day.month - 1, day.day + days));
  return result.toISOString().slice(0, 10);
}

/** Day of the week of a calendar day: 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** Formats a calendar day, e.g. "Tue, Oct 20, 2026" (options override the parts shown). */
export function formatLocalDate(
  date: string,
  options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  },
): string {
  return new Intl.DateTimeFormat("en-US", {
    ...options,
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}
