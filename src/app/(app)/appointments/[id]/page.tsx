import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { Alert } from "@/components/ui/alert";
import {
  deleteAppointmentAction,
  setAppointmentStatusAction,
  updateAppointmentAction,
} from "@/features/appointments/actions";
import { calendarHref } from "@/features/appointments/calendar";
import { AppointmentForm } from "@/features/appointments/components/appointment-form";
import { ConfirmActionButton } from "@/features/appointments/components/confirm-action-button";
import { StatusBadge } from "@/features/appointments/components/status-badge";
import {
  durationMinutes,
  formatDuration,
  formatTimeRange,
  STATUS_ACTION_LABELS,
  statusActions,
} from "@/features/appointments/format";
import {
  getAppointment,
  listClientOptions,
} from "@/features/appointments/queries";
import { requireBusinessContext } from "@/features/business/queries";
import { timezoneLabel } from "@/features/business/timezones";
import { clientName } from "@/features/clients/format";
import {
  formatLocalDate,
  localDateOf,
  localTimeOf,
  zoneName,
} from "@/lib/time";

export const metadata: Metadata = { title: "Appointment" };

const SAVED_MESSAGES: Record<string, string> = {
  created: "Appointment saved.",
  updated: "Changes saved.",
  scheduled: "The appointment is scheduled again.",
  cancelled: "The appointment was cancelled.",
  completed: "Marked as completed.",
  no_show: "Marked as a no-show.",
};

const CONFIRM_MESSAGES: Partial<Record<string, string>> = {
  cancelled: "Cancel this appointment?",
};

async function AppointmentDetails({
  params,
  searchParams,
}: PageProps<"/appointments/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(id).success) notFound();

  const [{ business }, appointment, clients] = await Promise.all([
    requireBusinessContext(),
    getAppointment(id),
    listClientOptions(),
  ]);
  const timeZone = business.timezone;
  const day = localDateOf(appointment.starts_at, timeZone);
  const saved = typeof query.saved === "string" ? query.saved : undefined;
  // The client may have been removed since; keep them selectable here.
  const clientOptions = clients.some(
    (client) => client.id === appointment.client_id,
  )
    ? clients
    : [appointment.client, ...clients];

  return (
    <>
      <div>
        <Link
          href={calendarHref("day", day)}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
        >
          ← {formatLocalDate(day)}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight break-words text-zinc-900 dark:text-zinc-100">
            {appointment.title}
          </h1>
          <StatusBadge status={appointment.status} />
        </div>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          <Link
            href={`/clients/${appointment.client.id}`}
            className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            {clientName(appointment.client)}
          </Link>
          {" · "}
          {formatLocalDate(day)} ·{" "}
          {formatTimeRange(
            appointment.starts_at,
            appointment.ends_at,
            timeZone,
          )}{" "}
          {zoneName(new Date(appointment.starts_at), timeZone)}
        </p>
      </div>

      {saved && SAVED_MESSAGES[saved] ? (
        <Alert tone="success">{SAVED_MESSAGES[saved]}</Alert>
      ) : null}

      <section className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Status
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Only scheduled appointments get reminders.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {statusActions(appointment.status, appointment.starts_at).map(
            (status) => (
              <ConfirmActionButton
                key={status}
                action={setAppointmentStatusAction.bind(
                  null,
                  appointment.id,
                  status,
                )}
                label={STATUS_ACTION_LABELS[status]}
                confirmMessage={CONFIRM_MESSAGES[status]}
              />
            ),
          )}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        <h2 className="mb-5 text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Details
        </h2>
        <AppointmentForm
          action={updateAppointmentAction.bind(null, appointment.id)}
          clients={clientOptions}
          defaults={{
            clientId: appointment.client_id,
            title: appointment.title,
            date: day,
            startTime: localTimeOf(appointment.starts_at, timeZone),
            duration: String(
              durationMinutes(appointment.starts_at, appointment.ends_at),
            ),
            location: appointment.location ?? "",
            notes: appointment.notes ?? "",
          }}
          timezoneLabel={timezoneLabel(timeZone)}
          submitLabel="Save changes"
        />
      </section>

      <section className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200 sm:flex-row sm:items-center sm:justify-between dark:bg-zinc-900 dark:ring-zinc-800">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Delete appointment
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Booked by mistake? Delete it. To keep a record, cancel it instead.
          </p>
        </div>
        <ConfirmActionButton
          action={deleteAppointmentAction.bind(null, appointment.id)}
          label="Delete appointment"
          confirmMessage={`Delete “${appointment.title}” (${formatDuration(
            durationMinutes(appointment.starts_at, appointment.ends_at),
          )})? It will disappear from your calendar.`}
          danger
        />
      </section>
    </>
  );
}

export default function AppointmentPage(
  props: PageProps<"/appointments/[id]">,
) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Suspense>
        <AppointmentDetails {...props} />
      </Suspense>
    </div>
  );
}
