export type SupabaseConfig = { url: string; publishableKey: string };

/**
 * Reads the public Supabase settings. Returns null when they are missing so the
 * marketing pages keep working before Supabase is configured.
 */
export function readSupabaseConfig(): SupabaseConfig | null {
  // Referenced explicitly so Next.js can inline them in browser bundles.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}

export function getSupabaseConfig(): SupabaseConfig {
  const config = readSupabaseConfig();
  if (!config) {
    throw new Error(
      "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  return config;
}
