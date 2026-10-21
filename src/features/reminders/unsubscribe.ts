import "server-only";

import { z } from "zod";

import { logger } from "@/lib/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const tokenSchema = z.uuid();

export function parseUnsubscribeToken(value: unknown): string | null {
  const parsed = tokenSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

// The unsubscribe functions are not open to the public database key: only
// this server calls them, after its rate limit (see the security migration).
function adminClient() {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    logger.error("unsubscribe.not_configured", {
      missing: "SUPABASE_SECRET_KEY",
    });
    throw new Error("This page is not available right now. Please try again.");
  }
  return admin;
}

/** The business behind an unsubscribe link, or null when the link is not valid. */
export async function getUnsubscribeInfo(
  token: string,
): Promise<{ businessName: string; subscribed: boolean } | null> {
  const { data, error } = await adminClient()
    .rpc("get_unsubscribe_info", { p_token: token })
    .maybeSingle();
  if (error) {
    logger.error("unsubscribe.lookup_failed", { message: error.message });
    throw new Error("Could not load this page. Please try again.");
  }
  if (!data) return null;
  return { businessName: data.business_name, subscribed: data.subscribed };
}

/** Turns off email reminders for the client behind the token. */
export async function unsubscribe(
  token: string,
  request: { ipAddress: string | null; userAgent: string | null },
): Promise<boolean> {
  const { data, error } = await adminClient().rpc("unsubscribe_by_token", {
    p_token: token,
    p_ip_address: request.ipAddress ?? undefined,
    p_user_agent: request.userAgent ?? undefined,
  });
  if (error) {
    logger.error("unsubscribe.failed", { message: error.message });
    throw new Error("We could not unsubscribe you. Please try again.");
  }
  return data !== null;
}
