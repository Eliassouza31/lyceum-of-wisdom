import { formatTime } from "@/lib/time";

import type { APPOINTMENT_STATUSES } from "./schemas";

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: "Scheduled",
  cancelled: "Cancelled",
  completed: "Completed",
  no_show: "No-show",
};

/** "1 h 30 min", "45 min", "2 h". */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

export function durationMinutes(startsAt: string, endsAt: string): number {
  return Math.round(
    (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60_000,
  );
}

/** "9:00 AM – 10:30 AM" in the business's time zone. */
export function formatTimeRange(
  startsAt: string,
  endsAt: string,
  timeZone: string,
): string {
  return `${formatTime(startsAt, timeZone)} – ${formatTime(endsAt, timeZone)}`;
}

/** Status changes offered on an appointment, depending on where it stands. */
export function statusActions(
  status: AppointmentStatus,
  startsAt: string,
  now: Date = new Date(),
): AppointmentStatus[] {
  if (status !== "scheduled") return ["scheduled"];
  const started = new Date(startsAt).getTime() <= now.getTime();
  return started ? ["completed", "no_show", "cancelled"] : ["cancelled"];
}

export const STATUS_ACTION_LABELS: Record<AppointmentStatus, string> = {
  scheduled: "Restore as scheduled",
  cancelled: "Cancel appointment",
  completed: "Mark as completed",
  no_show: "Mark as no-show",
};
