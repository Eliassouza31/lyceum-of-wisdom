import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database } from "@/types/database.types";

import { adminClient, anonClient } from "./helpers";

const admin = () => adminClient() as unknown as SupabaseClient<Database>;

async function consume(key: string, max: number, windowSeconds = 60) {
  const { data, error } = await admin().rpc("consume_rate_limit", {
    p_key: key,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  expect(error).toBeNull();
  return data;
}

describe("rate limits", () => {
  it("allows attempts up to the limit, then blocks", async () => {
    const key = `test:${randomUUID()}`;
    expect(await consume(key, 2)).toBe(true);
    expect(await consume(key, 2)).toBe(true);
    expect(await consume(key, 2)).toBe(false);
    expect(await consume(`test:${randomUUID()}`, 2)).toBe(true);
  });

  it("counts parallel attempts exactly", async () => {
    const key = `test:${randomUUID()}`;
    const results = await Promise.all(
      Array.from({ length: 10 }, () => consume(key, 4)),
    );
    expect(results.filter(Boolean)).toHaveLength(4);
  });

  it("starts a new window once the old one has passed", async () => {
    const key = `test:${randomUUID()}`;
    expect(await consume(key, 1)).toBe(true);
    expect(await consume(key, 1)).toBe(false);
    await admin()
      .from("rate_limits")
      .update({
        window_started_at: new Date(Date.now() - 61_000).toISOString(),
      })
      .eq("key", key);
    expect(await consume(key, 1)).toBe(true);
  });

  it("is for the service role only", async () => {
    const anon = anonClient();
    const { error } = await anon.rpc("consume_rate_limit", {
      p_key: "test:anon",
      p_max: 100,
      p_window_seconds: 60,
    });
    expect(error).not.toBeNull();
    const { data } = await anon.from("rate_limits").select("key");
    expect(data ?? []).toEqual([]);
  });
});
