"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireBusinessContext } from "@/features/business/queries";
import { PAID_PLANS } from "@/lib/billing/plans";
import { publicEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getBillingConfig } from "@/lib/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const planSchema = z.enum(PAID_PLANS as [string, ...string[]]);

/** Stripe needs a trial to end at least this far ahead. */
const MIN_TRIAL_LEFT_MS = 49 * 60 * 60 * 1000;

const billingUrl = (query = "") =>
  `${publicEnv.NEXT_PUBLIC_APP_URL}/billing${query}`;

/**
 * Billing writes the Stripe customer id, which members cannot change, so it
 * uses the admin client, and only after checking the member's role here.
 */
async function requireBillingManager() {
  const context = await requireBusinessContext();
  const { role } = context.business;
  if (role !== "owner" && role !== "admin") redirect("/billing?error=role");
  const config = getBillingConfig();
  const db = createSupabaseAdminClient();
  if (!config || !db) redirect("/billing?error=setup");
  return { ...context, config, db };
}

async function loadSubscription(
  db: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  businessId: string,
) {
  const { data, error } = await db
    .from("subscriptions")
    .select("status, trial_ends_at, stripe_customer_id, stripe_subscription_id")
    .eq("business_id", businessId)
    .single();
  if (error) throw error;
  return data;
}

/** Sends the owner to Stripe Checkout to buy a plan. */
export async function startCheckoutAction(formData: FormData) {
  const parsed = planSchema.safeParse(formData.get("plan"));
  if (!parsed.success) redirect("/billing");
  const plan = parsed.data as (typeof PAID_PLANS)[number];
  const { business, email, config, db } = await requireBillingManager();
  const price = config.prices[plan];
  if (!price) redirect("/billing?error=setup");

  let url: string | null = null;
  try {
    let sub = await loadSubscription(db, business.id);

    // Already paying: plan changes happen in the Stripe portal.
    if (
      sub.stripe_subscription_id &&
      sub.stripe_customer_id &&
      sub.status !== "canceled"
    ) {
      const portal = await config.stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id,
        return_url: billingUrl(),
      });
      url = portal.url;
    } else {
      if (!sub.stripe_customer_id) {
        const customer = await config.stripe.customers.create({
          email: email || undefined,
          name: business.name,
          metadata: { business_id: business.id },
        });
        // If two clicks raced, the first customer saved wins.
        const { error } = await db
          .from("subscriptions")
          .update({ stripe_customer_id: customer.id })
          .eq("business_id", business.id)
          .is("stripe_customer_id", null);
        if (error) throw error;
        sub = await loadSubscription(db, business.id);
      }

      // Paying during the free trial keeps the days that are left.
      const trialEnd =
        sub.status === "trialing" && sub.trial_ends_at
          ? new Date(sub.trial_ends_at).getTime()
          : 0;
      const session = await config.stripe.checkout.sessions.create({
        mode: "subscription",
        customer: sub.stripe_customer_id ?? undefined,
        client_reference_id: business.id,
        line_items: [{ price, quantity: 1 }],
        subscription_data: {
          metadata: { business_id: business.id },
          ...(trialEnd - Date.now() >= MIN_TRIAL_LEFT_MS
            ? { trial_end: Math.floor(trialEnd / 1000) }
            : {}),
        },
        allow_promotion_codes: true,
        success_url: billingUrl("?checkout=success"),
        cancel_url: billingUrl("?checkout=cancelled"),
      });
      url = session.url;
    }
  } catch (error) {
    logger.error("billing.checkout_failed", { plan, error });
  }
  redirect(url ?? "/billing?error=stripe");
}

/** Opens Stripe's customer portal: card, invoices, plan changes, cancelling. */
export async function openBillingPortalAction() {
  const { business, config, db } = await requireBillingManager();
  let url: string | null = null;
  try {
    const sub = await loadSubscription(db, business.id);
    if (sub.stripe_customer_id) {
      const portal = await config.stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id,
        return_url: billingUrl(),
      });
      url = portal.url;
    }
  } catch (error) {
    logger.error("billing.portal_failed", { error });
  }
  redirect(url ?? "/billing?error=stripe");
}
