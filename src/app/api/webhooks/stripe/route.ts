import { connection } from "next/server";
import type Stripe from "stripe";

import { applyStripeSubscription } from "@/features/billing/sync";
import { logger } from "@/lib/logger";
import { getBillingConfig } from "@/lib/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const NO_STORE = { "Cache-Control": "no-store" };

function reply(status: number, body: Record<string, unknown>): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

const SUBSCRIPTION_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
]);

/** The subscription an event is about, if it is one we act on. */
function subscriptionIdOf(event: Stripe.Event): string | null {
  if (event.type === "checkout.session.completed") {
    const { subscription } = event.data.object;
    if (!subscription) return null;
    return typeof subscription === "string" ? subscription : subscription.id;
  }
  if (SUBSCRIPTION_EVENTS.has(event.type)) {
    return (event.data.object as Stripe.Subscription).id;
  }
  return null;
}

/**
 * Stripe calls this when a checkout finishes or a subscription changes
 * (renewal, failed payment, plan change, cancellation). This is the only
 * place that writes a business's plan.
 */
export async function POST(request: Request): Promise<Response> {
  await connection();
  const config = getBillingConfig();
  const db = createSupabaseAdminClient();
  if (!config?.webhookSecret || !db) {
    return reply(503, { error: "Payments are not configured." });
  }

  // The signature covers the exact bytes, so read the raw body first.
  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = config.stripe.webhooks.constructEvent(
      body,
      request.headers.get("stripe-signature") ?? "",
      config.webhookSecret,
    );
  } catch {
    return reply(400, { error: "Invalid signature" });
  }

  const { data: seen, error: seenError } = await db
    .from("stripe_events")
    .select("id")
    .eq("id", event.id)
    .maybeSingle();
  if (seenError) {
    logger.error("billing.webhook_failed", { message: seenError.message });
    return reply(500, { error: "Could not record the event." });
  }
  if (seen) return reply(200, { duplicate: true });

  const subscriptionId = subscriptionIdOf(event);
  let result = "ignored";
  try {
    if (subscriptionId) {
      // Always read the latest state: events can arrive out of order.
      const subscription =
        await config.stripe.subscriptions.retrieve(subscriptionId);
      result = await applyStripeSubscription(db, subscription, config.prices);
    }
    const { error } = await db
      .from("stripe_events")
      .upsert(
        { id: event.id, type: event.type },
        { onConflict: "id", ignoreDuplicates: true },
      );
    if (error) throw error;
  } catch (error) {
    logger.error("billing.webhook_failed", { type: event.type, error });
    // A 5xx makes Stripe retry the delivery later.
    return reply(500, { error: "Could not process the event." });
  }

  logger.info("billing.webhook", { type: event.type, result });
  return reply(200, { result });
}
