import "server-only";

import { cache } from "react";

import { getMonthlyEmailCount } from "@/features/reminders/queries";
import { requireBusinessContext } from "@/features/business/queries";
import type { SubscriptionState } from "@/lib/billing/plans";
import { logger } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type BillingOverview = {
  subscription: SubscriptionState & { hasStripeSubscription: boolean };
  emailsThisMonth: number;
  canManage: boolean;
};

/** The business's plan, read through Row Level Security. */
export const getSubscription = cache(async () => {
  const { business } = await requireBusinessContext();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select(
      "plan, status, trial_ends_at, past_due_since, current_period_end, cancel_at_period_end, stripe_subscription_id",
    )
    .eq("business_id", business.id)
    .maybeSingle();
  if (error) {
    logger.error("billing.load_failed", { message: error.message });
    throw new Error("Could not load your plan. Please try again.");
  }
  if (!data) return null;
  const { stripe_subscription_id, ...state } = data;
  return { ...state, hasStripeSubscription: Boolean(stripe_subscription_id) };
});

export async function getBillingOverview(): Promise<BillingOverview | null> {
  const [{ business }, subscription, emailsThisMonth] = await Promise.all([
    requireBusinessContext(),
    getSubscription(),
    getMonthlyEmailCount(),
  ]);
  if (!subscription) return null;
  return {
    subscription,
    emailsThisMonth,
    canManage: business.role === "owner" || business.role === "admin",
  };
}
