import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { buttonClasses } from "@/components/ui/button";
import { AppointmentList } from "@/features/appointments/components/appointment-list";
import {
  APPOINTMENTS_PAGE_SIZE,
  listAppointments,
} from "@/features/appointments/queries";
import { requireBusinessContext } from "@/features/business/queries";
import { parsePage } from "@/features/clients/search";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Appointments" };

type Scope = "upcoming" | "past";
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function pageHref(scope: Scope, page: number): string {
  const params = new URLSearchParams();
  if (scope === "past") params.set("scope", "past");
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/appointments?${query}` : "/appointments";
}

function ScopeTabs({ scope }: { scope: Scope }) {
  const tabs: { value: Scope; label: string }[] = [
    { value: "upcoming", label: "Upcoming" },
    { value: "past", label: "Past" },
  ];
  return (
    <nav
      aria-label="Appointment period"
      className="inline-flex rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900"
    >
      {tabs.map((tab) => (
        <Link
          key={tab.value}
          href={pageHref(tab.value, 1)}
          aria-current={tab.value === scope ? "page" : undefined}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium",
            tab.value === scope
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

async function Appointments({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const scope: Scope = params.scope === "past" ? "past" : "upcoming";
  const page = parsePage(params.page);
  const [{ business }, { appointments, total }] = await Promise.all([
    requireBusinessContext(),
    listAppointments({ scope, page }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / APPOINTMENTS_PAGE_SIZE));

  return (
    <div className="space-y-4">
      <ScopeTabs scope={scope} />
      {appointments.length === 0 ? (
        <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {scope === "upcoming"
              ? "No upcoming appointments"
              : "No past appointments"}
          </h2>
          {scope === "upcoming" ? (
            <Link
              href="/appointments/new"
              className={buttonClasses("primary", "mt-5")}
            >
              New appointment
            </Link>
          ) : null}
        </div>
      ) : (
        <>
          <AppointmentList
            appointments={appointments}
            timeZone={business.timezone}
            showDate
            label={scope === "upcoming" ? "Upcoming" : "Past"}
          />
          <nav
            aria-label="Pagination"
            className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400"
          >
            <p>
              {total} {total === 1 ? "appointment" : "appointments"}
              {pageCount > 1 ? ` · page ${page} of ${pageCount}` : null}
            </p>
            {pageCount > 1 ? (
              <div className="flex gap-2">
                {page > 1 ? (
                  <Link
                    href={pageHref(scope, page - 1)}
                    className={buttonClasses("secondary", "px-3 py-1.5")}
                  >
                    Previous
                  </Link>
                ) : null}
                {page < pageCount ? (
                  <Link
                    href={pageHref(scope, page + 1)}
                    className={buttonClasses("secondary", "px-3 py-1.5")}
                  >
                    Next
                  </Link>
                ) : null}
              </div>
            ) : null}
          </nav>
        </>
      )}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-label="Loading appointments">
      <div className="h-10 w-48 rounded-lg bg-zinc-100 dark:bg-zinc-900" />
      <div className="h-64 rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
    </div>
  );
}

export default function AppointmentsPage({
  searchParams,
}: PageProps<"/appointments">) {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Appointments
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Everything on your schedule, as a list.
          </p>
        </div>
        <Link href="/appointments/new" className={buttonClasses("primary")}>
          New appointment
        </Link>
      </div>
      <Suspense fallback={<ListSkeleton />}>
        <Appointments searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
