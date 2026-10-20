import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { buttonClasses } from "@/components/ui/button";
import { requireBusinessContext } from "@/features/business/queries";
import { parsePage } from "@/features/clients/search";
import { ReminderList } from "@/features/reminders/components/reminder-list";
import {
  getMonthlyEmailCount,
  HISTORY_PAGE_SIZE,
  listReminderHistory,
} from "@/features/reminders/queries";

export const metadata: Metadata = { title: "Notification history" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function pageHref(page: number): string {
  return page > 1 ? `/notifications?page=${page}` : "/notifications";
}

async function History({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const [{ business }, { items, total }, sentThisMonth] = await Promise.all([
    requireBusinessContext(),
    listReminderHistory(page),
    getMonthlyEmailCount(),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE));

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
          {sentThisMonth}
        </span>{" "}
        {sentThisMonth === 1 ? "email" : "emails"} sent this month
      </p>
      {items.length === 0 ? (
        <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            No reminders yet
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Reminders appear here as soon as you schedule an appointment.
          </p>
          <Link
            href="/appointments/new"
            className={buttonClasses("primary", "mt-5")}
          >
            New appointment
          </Link>
        </div>
      ) : (
        <>
          <ReminderList
            items={items}
            timeZone={business.timezone}
            label="Reminders"
          />
          <nav
            aria-label="Pagination"
            className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400"
          >
            <p>
              {total} {total === 1 ? "reminder" : "reminders"}
              {pageCount > 1 ? ` · page ${page} of ${pageCount}` : null}
            </p>
            {pageCount > 1 ? (
              <div className="flex gap-2">
                {page > 1 ? (
                  <Link
                    href={pageHref(page - 1)}
                    className={buttonClasses("secondary", "px-3 py-1.5")}
                  >
                    Previous
                  </Link>
                ) : null}
                {page < pageCount ? (
                  <Link
                    href={pageHref(page + 1)}
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
    <div className="animate-pulse space-y-4" aria-label="Loading history">
      <div className="h-5 w-48 rounded bg-zinc-100 dark:bg-zinc-900" />
      <div className="h-64 rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
    </div>
  );
}

export default function NotificationsPage({
  searchParams,
}: PageProps<"/notifications">) {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Notification history
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Every reminder: scheduled, sent, delivered or not sent, and why.
          </p>
        </div>
        <Link
          href="/reminders"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
        >
          Settings →
        </Link>
      </div>
      <Suspense fallback={<ListSkeleton />}>
        <History searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
