import type { Metadata } from "next";
import Link from "next/link";

import { createClientAction } from "@/features/clients/actions";
import { ClientForm } from "@/features/clients/components/client-form";

export const metadata: Metadata = { title: "Add client" };

export default function NewClientPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/clients"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
        >
          ← Clients
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Add client
        </h1>
      </div>
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        <ClientForm action={createClientAction} submitLabel="Save client" />
      </section>
    </div>
  );
}
