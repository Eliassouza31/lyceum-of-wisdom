import "server-only";

import { z } from "zod";

import { logger } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const tokenSchema = z.uuid();

export function parseUnsubscribeToken(value: unknown): string | null {
  const parsed = tokenSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** The business behind an unsubscribe link, or null when the link is not valid. */
export async function getUnsubscribeInfo(
  token: string,
): Promise<{ businessName: string; subscribed: boolean } | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
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
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("unsubscribe_by_token", {
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

/** The visitor's IP as reported by Vercel's proxy. */
export function clientIp(headers: Headers): string | null {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
}
