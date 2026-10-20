import {
  addDays,
  dayOfWeek,
  formatLocalDate,
  isLocalDate,
  startOfLocalDay,
} from "@/lib/time";

export const CALENDAR_VIEWS = ["day", "week", "month"] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

export type CalendarRange = {
  view: CalendarView;
  /** The day the user asked for. */
  date: string;
  /** Every calendar day shown, in order (whole weeks for the month view). */
  days: string[];
  /** UTC bounds of the shown days: [start, end). */
  start: Date;
  end: Date;
  previous: string;
  next: string;
  title: string;
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseView(value: string | string[] | undefined): CalendarView {
  const view = first(value);
  return CALENDAR_VIEWS.find((option) => option === view) ?? "week";
}

export function parseDate(
  value: string | string[] | undefined,
  today: string,
): string {
  const date = first(value);
  return date &&
    isLocalDate(date) &&
    date >= "2000-01-01" &&
    date <= "2100-12-31"
    ? date
    : today;
}

/** Weeks start on Sunday, as on US calendars. */
export function startOfWeek(date: string): string {
  return addDays(date, -dayOfWeek(date));
}

function addMonths(date: string, months: number): string {
  const [year, month] = date.split("-").map(Number) as [number, number];
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  return target.toISOString().slice(0, 10);
}

function range(from: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => addDays(from, index));
}

export function calendarRange(
  view: CalendarView,
  date: string,
  timeZone: string,
): CalendarRange {
  let days: string[];
  let previous: string;
  let next: string;
  let title: string;

  if (view === "day") {
    days = [date];
    previous = addDays(date, -1);
    next = addDays(date, 1);
    title = formatLocalDate(date, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } else if (view === "week") {
    const start = startOfWeek(date);
    days = range(start, 7);
    previous = addDays(date, -7);
    next = addDays(date, 7);
    const last = days[6] as string;
    title = `${formatLocalDate(start, { month: "short", day: "numeric" })} – ${formatLocalDate(
      last,
      { month: "short", day: "numeric", year: "numeric" },
    )}`;
  } else {
    const firstOfMonth = `${date.slice(0, 8)}01`;
    const firstOfNext = addMonths(firstOfMonth, 1);
    const start = startOfWeek(firstOfMonth);
    const end = addDays(startOfWeek(addDays(firstOfNext, -1)), 7);
    const count = Math.round(
      (new Date(`${end}T00:00:00Z`).getTime() -
        new Date(`${start}T00:00:00Z`).getTime()) /
        (24 * 60 * 60 * 1000),
    );
    days = range(start, count);
    previous = addMonths(firstOfMonth, -1);
    next = firstOfNext;
    title = formatLocalDate(firstOfMonth, { month: "long", year: "numeric" });
  }

  const last = days[days.length - 1] as string;
  return {
    view,
    date,
    days,
    start: startOfLocalDay(days[0] as string, timeZone),
    end: startOfLocalDay(addDays(last, 1), timeZone),
    previous,
    next,
    title,
  };
}

export function calendarHref(view: CalendarView, date: string): string {
  return `/calendar?view=${view}&date=${date}`;
}
