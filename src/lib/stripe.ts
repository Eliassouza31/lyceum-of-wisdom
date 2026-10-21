import "server-only";

import Stripe from "stripe";

import { PRODUCT_NAME } from "@/components/brand/logo";
import type { PriceIds } from "@/lib/billing/plans";
import { getServerEnv } from "@/lib/server-env";

export type BillingConfig = {
  stripe: Stripe;
  prices: PriceIds;
  webhookSecret: string | undefined;
};

/** Stripe client and the plan prices, or null while STRIPE_SECRET_KEY is not set. */
export function getBillingConfig(): BillingConfig | null {
  const env = getServerEnv();
  if (!env.STRIPE_SECRET_KEY) return null;
  return {
    stripe: new Stripe(env.STRIPE_SECRET_KEY, {
      appInfo: { name: PRODUCT_NAME },
    }),
    prices: {
      basic: env.STRIPE_PRICE_BASIC,
      pro: env.STRIPE_PRICE_PRO,
      business: env.STRIPE_PRICE_BUSINESS,
    },
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
  };
}
