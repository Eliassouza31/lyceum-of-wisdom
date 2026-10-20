import type { Metadata } from "next";
import { Suspense } from "react";

import { Alert } from "@/components/ui/alert";
import { requireBusinessContext } from "@/features/business/queries";
import { timezoneLabel } from "@/features/business/timezones";

export const metadata: Metadata = { title: "Dashboard" };

const SETUP_STEPS = [
  { title: "Create your account", done: true },
  { title: "Set up your business", done: true },
  { title: "Add your first client", done: false },
  { title: "Schedule an appointment", done: false },
  { title: "Turn on email reminders", done: false },
];

async function DashboardContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ business, fullName }, params] = await Promise.all([
    requireBusinessContext(),
    searchParams,
  ]);
  const firstName = fullName.split(" ")[0];

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {params.passwordUpdated === "1" ? (
        <Alert tone="success">Your password was updated.</Alert>
      ) : null}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          {firstName ? `Welcome, ${firstName}` : "Welcome"}
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {business.name} · {timezoneLabel(business.timezone)}
        </p>
      </div>

      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Get started
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Finish these steps to start sending automatic reminders.
        </p>
        <ol className="mt-5 space-y-3">
          {SETUP_STEPS.map((step, index) => (
            <li key={step.title} className="flex items-center gap-3 text-sm">
              <span
                className={
                  step.done
                    ? "grid size-6 place-items-center rounded-full bg-emerald-600 text-xs font-semibold text-white"
                    : "grid size-6 place-items-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                }
                aria-hidden="true"
              >
                {step.done ? "✓" : index + 1}
              </span>
              <span
                className={
                  step.done
                    ? "text-zinc-500 line-through dark:text-zinc-500"
                    : "text-zinc-900 dark:text-zinc-100"
                }
              >
                {step.title}
                <span className="sr-only">
                  {step.done ? " (done)" : " (coming soon)"}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

export default function DashboardPage({
  searchParams,
}: PageProps<"/dashboard">) {
  return (
    <Suspense>
      <DashboardContent searchParams={searchParams} />
    </Suspense>
  );
}
