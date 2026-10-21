import { z } from "zod";

// Unset and blank variables both mean "not configured".
const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalSecret = z.preprocess(
  blankToUndefined,
  z.string().trim().optional(),
);

/**
 * Server-only settings. They are read per request (never at build time), and
 * every one is optional so the app still runs before email is set up; the
 * features that need them report what is missing.
 */
const prefixedSecret = (prefixes: string[]) =>
  optionalSecret.refine(
    (value) =>
      value === undefined ||
      prefixes.some((prefix) => value.startsWith(prefix)),
    `must start with ${prefixes.join(" or ")}`,
  );

const serverEnvSchema = z.object({
  SUPABASE_SECRET_KEY: optionalSecret,
  RESEND_API_KEY: optionalSecret,
  RESEND_WEBHOOK_SECRET: optionalSecret.refine(
    (value) => value === undefined || value.startsWith("whsec_"),
    "must start with whsec_",
  ),
  // Must be an address on a domain verified in Resend. Resend's shared test
  // address only delivers to the Resend account owner's own inbox.
  RESEND_FROM_EMAIL: z.preprocess(
    blankToUndefined,
    z.email().default("onboarding@resend.dev"),
  ),
  RESEND_API_URL: z.preprocess(
    blankToUndefined,
    z
      .url({ protocol: /^https?$/ })
      .transform((value) => value.replace(/\/+$/, ""))
      .default("https://api.resend.com"),
  ),
  // Stripe > Developers > API keys. Test keys start with sk_test_.
  STRIPE_SECRET_KEY: prefixedSecret(["sk_", "rk_"]),
  // Stripe > Developers > Webhooks > your endpoint > Signing secret.
  STRIPE_WEBHOOK_SECRET: prefixedSecret(["whsec_"]),
  // Stripe > Product catalog > each plan's monthly price.
  STRIPE_PRICE_BASIC: prefixedSecret(["price_"]),
  STRIPE_PRICE_PRO: prefixedSecret(["price_"]),
  STRIPE_PRICE_BUSINESS: prefixedSecret(["price_"]),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(
  source: Record<string, string | undefined>,
): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid server environment variables: ${issues}`);
  }
  return result.data;
}

export function getServerEnv(): ServerEnv {
  return parseServerEnv(process.env);
}
