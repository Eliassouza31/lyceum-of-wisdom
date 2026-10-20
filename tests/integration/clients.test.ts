import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  adminClient,
  anonClient,
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "./helpers";

let alice: TestUser;
let bob: TestUser;
let aliceBusinessId: string;
let bobBusinessId: string;

async function createBusiness(user: TestUser, name: string) {
  const { data, error } = await user.client.rpc("create_business", {
    p_name: name,
    p_timezone: "America/New_York",
  });
  if (error) throw error;
  return data as string;
}

async function addClient(
  user: TestUser,
  businessId: string,
  fields: Record<string, unknown> = {},
) {
  const { data, error } = await user.client
    .from("clients")
    .insert({ business_id: businessId, first_name: "Maria", ...fields })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

beforeAll(async () => {
  alice = await createTestUser("Alice Owner");
  bob = await createTestUser("Bob Owner");
  aliceBusinessId = await createBusiness(alice, "Alice Barbershop");
  bobBusinessId = await createBusiness(bob, "Bob Salon");
});

afterAll(async () => {
  await deleteTestUser(alice);
  await deleteTestUser(bob);
});

describe("clients", () => {
  it("members can add, read and update their clients", async () => {
    const id = await addClient(alice, aliceBusinessId, {
      last_name: "Lopez",
      email: "maria@example.com",
      phone_e164: "+15552345678",
    });

    const { error } = await alice.client
      .from("clients")
      .update({ notes: "Prefers mornings" })
      .eq("id", id);
    expect(error).toBeNull();

    const { data } = await alice.client
      .from("clients")
      .select("first_name, last_name, email, phone_e164, notes")
      .eq("id", id)
      .single();
    expect(data).toEqual({
      first_name: "Maria",
      last_name: "Lopez",
      email: "maria@example.com",
      phone_e164: "+15552345678",
      notes: "Prefers mornings",
    });
  });

  it("rejects invalid data at the database level", async () => {
    for (const fields of [
      { first_name: " " },
      { email: "Upper@Example.com" },
      { email: "not-an-email" },
      { phone_e164: "555-234-5678" },
      { email_reminders_consent: true },
    ]) {
      const { error } = await alice.client
        .from("clients")
        .insert({ business_id: aliceBusinessId, first_name: "X", ...fields });
      expect(error, JSON.stringify(fields)).not.toBeNull();
    }
  });

  it("keeps emails unique among active clients only", async () => {
    const id = await addClient(alice, aliceBusinessId, {
      email: "dup@example.com",
    });
    const { error } = await alice.client.from("clients").insert({
      business_id: aliceBusinessId,
      first_name: "Copy",
      email: "dup@example.com",
    });
    expect(error?.code).toBe("23505");

    // Another business can use the same email.
    await addClient(bob, bobBusinessId, { email: "dup@example.com" });

    // After a soft delete the email is free again.
    await alice.client
      .from("clients")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    await addClient(alice, aliceBusinessId, { email: "dup@example.com" });
  });

  it("cannot be hard-deleted or moved to another business", async () => {
    const id = await addClient(alice, aliceBusinessId);

    await alice.client.from("clients").delete().eq("id", id);
    const { error: moveError } = await alice.client
      .from("clients")
      .update({ business_id: bobBusinessId })
      .eq("id", id);
    expect(moveError).not.toBeNull();

    const { data } = await adminClient()
      .from("clients")
      .select("business_id")
      .eq("id", id)
      .single();
    expect(data?.business_id).toBe(aliceBusinessId);
  });

  it("cannot set SMS consent from the app yet", async () => {
    const { error } = await alice.client.from("clients").insert({
      business_id: aliceBusinessId,
      first_name: "Sam",
      phone_e164: "+15552345678",
      sms_reminders_consent: true,
    });
    expect(error).not.toBeNull();
  });
});

describe("client tenant isolation", () => {
  let aliceClientId: string;

  beforeAll(async () => {
    aliceClientId = await addClient(alice, aliceBusinessId, {
      first_name: "Private",
      email: "private@example.com",
      email_reminders_consent: true,
    });
  });

  it("hides clients and consent history from other businesses", async () => {
    const { data: clients } = await bob.client
      .from("clients")
      .select("id")
      .eq("id", aliceClientId);
    expect(clients).toEqual([]);

    const { data: events } = await bob.client
      .from("consent_events")
      .select("id")
      .eq("client_id", aliceClientId);
    expect(events).toEqual([]);
  });

  it("prevents adding clients to another business", async () => {
    const { error } = await bob.client
      .from("clients")
      .insert({ business_id: aliceBusinessId, first_name: "Intruder" });
    expect(error).not.toBeNull();
  });

  it("prevents updating another business's clients", async () => {
    await bob.client
      .from("clients")
      .update({ first_name: "Hijacked", deleted_at: new Date().toISOString() })
      .eq("id", aliceClientId);

    const { data } = await adminClient()
      .from("clients")
      .select("first_name, deleted_at")
      .eq("id", aliceClientId)
      .single();
    expect(data).toEqual({ first_name: "Private", deleted_at: null });
  });

  it("gives anonymous visitors no access", async () => {
    const { data } = await anonClient().from("clients").select("id");
    expect(data ?? []).toEqual([]);
    const { error } = await anonClient()
      .from("clients")
      .insert({ business_id: aliceBusinessId, first_name: "Anon" });
    expect(error).not.toBeNull();
  });
});

describe("consent history", () => {
  it("records every consent change automatically", async () => {
    const id = await addClient(alice, aliceBusinessId, {
      email: "consent@example.com",
      email_reminders_consent: true,
    });
    // Unrelated edits do not create events.
    await alice.client.from("clients").update({ notes: "hi" }).eq("id", id);
    await alice.client
      .from("clients")
      .update({ email_reminders_consent: false })
      .eq("id", id);

    const { data } = await alice.client
      .from("consent_events")
      .select("business_id, channel, action, source, recorded_by")
      .eq("client_id", id)
      .order("created_at", { ascending: true });
    expect(data).toEqual([
      {
        business_id: aliceBusinessId,
        channel: "email",
        action: "granted",
        source: "staff_entry",
        recorded_by: alice.id,
      },
      {
        business_id: aliceBusinessId,
        channel: "email",
        action: "revoked",
        source: "staff_entry",
        recorded_by: alice.id,
      },
    ]);
  });

  it("does not record anything for clients added without consent", async () => {
    const id = await addClient(alice, aliceBusinessId, {
      email: "nope@example.com",
    });
    const { data } = await alice.client
      .from("consent_events")
      .select("id")
      .eq("client_id", id);
    expect(data).toEqual([]);
  });

  it("cannot be written, edited or deleted by users", async () => {
    const id = await addClient(alice, aliceBusinessId, {
      email: "trail@example.com",
      email_reminders_consent: true,
    });

    const { error: insertError } = await alice.client
      .from("consent_events")
      .insert({
        business_id: aliceBusinessId,
        client_id: id,
        channel: "email",
        action: "granted",
        source: "staff_entry",
      });
    expect(insertError).not.toBeNull();

    const { error: updateError } = await alice.client
      .from("consent_events")
      .update({ action: "revoked" })
      .eq("client_id", id);
    expect(updateError).not.toBeNull();

    await alice.client.from("consent_events").delete().eq("client_id", id);
    const { data } = await adminClient()
      .from("consent_events")
      .select("action")
      .eq("client_id", id);
    expect(data).toEqual([{ action: "granted" }]);
  });
});
