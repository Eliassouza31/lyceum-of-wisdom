import type Stripe from "stripe";
import { describe, expect, it } from "vitest";

import { subscriptionUpdateFromStripe } from "@/features/billing/sync";
import {
  billingNotice,
  daysUntil,
  planForPrice,
  PLANS,
  remindersAllowed,
  type SubscriptionState,
} from "@/lib/billing/plans";
import { parseServerEnv } from "@/lib/server-env";
import { monthStartIn } from "@/lib/time";

const NOW = new Date("2026-10-21T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const daysFromNow = (days: number) =>
  new Date(NOW.getTime() + days * DAY).toISOString();

const prices = {
  basic: "price_basic",
  pro: "price_pro",
  business: "price_business",
};

function state(fields: Partial<SubscriptionState>): SubscriptionState {
  return {
    plan: "trial",
    status: "trialing",
    trial_ends_at: daysFromNow(10),
    past_due_since: null,
    current_period_end: null,
    cancel_at_period_end: false,
    ...fields,
  };
}

describe("plans", () => {
  it("sell bigger email limits for higher prices", () => {
    expect(PLANS.basic.monthlyEmails).toBe(1000);
    expect(PLANS.pro.monthlyEmails).toBe(5000);
    expect(PLANS.business.monthlyEmails).toBe(20000);
    expect(PLANS.basic.priceUsd).toBeLessThan(PLANS.pro.priceUsd);
    expect(PLANS.pro.priceUsd).toBeLessThan(PLANS.business.priceUsd);
  });

  it("finds the plan of a Stripe price", () => {
    expect(planForPrice("price_pro", prices)).toBe("pro");
    expect(planForPrice("price_other", prices)).toBeNull();
    expect(planForPrice(null, prices)).toBeNull();
    // An unset price never matches.
    expect(planForPrice("price_pro", { ...prices, pro: undefined })).toBeNull();
  });
});

describe("remindersAllowed", () => {
  it("allows a running trial and stops an expired one", () => {
    expect(remindersAllowed(state({}), NOW)).toBe(true);
    expect(
      remindersAllowed(state({ trial_ends_at: daysFromNow(-1) }), NOW),
    ).toBe(false);
  });

  it("allows active plans and gives failed payments 7 days", () => {
    expect(remindersAllowed(state({ status: "active" }), NOW)).toBe(true);
    expect(
      remindersAllowed(
        state({ status: "past_due", past_due_since: daysFromNow(-6) }),
        NOW,
      ),
    ).toBe(true);
    expect(
      remindersAllowed(
        state({ status: "past_due", past_due_since: daysFromNow(-8) }),
        NOW,
      ),
    ).toBe(false);
  });

  it("stops cancelled and unpaid subscriptions", () => {
    for (const status of ["canceled", "unpaid", "paused", "incomplete"]) {
      expect(remindersAllowed(state({ status }), NOW)).toBe(false);
    }
  });
});

describe("billingNotice", () => {
  it("stays quiet early in the trial and while paying", () => {
    expect(billingNotice(state({}), NOW)).toBeNull();
    expect(billingNotice(state({ status: "active" }), NOW)).toBeNull();
  });

  it("warns when the trial is about to end", () => {
    expect(
      billingNotice(state({ trial_ends_at: daysFromNow(0.5) }), NOW),
    ).toEqual({
      tone: "warning",
      message:
        "Your free trial ends in 1 day. Choose a plan to keep reminders going.",
    });
  });

  it("says when reminders are paused", () => {
    expect(
      billingNotice(state({ trial_ends_at: daysFromNow(-1) }), NOW)?.message,
    ).toMatch(/free trial has ended/);
    expect(
      billingNotice(state({ plan: "pro", status: "canceled" }), NOW)?.tone,
    ).toBe("error");
  });

  it("counts down the grace period after a failed payment", () => {
    expect(
      billingNotice(
        state({ status: "past_due", past_due_since: daysFromNow(-2) }),
        NOW,
      )?.message,
    ).toMatch(/within 5 days/);
  });

  it("rounds days up", () => {
    expect(daysUntil(daysFromNow(2.1), NOW)).toBe(3);
    expect(daysUntil(daysFromNow(-1), NOW)).toBe(0);
  });
});

describe("subscriptionUpdateFromStripe", () => {
  const subscription = {
    id: "sub_123",
    status: "active",
    customer: "cus_123",
    cancel_at_period_end: false,
    trial_end: null,
    metadata: { business_id: "b1" },
    items: {
      data: [
        {
          price: { id: "price_pro" },
          current_period_end: Date.parse("2026-11-21T12:00:00Z") / 1000,
        },
      ],
    },
  } as unknown as Stripe.Subscription;

  it("copies plan, status and dates", () => {
    expect(subscriptionUpdateFromStripe(subscription, prices)).toEqual({
      plan: "pro",
      status: "active",
      stripe_customer_id: "cus_123",
      stripe_subscription_id: "sub_123",
      stripe_price_id: "price_pro",
      trial_ends_at: null,
      current_period_end: "2026-11-21T12:00:00.000Z",
      cancel_at_period_end: false,
    });
  });

  it("keeps the plan when the price is unknown", () => {
    const update = subscriptionUpdateFromStripe(subscription, {
      ...prices,
      pro: "price_new",
    });
    expect(update).not.toHaveProperty("plan");
    expect(update.stripe_price_id).toBe("price_pro");
  });

  it("reads the customer id from an expanded customer", () => {
    const expanded = {
      ...subscription,
      customer: { id: "cus_456" },
    } as unknown as Stripe.Subscription;
    expect(
      subscriptionUpdateFromStripe(expanded, prices).stripe_customer_id,
    ).toBe("cus_456");
  });
});

describe("Stripe settings", () => {
  it("are optional and checked by prefix", () => {
    expect(parseServerEnv({}).STRIPE_SECRET_KEY).toBeUndefined();
    expect(
      parseServerEnv({
        STRIPE_SECRET_KEY: "sk_test_abc",
        STRIPE_WEBHOOK_SECRET: "whsec_abc",
        STRIPE_PRICE_BASIC: "price_abc",
      }),
    ).toMatchObject({
      STRIPE_SECRET_KEY: "sk_test_abc",
      STRIPE_PRICE_BASIC: "price_abc",
    });
    expect(() => parseServerEnv({ STRIPE_SECRET_KEY: "pk_test_abc" })).toThrow(
      /STRIPE_SECRET_KEY/,
    );
    expect(() => parseServerEnv({ STRIPE_PRICE_PRO: "prod_abc" })).toThrow(
      /STRIPE_PRICE_PRO/,
    );
  });
});

describe("monthStartIn", () => {
  it("uses the business's own calendar month", () => {
    // 03:00 UTC on Nov 1 is still Oct 31 in Chicago.
    const date = new Date("2026-11-01T03:00:00Z");
    expect(monthStartIn("America/Chicago", date)).toBe("2026-10-01");
    expect(monthStartIn("UTC", date)).toBe("2026-11-01");
  });
});
