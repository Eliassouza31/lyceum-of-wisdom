import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Integration tests run against a local Supabase stack (`npx supabase start`).
 * They never point at a hosted project: the secret key would let them create real users.
 */
export function getTestConfig() {
  const url = process.env.SUPABASE_TEST_URL;
  const publishableKey = process.env.SUPABASE_TEST_PUBLISHABLE_KEY;
  const secretKey = process.env.SUPABASE_TEST_SECRET_KEY;
  if (!url || !publishableKey || !secretKey) {
    throw new Error(
      "Set SUPABASE_TEST_URL, SUPABASE_TEST_PUBLISHABLE_KEY and SUPABASE_TEST_SECRET_KEY (see `npx supabase status`).",
    );
  }
  const host = new URL(url).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(
      `Refusing to run integration tests against non-local Supabase: ${host}`,
    );
  }
  return { url, publishableKey, secretKey };
}

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false },
} as const;

export function adminClient(): SupabaseClient {
  const { url, secretKey } = getTestConfig();
  return createClient(url, secretKey, clientOptions);
}

export function anonClient(): SupabaseClient {
  const { url, publishableKey } = getTestConfig();
  return createClient(url, publishableKey, clientOptions);
}

export type TestUser = {
  id: string;
  email: string;
  client: SupabaseClient;
};

/** Creates a confirmed user through the admin API and returns a client signed in as that user. */
export async function createTestUser(
  fullName = "Test User",
): Promise<TestUser> {
  const email = `test-${randomUUID()}@example.com`;
  const password = `Passw0rd-${randomUUID()}`;
  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) throw error ?? new Error("User not created");

  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) throw signInError;

  return { id: data.user.id, email, client };
}

export async function deleteTestUser(user: TestUser | undefined) {
  if (!user) return;
  const admin = adminClient();
  // Businesses reference their creator, so remove them before the user.
  await admin.from("businesses").delete().eq("created_by", user.id);
  await admin.auth.admin.deleteUser(user.id);
}
