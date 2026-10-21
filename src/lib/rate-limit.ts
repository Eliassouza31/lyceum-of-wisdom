import "server-only";

import { createHash } from "node:crypto";

import { logger } from "@/lib/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type RateLimitRule = { max: number; windowSeconds: number };

/**
 * Attempts allowed per visitor (IP address) or per email address. Supabase
 * Auth has its own limits too; these stop abuse before it reaches Supabase.
 */
export const RATE_LIMITS = {
  "sign-in:ip": { max: 20, windowSeconds: 15 * 60 },
  "sign-in:email": { max: 10, windowSeconds: 15 * 60 },
  "sign-up:ip": { max: 10, windowSeconds: 60 * 60 },
  "password-reset:ip": { max: 10, windowSeconds: 60 * 60 },
  "password-reset:email": { max: 3, windowSeconds: 60 * 60 },
  "unsubscribe:ip": { max: 30, windowSeconds: 10 * 60 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitName = keyof typeof RATE_LIMITS;

export const RATE_LIMITED_MESSAGE =
  "Too many attempts. Please wait a few minutes and try again.";

/** The database key for a counter. IPs and emails are hashed, so they are not stored. */
export function rateLimitKey(name: RateLimitName, value: string): string {
  const digest = createHash("sha256")
    .update(value.trim().toLowerCase())
    .digest("hex")
    .slice(0, 32);
  return `${name}:${digest}`;
}

/**
 * Counts one attempt and returns false once the limit is reached. It lets the
 * request through when the value is unknown (no IP) or the check itself
 * fails, so an outage of the counter never locks everyone out.
 */
export async function consumeRateLimit(
  name: RateLimitName,
  value: string | null | undefined,
): Promise<boolean> {
  if (!value) return true;
  const admin = createSupabaseAdminClient();
  if (!admin) {
    logger.debug("rate_limit.skipped", { name, reason: "no_secret_key" });
    return true;
  }
  const rule = RATE_LIMITS[name];
  const { data, error } = await admin.rpc("consume_rate_limit", {
    p_key: rateLimitKey(name, value),
    p_max: rule.max,
    p_window_seconds: rule.windowSeconds,
  });
  if (error) {
    logger.error("rate_limit.check_failed", { name, message: error.message });
    return true;
  }
  if (data === false) logger.warn("rate_limit.exceeded", { name });
  return data !== false;
}

/** The visitor's IP as reported by Vercel's proxy. */
export function clientIp(headers: Headers): string | null {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
}
