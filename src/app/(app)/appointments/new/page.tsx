import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";

import { buttonClasses } from "@/components/ui/button";
import { createAppointmentAction } from "@/features/appointments/actions";
import { parseDate } from "@/features/appointments/calendar";
import { AppointmentForm } from "@/features/appointments/components/appointment-form";
import { listClientOptions } from "@/features/appointments/queries";
import { requireBusinessContext } from "@/features/business/queries";
import { timezoneLabel } from "@/features/business/timezones";
import { todayIn } from "@/lib/time";

export const metadata: Metadata = { title: "New appointment" };

async function NewAppointment({
  searchParams,
}: PageProps<"/appointments/new">) {
  const [params, { business }, clients] = await Promise.all([
    searchParams,
    requireBusinessContext(),
    listClientOptions(),
  ]);

  if (clients.length === 0) {
    return (
      <section className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Add a client first
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Every appointment belongs to a client.
        </p>
        <Link href="/clients/new" className={buttonClasses("primary", "mt-5")}>
          Add client
        </Link>
      </section>
    );
  }

  const requestedClient =
    typeof params.clientId === "string" &&
    z.uuid().safeParse(params.clientId).success &&
    clients.some((client) => client.id === params.clientId)
      ? params.clientId
      : "";

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
      <AppointmentForm
        action={createAppointmentAction}
        clients={clients}
        defaults={{
          clientId: requestedClient,
          date: parseDate(params.date, todayIn(business.timezone)),
          startTime: "09:00",
          duration: "60",
        }}
        timezoneLabel={timezoneLabel(business.timezone)}
        submitLabel="Save appointment"
      />
    </section>
  );
}

export default function NewAppointmentPage(
  props: PageProps<"/appointments/new">,
) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/calendar"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
        >
          ← Calendar
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          New appointment
        </h1>
      </div>
      <Suspense>
        <NewAppointment {...props} />
      </Suspense>
    </div>
  );
}
