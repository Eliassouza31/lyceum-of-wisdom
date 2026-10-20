import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { Alert } from "@/components/ui/alert";
import { requireBusinessContext } from "@/features/business/queries";
import {
  deleteClientAction,
  updateClientAction,
} from "@/features/clients/actions";
import { ClientForm } from "@/features/clients/components/client-form";
import { DeleteClientButton } from "@/features/clients/components/delete-client-button";
import { clientName, consentEventLabel } from "@/features/clients/format";
import { getClient, getConsentHistory } from "@/features/clients/queries";
import { formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Client" };

const SAVED_MESSAGES: Record<string, string> = {
  created: "Client added.",
  updated: "Changes saved.",
};

async function ClientDetails({
  params,
  searchParams,
}: PageProps<"/clients/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(id).success) notFound();

  const [{ business }, client, history] = await Promise.all([
    requireBusinessContext(),
    getClient(id),
    getConsentHistory(id),
  ]);
  const name = clientName(client);
  const saved = typeof query.saved === "string" ? query.saved : undefined;

  return (
    <>
      <div>
        <Link
          href="/clients"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
        >
          ← Clients
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight break-words text-zinc-900 dark:text-zinc-100">
          {name}
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Added {formatDateTime(client.created_at, business.timezone)}
        </p>
      </div>

      {saved && SAVED_MESSAGES[saved] ? (
        <Alert tone="success">{SAVED_MESSAGES[saved]}</Alert>
      ) : null}

      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        <h2 className="mb-5 text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Details
        </h2>
        <ClientForm
          action={updateClientAction.bind(null, client.id)}
          client={client}
          submitLabel="Save changes"
        />
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Consent history
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          A permanent record of when this client agreed to, or stopped,
          reminders.
        </p>
        {history.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            No consent recorded yet.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {history.map((event) => (
              <li
                key={event.id}
                className="flex flex-col text-sm sm:flex-row sm:justify-between sm:gap-4"
              >
                <span className="text-zinc-900 dark:text-zinc-100">
                  {consentEventLabel(event)}
                </span>
                <span className="text-zinc-500 dark:text-zinc-400">
                  {formatDateTime(event.created_at, business.timezone)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200 sm:flex-row sm:items-center sm:justify-between dark:bg-zinc-900 dark:ring-zinc-800">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Remove client
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Their consent history is kept for your records.
          </p>
        </div>
        <DeleteClientButton
          action={deleteClientAction.bind(null, client.id)}
          clientName={name}
        />
      </section>
    </>
  );
}

export default function ClientPage(props: PageProps<"/clients/[id]">) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Suspense>
        <ClientDetails {...props} />
      </Suspense>
    </div>
  );
}
