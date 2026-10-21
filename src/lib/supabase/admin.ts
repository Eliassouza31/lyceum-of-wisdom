import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getServerEnv } from "@/lib/server-env";
import type { Database } from "@/types/database.types";

import { getSupabaseConfig } from "./config";

/**
 * Supabase client with the secret key: it bypasses Row Level Security.
 * Use it ONLY in server routes that are not tied to a signed-in user (the
 * reminder dispatcher and the Resend and Stripe webhooks) and in the billing
 * actions after they check the member's role; never in pages.
 * Returns null when SUPABASE_SECRET_KEY is not set.
 */
export function createSupabaseAdminClient() {
  const { SUPABASE_SECRET_KEY } = getServerEnv();
  if (!SUPABASE_SECRET_KEY) return null;
  const { url } = getSupabaseConfig();
  return createClient<Database>(url, SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type SupabaseAdminClient = NonNullable<
  ReturnType<typeof createSupabaseAdminClient>
>;
