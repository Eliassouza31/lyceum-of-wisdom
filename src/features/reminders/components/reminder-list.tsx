import Link from "next/link";

import { clientName } from "@/features/clients/format";
import { formatDateTime } from "@/lib/time";

import { reminderNote, reminderState } from "../format";
import { formatOffset } from "../offsets";
import type { HistoryItem, ReminderJobSummary } from "../queries";
import { ReminderBadge } from "./reminder-badge";

function when(job: ReminderJobSummary, timeZone: string): string {
  if (job.sent_at) return `Sent ${formatDateTime(job.sent_at, timeZone)}`;
  if (job.status === "failed" && job.next_attempt_at) {
    return `Next try ${formatDateTime(job.next_attempt_at, timeZone)}`;
  }
  const verb = job.status === "pending" ? "Sends" : "Was due";
  return `${verb} ${formatDateTime(job.send_at, timeZone)}`;
}

/** Reminders as a list; rows that carry their appointment link to it. */
export function ReminderList({
  items,
  timeZone,
  label,
}: {
  items: (ReminderJobSummary & Partial<Pick<HistoryItem, "appointment">>)[];
  timeZone: string;
  label: string;
}) {
  return (
    <ul
      aria-label={label}
      className="divide-y divide-zinc-200 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200 dark:divide-zinc-800 dark:bg-zinc-900 dark:ring-zinc-800"
    >
      {items.map((job) => {
        const state = reminderState(job);
        const note = reminderNote(job);
        return (
          <li key={job.id} className="space-y-1 px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <ReminderBadge label={state.label} tone={state.tone} />
              {job.appointment ? (
                <Link
                  href={`/appointments/${job.appointment.id}`}
                  className="text-sm font-medium text-zinc-900 hover:text-indigo-600 dark:text-zinc-100 dark:hover:text-indigo-400"
                >
                  {job.appointment.title} · {clientName(job.appointment.client)}
                </Link>
              ) : (
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Email {formatOffset(job.offset_minutes)}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              {job.appointment
                ? `Email ${formatOffset(job.offset_minutes)} · `
                : null}
              {when(job, timeZone)}
            </p>
            {note ? (
              <p className="text-xs break-words text-zinc-500 dark:text-zinc-400">
                {note}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
