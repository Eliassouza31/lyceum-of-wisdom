import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";

import { planForPrice, type PriceIds } from "@/lib/billing/plans";
import { logger } from "@/lib/logger";
import type { Database } from "@/types/database.types";

type AdminClient = SupabaseClient<Database>;
type SubscriptionUpdate =
  Database["public"]["Tables"]["subscriptions"]["Update"];

/** Stripe statuses of a checkout that never got paid: they never gave access. */
const NEVER_STARTED = new Set(["incomplete", "incomplete_expired"]);

const toIso = (seconds: number | null | undefined) =>
  seconds ? new Date(seconds * 1000).toISOString() : null;

export function customerIdOf(subscription: Stripe.Subscription): string {
  const { customer } = subscription;
  return typeof customer === "string" ? customer : customer.id;
}

/** The subscriptions row that mirrors a Stripe subscription. Pure, so it is easy to test. */
export function subscriptionUpdateFromStripe(
  subscription: Stripe.Subscription,
  prices: PriceIds,
): SubscriptionUpdate {
  const item = subscription.items.data[0];
  const priceId = item?.price.id ?? null;
  const plan = planForPrice(priceId, prices);
  return {
    // A price we do not know (say, an old one) keeps the plan we had.
    ...(plan ? { plan } : {}),
    status: subscription.status,
    stripe_customer_id: customerIdOf(subscription),
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId,
    trial_ends_at: toIso(subscription.trial_end),
    current_period_end: toIso(item?.current_period_end),
    cancel_at_period_end: subscription.cancel_at_period_end,
  };
}

export type SyncResult = "updated" | "ignored" | "unknown_customer";

/**
 * Copies a Stripe subscription (always freshly fetched, so events arriving
 * out of order cannot leave an old state behind) into the business's row.
 */
export async function applyStripeSubscription(
  db: AdminClient,
  subscription: Stripe.Subscription,
  prices: PriceIds,
): Promise<SyncResult> {
  if (NEVER_STARTED.has(subscription.status)) return "ignored";

  const customerId = customerIdOf(subscription);
  const byCustomer = await db
    .from("subscriptions")
    .select("business_id, stripe_subscription_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (byCustomer.error) throw byCustomer.error;

  let row = byCustomer.data;
  const businessId = subscription.metadata?.business_id;
  if (!row && businessId) {
    const byBusiness = await db
      .from("subscriptions")
      .select("business_id, stripe_subscription_id")
      .eq("business_id", businessId)
      .maybeSingle();
    if (byBusiness.error) throw byBusiness.error;
    row = byBusiness.data;
  }
  if (!row) {
    logger.warn("billing.unknown_customer", {
      customerId,
      subscriptionId: subscription.id,
    });
    return "unknown_customer";
  }

  // An older subscription ending must not overwrite the one in use now.
  if (
    row.stripe_subscription_id &&
    row.stripe_subscription_id !== subscription.id &&
    subscription.status === "canceled"
  ) {
    return "ignored";
  }

  const update = subscriptionUpdateFromStripe(subscription, prices);
  if (!update.plan) {
    logger.warn("billing.unknown_price", {
      priceId: update.stripe_price_id,
      subscriptionId: subscription.id,
    });
  }
  const { error } = await db
    .from("subscriptions")
    .update(update)
    .eq("business_id", row.business_id);
  if (error) throw error;
  return "updated";
}
