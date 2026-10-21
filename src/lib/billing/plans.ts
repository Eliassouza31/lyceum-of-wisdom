import type { Database } from "@/types/database.types";

export type PlanTier = Database["public"]["Enums"]["plan_tier"];
export type PaidPlan = Exclude<PlanTier, "trial">;

export type PlanDefinition = {
  name: string;
  /** US dollars per month; 0 for the free trial. */
  priceUsd: number;
  /** Reminder emails per calendar month (in the business's time zone). */
  monthlyEmails: number;
  features: string[];
};

export const TRIAL_DAYS = 14;
/** After a failed payment, reminders keep going for this many days. */
export const PAST_DUE_GRACE_DAYS = 7;

/**
 * The single source of plan limits. The monthly email limit is repeated in
 * the database (public.plan_monthly_email_limit) because the dispatcher
 * enforces it there; an integration test keeps both in sync.
 */
export const PLANS: Record<PlanTier, PlanDefinition> = {
  trial: {
    name: "Free trial",
    priceUsd: 0,
    monthlyEmails: 1000,
    features: [`${TRIAL_DAYS} days, no card needed`],
  },
  basic: {
    name: "Basic",
    priceUsd: 19,
    monthlyEmails: 1000,
    features: ["1,000 reminder emails a month", "Email support"],
  },
  pro: {
    name: "Pro",
    priceUsd: 49,
    monthlyEmails: 5000,
    features: ["5,000 reminder emails a month", "Priority email support"],
  },
  business: {
    name: "Business",
    priceUsd: 99,
    monthlyEmails: 20000,
    features: ["20,000 reminder emails a month", "Priority support"],
  },
};

export const PAID_PLANS: PaidPlan[] = ["basic", "pro", "business"];

export type PriceIds = Record<PaidPlan, string | undefined>;

/** Which plan a Stripe price belongs to, or null for a price we do not sell. */
export function planForPrice(
  priceId: string | null | undefined,
  prices: PriceIds,
): PaidPlan | null {
  if (!priceId) return null;
  return PAID_PLANS.find((plan) => prices[plan] === priceId) ?? null;
}

export type SubscriptionState = {
  plan: PlanTier;
  status: string;
  trial_ends_at: string | null;
  past_due_since: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

const DAY = 24 * 60 * 60 * 1000;

/**
 * Same rule as public.subscription_allows_reminders in the database, which
 * is what actually decides; this copy only drives what the pages say.
 */
export function remindersAllowed(
  sub: Pick<SubscriptionState, "status" | "trial_ends_at" | "past_due_since">,
  now: Date = new Date(),
): boolean {
  switch (sub.status) {
    case "trialing":
      return !sub.trial_ends_at || new Date(sub.trial_ends_at) > now;
    case "active":
      return true;
    case "past_due":
      return (
        !sub.past_due_since ||
        new Date(sub.past_due_since).getTime() + PAST_DUE_GRACE_DAYS * DAY >
          now.getTime()
      );
    default:
      return false;
  }
}

/** Whole days left until a date, rounded up; 0 once it has passed. */
export function daysUntil(iso: string, now: Date = new Date()): number {
  return Math.max(
    0,
    Math.ceil((new Date(iso).getTime() - now.getTime()) / DAY),
  );
}

export type BillingNotice = {
  tone: "info" | "warning" | "error";
  message: string;
};

/** The one thing the business most needs to know about its plan, if anything. */
export function billingNotice(
  sub: SubscriptionState,
  now: Date = new Date(),
): BillingNotice | null {
  if (!remindersAllowed(sub, now)) {
    return {
      tone: "error",
      message:
        sub.status === "trialing"
          ? "Your free trial has ended. Reminders are paused until you choose a plan."
          : "Reminders are paused because your subscription is not active. Choose a plan to turn them back on.",
    };
  }
  if (sub.status === "past_due") {
    const pausesAt = new Date(
      new Date(sub.past_due_since ?? now).getTime() + PAST_DUE_GRACE_DAYS * DAY,
    ).toISOString();
    const days = daysUntil(pausesAt, now);
    return {
      tone: "warning",
      message: `Your last payment failed. Update your card within ${days} ${days === 1 ? "day" : "days"} to keep reminders going.`,
    };
  }
  if (sub.status === "trialing" && sub.trial_ends_at) {
    const days = daysUntil(sub.trial_ends_at, now);
    if (days <= 3) {
      return {
        tone: "warning",
        message: `Your free trial ends in ${days} ${days === 1 ? "day" : "days"}. Choose a plan to keep reminders going.`,
      };
    }
  }
  return null;
}
