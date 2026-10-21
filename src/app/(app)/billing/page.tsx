import type { Metadata } from "next";
import { Suspense } from "react";

import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  openBillingPortalAction,
  startCheckoutAction,
} from "@/features/billing/actions";
import { getBillingOverview } from "@/features/billing/queries";
import { requireBusinessContext } from "@/features/business/queries";
import {
  daysUntil,
  PAID_PLANS,
  PLANS,
  remindersAllowed,
  type SubscriptionState,
} from "@/lib/billing/plans";
import { cn } from "@/lib/cn";
import { getBillingConfig } from "@/lib/stripe";
import { formatLocalDate, localDateOf } from "@/lib/time";

export const metadata: Metadata = { title: "Plans & billing" };

const MESSAGES: Record<
  string,
  { tone: "success" | "info" | "error"; text: string }
> = {
  success: {
    tone: "success",
    text: "Thank you! Your payment went through. Your plan updates here in a few seconds; refresh the page if it has not changed yet.",
  },
  cancelled: { tone: "info", text: "Checkout cancelled. Nothing was charged." },
  role: {
    tone: "error",
    text: "Only the business owner or an admin can change the plan.",
  },
  setup: {
    tone: "error",
    text: "Payments are not set up yet. Please try again later.",
  },
  stripe: {
    tone: "error",
    text: "We could not reach the payment service. Please try again in a minute.",
  },
};

const numberFormat = new Intl.NumberFormat("en-US");

function statusLine(sub: SubscriptionState, timeZone: string): string {
  const date = (iso: string) => formatLocalDate(localDateOf(iso, timeZone));
  if (sub.plan === "trial" && sub.status === "trialing") {
    if (!sub.trial_ends_at) return "Free trial.";
    const days = daysUntil(sub.trial_ends_at);
    return days > 0
      ? `Free trial: ${days} ${days === 1 ? "day" : "days"} left (ends ${date(sub.trial_ends_at)}).`
      : `Free trial ended on ${date(sub.trial_ends_at)}.`;
  }
  switch (sub.status) {
    case "trialing":
      return sub.trial_ends_at
        ? `Free until ${date(sub.trial_ends_at)}, then billed monthly.`
        : "Active.";
    case "active":
      if (!sub.current_period_end) return "Active.";
      return sub.cancel_at_period_end
        ? `Cancelled: active until ${date(sub.current_period_end)}.`
        : `Active. Renews on ${date(sub.current_period_end)}.`;
    case "past_due":
      return "Payment failed. Please update your card.";
    case "canceled":
      return "Cancelled.";
    default:
      return "Not active.";
  }
}

async function BillingContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ business }, overview, params] = await Promise.all([
    requireBusinessContext(),
    getBillingOverview(),
    searchParams,
  ]);
  if (!overview) {
    return (
      <Alert tone="error">
        We could not find your plan. Please contact support.
      </Alert>
    );
  }
  const { subscription: sub, emailsThisMonth, canManage } = overview;
  const config = getBillingConfig();
  const paymentsReady = Boolean(
    config && PAID_PLANS.every((plan) => config.prices[plan]),
  );
  const key =
    typeof params.checkout === "string"
      ? params.checkout
      : typeof params.error === "string"
        ? params.error
        : undefined;
  const message = key ? MESSAGES[key] : undefined;
  const limit = PLANS[sub.plan].monthlyEmails;
  const usedPercent = Math.min(
    100,
    Math.round((emailsThisMonth / limit) * 100),
  );
  const paying = sub.hasStripeSubscription && sub.status !== "canceled";
  const active = remindersAllowed(sub);

  return (
    <>
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
      {!paymentsReady ? (
        <Alert tone="info">
          Online payments are not connected yet, so plans cannot be bought right
          now.
        </Alert>
      ) : null}
      {!canManage ? (
        <Alert tone="info">
          Only the business owner or an admin can change the plan.
        </Alert>
      ) : null}

      <section className="space-y-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Current plan
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              {PLANS[sub.plan].name}
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {statusLine(sub, business.timezone)}{" "}
              {active ? "Reminders are on." : "Reminders are paused."}
            </p>
          </div>
          {canManage && paymentsReady && sub.hasStripeSubscription ? (
            <form action={openBillingPortalAction}>
              <SubmitButton pendingLabel="Opening…" variant="secondary">
                Manage billing
              </SubmitButton>
            </form>
          ) : null}
        </div>
        <div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">
              Reminder emails this month
            </span>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {numberFormat.format(emailsThisMonth)} of{" "}
              {numberFormat.format(limit)}
            </span>
          </div>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
            role="progressbar"
            aria-label="Reminder emails used this month"
            aria-valuemin={0}
            aria-valuemax={limit}
            aria-valuenow={emailsThisMonth}
          >
            <div
              className={cn(
                "h-full rounded-full",
                usedPercent >= 100
                  ? "bg-red-500"
                  : usedPercent >= 80
                    ? "bg-amber-500"
                    : "bg-indigo-600",
              )}
              style={{ width: `${usedPercent}%` }}
            />
          </div>
          {usedPercent >= 100 ? (
            <p className="mt-2 text-sm text-red-700 dark:text-red-300">
              Monthly limit reached: reminders are skipped until next month. A
              bigger plan raises the limit.
            </p>
          ) : null}
        </div>
      </section>

      <section aria-label="Plans" className="grid gap-4 md:grid-cols-3">
        {PAID_PLANS.map((plan) => {
          const definition = PLANS[plan];
          const current = paying && sub.plan === plan;
          return (
            <div
              key={plan}
              className={cn(
                "flex flex-col rounded-2xl bg-white p-6 shadow-sm ring-1 dark:bg-zinc-900",
                current
                  ? "ring-2 ring-indigo-600 dark:ring-indigo-500"
                  : "ring-zinc-200 dark:ring-zinc-800",
              )}
            >
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                {definition.name}
              </h2>
              <p className="mt-2">
                <span className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                  ${definition.priceUsd}
                </span>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  {" "}
                  / month
                </span>
              </p>
              <ul className="mt-4 flex-1 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                {definition.features.map((feature) => (
                  <li key={feature}>✓ {feature}</li>
                ))}
              </ul>
              <div className="mt-6">
                {current ? (
                  <p className="text-center text-sm font-medium text-indigo-700 dark:text-indigo-300">
                    Your plan
                  </p>
                ) : canManage && paymentsReady ? (
                  <form action={startCheckoutAction}>
                    <input type="hidden" name="plan" value={plan} />
                    <SubmitButton pendingLabel="Opening…" className="w-full">
                      {paying
                        ? `Switch to ${definition.name}`
                        : `Choose ${definition.name}`}
                    </SubmitButton>
                  </form>
                ) : null}
              </div>
            </div>
          );
        })}
      </section>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Prices in US dollars. Payments are handled securely by Stripe; we never
        see your card number. You can cancel at any time.
      </p>
    </>
  );
}

function BillingSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-label="Loading plans">
      <div className="h-40 rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
      <div className="h-72 rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
    </div>
  );
}

export default function BillingPage({ searchParams }: PageProps<"/billing">) {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Plans & billing
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Your plan, this month&apos;s reminder emails and payments.
        </p>
      </div>
      <Suspense fallback={<BillingSkeleton />}>
        <BillingContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
