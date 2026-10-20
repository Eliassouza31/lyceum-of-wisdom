import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import {
  CALENDAR_VIEWS,
  calendarHref,
  calendarRange,
  parseDate,
  parseView,
  type CalendarRange,
  type CalendarView,
} from "@/features/appointments/calendar";
import { AppointmentList } from "@/features/appointments/components/appointment-list";
import { formatTimeRange } from "@/features/appointments/format";
import {
  listAppointmentsBetween,
  type AppointmentSummary,
} from "@/features/appointments/queries";
import { requireBusinessContext } from "@/features/business/queries";
import { timezoneLabel } from "@/features/business/timezones";
import { clientName } from "@/features/clients/format";
import { cn } from "@/lib/cn";
import { formatLocalDate, formatTime, localDateOf, todayIn } from "@/lib/time";

export const metadata: Metadata = { title: "Calendar" };

const VIEW_LABELS: Record<CalendarView, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function groupByDay(
  appointments: AppointmentSummary[],
  timeZone: string,
): Map<string, AppointmentSummary[]> {
  const groups = new Map<string, AppointmentSummary[]>();
  for (const appointment of appointments) {
    const day = localDateOf(appointment.starts_at, timeZone);
    const list = groups.get(day) ?? [];
    list.push(appointment);
    groups.set(day, list);
  }
  return groups;
}

const inactive = (appointment: AppointmentSummary) =>
  appointment.status === "cancelled" || appointment.status === "no_show";

function Toolbar({ range, today }: { range: CalendarRange; today: string }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={calendarHref(range.view, range.previous)}
          className={buttonClasses("secondary", "px-3 py-1.5")}
        >
          <span aria-hidden="true">←</span>
          <span className="sr-only">Previous {range.view}</span>
        </Link>
        <Link
          href={calendarHref(range.view, today)}
          className={buttonClasses("secondary", "px-3 py-1.5")}
        >
          Today
        </Link>
        <Link
          href={calendarHref(range.view, range.next)}
          className={buttonClasses("secondary", "px-3 py-1.5")}
        >
          <span aria-hidden="true">→</span>
          <span className="sr-only">Next {range.view}</span>
        </Link>
        <h2 className="ml-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {range.title}
        </h2>
      </div>
      <nav
        aria-label="Calendar view"
        className="inline-flex self-start rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900"
      >
        {CALENDAR_VIEWS.map((view) => (
          <Link
            key={view}
            href={calendarHref(view, range.date)}
            aria-current={view === range.view ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium",
              view === range.view
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
            )}
          >
            {VIEW_LABELS[view]}
          </Link>
        ))}
      </nav>
    </div>
  );
}

function DayView({
  date,
  appointments,
  timeZone,
}: {
  date: string;
  appointments: AppointmentSummary[];
  timeZone: string;
}) {
  if (appointments.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Nothing booked on this day
        </h3>
        <Link
          href={`/appointments/new?date=${date}`}
          className={buttonClasses("primary", "mt-5")}
        >
          Book an appointment
        </Link>
      </div>
    );
  }
  return (
    <AppointmentList
      appointments={appointments}
      timeZone={timeZone}
      label={formatLocalDate(date)}
    />
  );
}

function WeekView({
  range,
  groups,
  today,
  timeZone,
}: {
  range: CalendarRange;
  groups: Map<string, AppointmentSummary[]>;
  today: string;
  timeZone: string;
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-7 lg:gap-2">
      {range.days.map((day) => {
        const appointments = groups.get(day) ?? [];
        return (
          <section
            key={day}
            aria-label={formatLocalDate(day)}
            className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-zinc-200 lg:min-h-48 dark:bg-zinc-900 dark:ring-zinc-800"
          >
            <Link
              href={calendarHref("day", day)}
              className="flex items-baseline gap-2 text-sm lg:flex-col lg:gap-0"
            >
              <span className="font-medium text-zinc-500 dark:text-zinc-400">
                {formatLocalDate(day, { weekday: "short" })}
              </span>
              <span
                className={cn(
                  "text-lg font-semibold text-zinc-900 dark:text-zinc-100",
                  day === today && "text-indigo-600 dark:text-indigo-400",
                )}
              >
                {formatLocalDate(day, { month: "short", day: "numeric" })}
              </span>
            </Link>
            {appointments.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-600">
                No appointments
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {appointments.map((appointment) => (
                  <li key={appointment.id}>
                    <Link
                      href={`/appointments/${appointment.id}`}
                      className={cn(
                        "block rounded-lg bg-indigo-50 px-2 py-1.5 text-xs hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-950",
                        inactive(appointment) &&
                          "bg-zinc-100 text-zinc-500 line-through dark:bg-zinc-800",
                      )}
                    >
                      <span className="block font-medium text-zinc-900 dark:text-zinc-100">
                        {formatTimeRange(
                          appointment.starts_at,
                          appointment.ends_at,
                          timeZone,
                        )}
                      </span>
                      <span className="block break-words text-zinc-600 dark:text-zinc-300">
                        {appointment.title} · {clientName(appointment.client)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function MonthView({
  range,
  groups,
  today,
  timeZone,
}: {
  range: CalendarRange;
  groups: Map<string, AppointmentSummary[]>;
  today: string;
  timeZone: string;
}) {
  const month = range.date.slice(0, 7);
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
      <div className="grid grid-cols-7 border-b border-zinc-200 text-center text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        {WEEKDAYS.map((weekday) => (
          <div key={weekday} className="py-2">
            {weekday}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {range.days.map((day) => {
          const appointments = groups.get(day) ?? [];
          const active = appointments.filter((item) => !inactive(item));
          const outside = !day.startsWith(month);
          return (
            <Link
              key={day}
              href={calendarHref("day", day)}
              aria-label={`${formatLocalDate(day)}: ${active.length} ${
                active.length === 1 ? "appointment" : "appointments"
              }`}
              className={cn(
                "min-h-16 min-w-0 border-r border-b border-zinc-100 p-1.5 hover:bg-zinc-50 sm:min-h-24 dark:border-zinc-800 dark:hover:bg-zinc-800/50",
                outside && "bg-zinc-50/60 dark:bg-zinc-950/40",
              )}
            >
              <span
                className={cn(
                  "grid size-6 place-items-center rounded-full text-xs font-medium",
                  outside
                    ? "text-zinc-400 dark:text-zinc-600"
                    : "text-zinc-900 dark:text-zinc-100",
                  day === today && "bg-indigo-600 text-white dark:text-white",
                )}
              >
                {Number(day.slice(8))}
              </span>
              {active.length > 0 ? (
                <>
                  <span className="mt-1 block text-[11px] font-medium text-indigo-700 sm:hidden dark:text-indigo-300">
                    {active.length}
                  </span>
                  <ul className="mt-1 hidden space-y-0.5 sm:block">
                    {active.slice(0, 3).map((appointment) => (
                      <li
                        key={appointment.id}
                        className="truncate rounded bg-indigo-50 px-1 text-[11px] text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200"
                      >
                        {formatTime(appointment.starts_at, timeZone)}{" "}
                        {appointment.title}
                      </li>
                    ))}
                    {active.length > 3 ? (
                      <li className="px-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                        +{active.length - 3} more
                      </li>
                    ) : null}
                  </ul>
                </>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

async function Calendar({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, { business }] = await Promise.all([
    searchParams,
    requireBusinessContext(),
  ]);
  const timeZone = business.timezone;
  const today = todayIn(timeZone);
  const range = calendarRange(
    parseView(params.view),
    parseDate(params.date, today),
    timeZone,
  );
  const appointments = await listAppointmentsBetween(range.start, range.end);
  const groups = groupByDay(appointments, timeZone);

  return (
    <div className="space-y-4">
      {params.deleted === "1" ? (
        <Alert tone="success">The appointment was deleted.</Alert>
      ) : null}
      <Toolbar range={range} today={today} />
      {range.view === "day" ? (
        <DayView
          date={range.date}
          appointments={groups.get(range.date) ?? []}
          timeZone={timeZone}
        />
      ) : range.view === "week" ? (
        <WeekView
          range={range}
          groups={groups}
          today={today}
          timeZone={timeZone}
        />
      ) : (
        <MonthView
          range={range}
          groups={groups}
          today={today}
          timeZone={timeZone}
        />
      )}
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Times are in {timezoneLabel(timeZone)}.
      </p>
    </div>
  );
}

function CalendarSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-label="Loading calendar">
      <div className="h-10 rounded-lg bg-zinc-100 dark:bg-zinc-900" />
      <div className="h-96 rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
    </div>
  );
}

export default function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Calendar
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Your appointments by day, week or month.
          </p>
        </div>
        <Link href="/appointments/new" className={buttonClasses("primary")}>
          New appointment
        </Link>
      </div>
      <Suspense fallback={<CalendarSkeleton />}>
        <Calendar searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
