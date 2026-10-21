import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { applyStripeSubscription } from "@/features/billing/sync";
import { runDispatch } from "@/features/reminders/dispatcher";
import type { SendEmail } from "@/features/reminders/resend";
import { PLANS, type PlanTier } from "@/lib/billing/plans";
import type { Database } from "@/types/database.types";

import {
  adminClient,
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "./helpers";

let alice: TestUser;
let bob: TestUser;
let carol: TestUser;
let aliceBusinessId: string;
let bobBusinessId: string;
let clientId: string;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const inHours = (hours: number) =>
  new Date(Date.now() + hours * HOUR).toISOString();
const admin = () => adminClient() as unknown as SupabaseClient<Database>;
const prices = {
  basic: "price_basic",
  pro: "price_pro",
  business: "price_biz",
};

async function createBusiness(user: TestUser, name: string) {
  const { data, error } = await user.client.rpc("create_business", {
    p_name: name,
    p_timezone: "America/Chicago",
  });
  if (error) throw error;
  return data as string;
}

async function setSubscription(
  businessId: string,
  fields: Database["public"]["Tables"]["subscriptions"]["Update"],
) {
  const { error } = await admin()
    .from("subscriptions")
    .update(fields)
    .eq("business_id", businessId);
  if (error) throw error;
}

async function subscriptionOf(businessId: string) {
  const { data, error } = await admin()
    .from("subscriptions")
    .select("*")
    .eq("business_id", businessId)
    .single();
  if (error) throw error;
  return data;
}

/** A due reminder job for a new appointment of Alice's client. */
async function dueJob(): Promise<string> {
  const { data: appointment, error } = await alice.client
    .from("appointments")
    .insert({
      business_id: aliceBusinessId,
      client_id: clientId,
      title: "Haircut",
      starts_at: inHours(30),
      ends_at: inHours(31),
    })
    .select("id")
    .single();
  if (error) throw error;
  const { data: job, error: jobError } = await admin()
    .from("reminder_jobs")
    .update({ next_attempt_at: new Date(Date.now() - 1000).toISOString() })
    .eq("appointment_id", appointment.id)
    .select("id")
    .single();
  if (jobError) throw jobError;
  return job.id;
}

async function jobState(jobId: string) {
  const { data, error } = await admin()
    .from("reminder_jobs")
    .select("status, skip_reason")
    .eq("id", jobId)
    .single();
  if (error) throw error;
  return data;
}

async function dispatch() {
  const sent: string[] = [];
  const send: SendEmail = async (email) => {
    sent.push(email.to);
    return { ok: true, id: `email_${sent.length}_${Date.now()}` };
  };
  await runDispatch({
    db: admin(),
    send,
    appUrl: "https://app.example.com",
    fromAddress: "reminders@example.com",
  });
  return sent;
}

function monthStart(): string {
  const local = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
  }).format(new Date());
  return `${local.slice(0, 8)}01`;
}

function stripeSubscription(
  fields: Partial<Record<string, unknown>> = {},
): Stripe.Subscription {
  return {
    id: "sub_alice_1",
    status: "active",
    customer: "cus_alice",
    cancel_at_period_end: false,
    trial_end: null,
    metadata: { business_id: aliceBusinessId },
    items: {
      data: [
        {
          price: { id: "price_pro" },
          current_period_end: Math.floor((Date.now() + 30 * DAY) / 1000),
        },
      ],
    },
    ...fields,
  } as unknown as Stripe.Subscription;
}

beforeAll(async () => {
  alice = await createTestUser("Alice Owner");
  bob = await createTestUser("Bob Owner");
  carol = await createTestUser("Carol Staff");
  aliceBusinessId = await createBusiness(alice, "Alice Barbershop");
  bobBusinessId = await createBusiness(bob, "Bob Salon");

  const { error: memberError } = await adminClient()
    .from("business_members")
    .insert({ business_id: aliceBusinessId, user_id: carol.id, role: "staff" });
  if (memberError) throw memberError;

  const { error: addressError } = await alice.client
    .from("businesses")
    .update({ postal_address: "100 Main St, Austin, TX 78701" })
    .eq("id", aliceBusinessId);
  if (addressError) throw addressError;

  const { data, error } = await alice.client
    .from("clients")
    .insert({
      business_id: aliceBusinessId,
      first_name: "Maria",
      email: `maria-billing-${Date.now()}@example.com`,
      email_reminders_consent: true,
    })
    .select("id")
    .single();
  if (error) throw error;
  clientId = data.id;
});

beforeEach(async () => {
  // Jobs made due elsewhere must not leak into these tests.
  await admin()
    .from("reminder_jobs")
    .update({ status: "cancelled", next_attempt_at: null })
    .in("status", ["pending", "failed", "processing"])
    .lte("next_attempt_at", new Date().toISOString());
  await setSubscription(aliceBusinessId, {
    plan: "trial",
    status: "trialing",
    trial_ends_at: new Date(Date.now() + 14 * DAY).toISOString(),
    stripe_customer_id: null,
    stripe_subscription_id: null,
  });
  await admin()
    .from("usage_counters")
    .delete()
    .eq("business_id", aliceBusinessId);
});

afterAll(async () => {
  await deleteTestUser(alice);
  await deleteTestUser(bob);
  await deleteTestUser(carol);
});

describe("subscriptions", () => {
  it("start every new business on a 14-day free trial", async () => {
    const sub = await subscriptionOf(bobBusinessId);
    expect(sub).toMatchObject({ plan: "trial", status: "trialing" });
    const daysLeft = (Date.parse(sub.trial_ends_at!) - Date.now()) / DAY;
    expect(daysLeft).toBeGreaterThan(13.9);
    expect(daysLeft).toBeLessThanOrEqual(14);
  });

  it("can be read by members but changed only by the server", async () => {
    const { data: own } = await carol.client
      .from("subscriptions")
      .select("plan")
      .eq("business_id", aliceBusinessId);
    expect(own).toHaveLength(1);

    const { data: other } = await bob.client
      .from("subscriptions")
      .select("plan")
      .eq("business_id", aliceBusinessId);
    expect(other).toHaveLength(0);

    const { error: updateError } = await alice.client
      .from("subscriptions")
      .update({ plan: "business", status: "active" })
      .eq("business_id", aliceBusinessId);
    expect(updateError).not.toBeNull();
    expect((await subscriptionOf(aliceBusinessId)).plan).toBe("trial");

    const { data: events } = await alice.client.from("stripe_events").select();
    expect(events ?? []).toHaveLength(0);
  });

  it("use the same email limits as the app", async () => {
    for (const plan of Object.keys(PLANS) as PlanTier[]) {
      const { data, error } = await admin().rpc("plan_monthly_email_limit", {
        p_plan: plan,
      });
      expect(error).toBeNull();
      expect(data).toBe(PLANS[plan].monthlyEmails);
    }
  });

  it("note when a payment starts failing", async () => {
    await setSubscription(aliceBusinessId, { status: "past_due" });
    const failing = await subscriptionOf(aliceBusinessId);
    expect(failing.past_due_since).not.toBeNull();

    await setSubscription(aliceBusinessId, { status: "active" });
    expect((await subscriptionOf(aliceBusinessId)).past_due_since).toBeNull();
  });
});

describe("dispatcher and plans", () => {
  it("pauses reminders when the trial ends and resumes after paying", async () => {
    await setSubscription(aliceBusinessId, {
      trial_ends_at: new Date(Date.now() - HOUR).toISOString(),
    });
    const jobId = await dueJob();
    expect(await dispatch()).toHaveLength(0);
    expect((await jobState(jobId)).status).toBe("pending");

    await setSubscription(aliceBusinessId, { plan: "basic", status: "active" });
    expect(await dispatch()).toHaveLength(1);
    expect((await jobState(jobId)).status).toBe("sent");
  });

  it("keeps sending for 7 days after a failed payment, then pauses", async () => {
    await setSubscription(aliceBusinessId, { plan: "pro", status: "past_due" });
    const first = await dueJob();
    expect(await dispatch()).toHaveLength(1);
    expect((await jobState(first)).status).toBe("sent");

    await setSubscription(aliceBusinessId, {
      past_due_since: new Date(Date.now() - 8 * DAY).toISOString(),
    });
    const second = await dueJob();
    expect(await dispatch()).toHaveLength(0);
    expect((await jobState(second)).status).toBe("pending");
  });

  it("skips reminders once the monthly limit is reached", async () => {
    await setSubscription(aliceBusinessId, { plan: "basic", status: "active" });
    const { error } = await admin().from("usage_counters").insert({
      business_id: aliceBusinessId,
      period_start: monthStart(),
      emails_sent: PLANS.basic.monthlyEmails,
    });
    if (error) throw error;

    const jobId = await dueJob();
    expect(await dispatch()).toHaveLength(0);
    expect(await jobState(jobId)).toEqual({
      status: "skipped",
      skip_reason: "quota_exceeded",
    });
  });
});

describe("Stripe webhook sync", () => {
  it("finds the business by customer and copies the plan", async () => {
    await setSubscription(aliceBusinessId, { stripe_customer_id: "cus_alice" });
    const result = await applyStripeSubscription(
      admin(),
      stripeSubscription(),
      prices,
    );
    expect(result).toBe("updated");
    expect(await subscriptionOf(aliceBusinessId)).toMatchObject({
      plan: "pro",
      status: "active",
      stripe_subscription_id: "sub_alice_1",
      stripe_price_id: "price_pro",
      trial_ends_at: null,
    });
  });

  it("does not let an old subscription ending undo the current one", async () => {
    await setSubscription(aliceBusinessId, {
      stripe_customer_id: "cus_alice",
      stripe_subscription_id: "sub_alice_2",
      plan: "business",
      status: "active",
    });
    const result = await applyStripeSubscription(
      admin(),
      stripeSubscription({ id: "sub_alice_1", status: "canceled" }),
      prices,
    );
    expect(result).toBe("ignored");
    expect((await subscriptionOf(aliceBusinessId)).status).toBe("active");
  });

  it("ignores checkouts that were never paid and unknown customers", async () => {
    await setSubscription(aliceBusinessId, { stripe_customer_id: "cus_alice" });
    expect(
      await applyStripeSubscription(
        admin(),
        stripeSubscription({ status: "incomplete_expired" }),
        prices,
      ),
    ).toBe("ignored");
    expect(
      await applyStripeSubscription(
        admin(),
        stripeSubscription({ customer: "cus_nobody", metadata: {} }),
        prices,
      ),
    ).toBe("unknown_customer");
    expect((await subscriptionOf(aliceBusinessId)).status).toBe("trialing");
  });
});
