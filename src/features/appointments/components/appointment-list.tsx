import Link from "next/link";

import { clientName } from "@/features/clients/format";
import { cn } from "@/lib/cn";
import { formatLocalDate, localDateOf } from "@/lib/time";

import { formatTimeRange } from "../format";
import type { AppointmentSummary } from "../queries";
import { StatusBadge } from "./status-badge";

/** Appointments as a card of rows. `showDate` adds the day to each row. */
export function AppointmentList({
  appointments,
  timeZone,
  showDate = false,
  showClient = true,
  label,
}: {
  appointments: AppointmentSummary[];
  timeZone: string;
  showDate?: boolean;
  showClient?: boolean;
  label?: string;
}) {
  return (
    <ul
      aria-label={label}
      className="divide-y divide-zinc-200 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200 dark:divide-zinc-800 dark:bg-zinc-900 dark:ring-zinc-800"
    >
      {appointments.map((appointment) => {
        const inactive =
          appointment.status === "cancelled" ||
          appointment.status === "no_show";
        return (
          <li key={appointment.id}>
            <Link
              href={`/appointments/${appointment.id}`}
              className="flex flex-col gap-2 px-4 py-4 hover:bg-zinc-50 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:hover:bg-zinc-800/50"
            >
              <div className="min-w-0">
                <p
                  className={cn(
                    "truncate text-sm font-medium text-zinc-900 dark:text-zinc-100",
                    inactive && "text-zinc-500 line-through dark:text-zinc-500",
                  )}
                >
                  {appointment.title}
                  {showClient ? ` · ${clientName(appointment.client)}` : null}
                </p>
                <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                  {showDate
                    ? `${formatLocalDate(localDateOf(appointment.starts_at, timeZone))} · `
                    : null}
                  {formatTimeRange(
                    appointment.starts_at,
                    appointment.ends_at,
                    timeZone,
                  )}
                  {appointment.location ? ` · ${appointment.location}` : null}
                </p>
              </div>
              <StatusBadge status={appointment.status} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
