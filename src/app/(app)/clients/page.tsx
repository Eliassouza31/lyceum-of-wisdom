import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { buttonClasses } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { clientName } from "@/features/clients/format";
import { CLIENTS_PAGE_SIZE, listClients } from "@/features/clients/queries";
import { parsePage } from "@/features/clients/search";
import { formatPhone } from "@/lib/phone";

export const metadata: Metadata = { title: "Clients" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function pageHref(search: string, page: number): string {
  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/clients?${query}` : "/clients";
}

function ConsentBadge({ consent }: { consent: boolean }) {
  return consent ? (
    <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 ring-inset dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900">
      Email reminders on
    </span>
  ) : (
    <span className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
      No reminders
    </span>
  );
}

async function ClientList({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const search = firstValue(params.q).trim();
  const page = parsePage(params.page);
  const { clients, total } = await listClients({ search, page });
  const pageCount = Math.max(1, Math.ceil(total / CLIENTS_PAGE_SIZE));

  return (
    <div className="space-y-4">
      {params.removed === "1" ? (
        <Alert tone="success">The client was removed.</Alert>
      ) : null}

      <form role="search" action="/clients" className="flex gap-2">
        <label htmlFor="q" className="sr-only">
          Search clients
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={search}
          placeholder="Search by name, email or phone"
          className="block w-full rounded-lg border-0 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm ring-1 ring-zinc-300 ring-inset placeholder:text-zinc-400 focus:ring-2 focus:ring-indigo-600 focus:ring-inset dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-700"
        />
        <button type="submit" className={buttonClasses("secondary")}>
          Search
        </button>
      </form>

      {clients.length === 0 ? (
        <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
          {search ? (
            <>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                No clients match “{search}”
              </h2>
              <Link
                href="/clients"
                className="mt-3 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
              >
                Clear search
              </Link>
            </>
          ) : (
            <>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                No clients yet
              </h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Add your first client to start scheduling appointments.
              </p>
              <Link
                href="/clients/new"
                className={buttonClasses("primary", "mt-5")}
              >
                Add client
              </Link>
            </>
          )}
        </div>
      ) : (
        <>
          <ul className="divide-y divide-zinc-200 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200 dark:divide-zinc-800 dark:bg-zinc-900 dark:ring-zinc-800">
            {clients.map((client) => (
              <li key={client.id}>
                <Link
                  href={`/clients/${client.id}`}
                  className="flex flex-col gap-2 px-4 py-4 hover:bg-zinc-50 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:hover:bg-zinc-800/50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {clientName(client)}
                    </p>
                    <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                      {[
                        client.email,
                        client.phone_e164 && formatPhone(client.phone_e164),
                      ]
                        .filter(Boolean)
                        .join(" · ") || "No contact details"}
                    </p>
                  </div>
                  <ConsentBadge consent={client.email_reminders_consent} />
                </Link>
              </li>
            ))}
          </ul>
          <nav
            aria-label="Pagination"
            className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400"
          >
            <p>
              {total} {total === 1 ? "client" : "clients"}
              {pageCount > 1 ? ` · page ${page} of ${pageCount}` : null}
            </p>
            {pageCount > 1 ? (
              <div className="flex gap-2">
                {page > 1 ? (
                  <Link
                    href={pageHref(search, page - 1)}
                    className={buttonClasses("secondary", "px-3 py-1.5")}
                  >
                    Previous
                  </Link>
                ) : null}
                {page < pageCount ? (
                  <Link
                    href={pageHref(search, page + 1)}
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
    <div className="animate-pulse space-y-4" aria-label="Loading clients">
      <div className="h-10 rounded-lg bg-zinc-100 dark:bg-zinc-900" />
      <div className="h-64 rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
    </div>
  );
}

export default function ClientsPage({ searchParams }: PageProps<"/clients">) {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Clients
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            The people you book appointments for.
          </p>
        </div>
        <Link href="/clients/new" className={buttonClasses("primary")}>
          Add client
        </Link>
      </div>
      <Suspense fallback={<ListSkeleton />}>
        <ClientList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
