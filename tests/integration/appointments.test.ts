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
let aliceClientId: string;
let bobClientId: string;

const HOUR = 60 * 60 * 1000;
const inHours = (hours: number) =>
  new Date(Date.now() + hours * HOUR).toISOString();

async function createBusiness(user: TestUser, name: string) {
  const { data, error } = await user.client.rpc("create_business", {
    p_name: name,
    p_timezone: "America/New_York",
  });
  if (error) throw error;
  return data as string;
}

async function addClient(user: TestUser, businessId: string, name: string) {
  const { data, error } = await user.client
    .from("clients")
    .insert({ business_id: businessId, first_name: name })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function addAppointment(
  user: TestUser,
  businessId: string,
  clientId: string,
  fields: Record<string, unknown> = {},
) {
  const { data, error } = await user.client
    .from("appointments")
    .insert({
      business_id: businessId,
      client_id: clientId,
      title: "Haircut",
      starts_at: inHours(24),
      ends_at: inHours(25),
      ...fields,
    })
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
  aliceClientId = await addClient(alice, aliceBusinessId, "Maria");
  bobClientId = await addClient(bob, bobBusinessId, "Pedro");
});

afterAll(async () => {
  await deleteTestUser(alice);
  await deleteTestUser(bob);
});

describe("appointments", () => {
  it("members can book, read and reschedule appointments", async () => {
    const id = await addAppointment(alice, aliceBusinessId, aliceClientId, {
      location: "Chair 2",
    });

    const { data: created } = await alice.client
      .from("appointments")
      .select("status, created_by, client:clients (first_name)")
      .eq("id", id)
      .single();
    expect(created).toEqual({
      status: "scheduled",
      created_by: alice.id,
      client: { first_name: "Maria" },
    });

    const startsAt = inHours(48);
    const endsAt = inHours(49.5);
    const { error } = await alice.client
      .from("appointments")
      .update({ starts_at: startsAt, ends_at: endsAt, status: "cancelled" })
      .eq("id", id);
    expect(error).toBeNull();

    const { data } = await alice.client
      .from("appointments")
      .select("starts_at, ends_at, status")
      .eq("id", id)
      .single();
    expect(new Date(data!.starts_at).toISOString()).toBe(startsAt);
    expect(new Date(data!.ends_at).toISOString()).toBe(endsAt);
    expect(data!.status).toBe("cancelled");
  });

  it("rejects invalid data at the database level", async () => {
    for (const fields of [
      { title: " " },
      { title: "x".repeat(121) },
      { ends_at: inHours(23) },
      { ends_at: inHours(24) },
      { ends_at: inHours(49) },
      { status: "teleported" },
    ]) {
      const { error } = await alice.client.from("appointments").insert({
        business_id: aliceBusinessId,
        client_id: aliceClientId,
        title: "Haircut",
        starts_at: inHours(24),
        ends_at: inHours(25),
        ...fields,
      });
      expect(error, JSON.stringify(fields)).not.toBeNull();
    }
  });

  it("does not let the app choose the creator or the initial status", async () => {
    for (const fields of [{ created_by: bob.id }, { status: "completed" }]) {
      const { error } = await alice.client.from("appointments").insert({
        business_id: aliceBusinessId,
        client_id: aliceClientId,
        title: "Haircut",
        starts_at: inHours(24),
        ends_at: inHours(25),
        ...fields,
      });
      expect(error, JSON.stringify(fields)).not.toBeNull();
    }
  });

  it("cannot be hard-deleted or moved to another business", async () => {
    const id = await addAppointment(alice, aliceBusinessId, aliceClientId);

    await alice.client.from("appointments").delete().eq("id", id);
    const { error: moveError } = await alice.client
      .from("appointments")
      .update({ business_id: bobBusinessId })
      .eq("id", id);
    expect(moveError).not.toBeNull();

    const { data } = await adminClient()
      .from("appointments")
      .select("business_id")
      .eq("id", id)
      .single();
    expect(data?.business_id).toBe(aliceBusinessId);
  });

  it("cannot be booked for a removed client", async () => {
    const clientId = await addClient(alice, aliceBusinessId, "Gone");
    await alice.client
      .from("clients")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", clientId);

    const { error } = await alice.client.from("appointments").insert({
      business_id: aliceBusinessId,
      client_id: clientId,
      title: "Haircut",
      starts_at: inHours(24),
      ends_at: inHours(25),
    });
    expect(error?.code).toBe("23503");
  });

  it("cancels a removed client's upcoming appointments and keeps the rest", async () => {
    const clientId = await addClient(alice, aliceBusinessId, "Leaving");
    const upcoming = await addAppointment(alice, aliceBusinessId, clientId);
    const past = await addAppointment(alice, aliceBusinessId, clientId, {
      starts_at: inHours(-48),
      ends_at: inHours(-47),
    });
    await alice.client
      .from("appointments")
      .update({ status: "completed" })
      .eq("id", past);

    await alice.client
      .from("clients")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", clientId);

    const { data } = await alice.client
      .from("appointments")
      .select("id, status")
      .eq("client_id", clientId);
    expect(
      Object.fromEntries(data!.map((row) => [row.id, row.status])),
    ).toEqual({ [upcoming]: "cancelled", [past]: "completed" });

    // Their existing appointments can still be edited.
    const { error } = await alice.client
      .from("appointments")
      .update({ client_id: clientId, notes: "Moved away" })
      .eq("id", past);
    expect(error).toBeNull();
  });
});

describe("appointment tenant isolation", () => {
  let aliceAppointmentId: string;

  beforeAll(async () => {
    aliceAppointmentId = await addAppointment(
      alice,
      aliceBusinessId,
      aliceClientId,
      { title: "Private" },
    );
  });

  it("hides appointments from other businesses", async () => {
    const { data } = await bob.client
      .from("appointments")
      .select("id")
      .eq("id", aliceAppointmentId);
    expect(data).toEqual([]);
  });

  it("prevents booking into another business", async () => {
    const { error } = await bob.client.from("appointments").insert({
      business_id: aliceBusinessId,
      client_id: aliceClientId,
      title: "Intruder",
      starts_at: inHours(24),
      ends_at: inHours(25),
    });
    expect(error).not.toBeNull();
  });

  it("prevents booking another business's client", async () => {
    const { error } = await alice.client.from("appointments").insert({
      business_id: aliceBusinessId,
      client_id: bobClientId,
      title: "Cross",
      starts_at: inHours(24),
      ends_at: inHours(25),
    });
    expect(error).not.toBeNull();

    const { error: updateError } = await alice.client
      .from("appointments")
      .update({ client_id: bobClientId })
      .eq("id", aliceAppointmentId);
    expect(updateError).not.toBeNull();
  });

  it("prevents updating another business's appointments", async () => {
    await bob.client
      .from("appointments")
      .update({ title: "Hijacked", deleted_at: new Date().toISOString() })
      .eq("id", aliceAppointmentId);

    const { data } = await adminClient()
      .from("appointments")
      .select("title, deleted_at")
      .eq("id", aliceAppointmentId)
      .single();
    expect(data).toEqual({ title: "Private", deleted_at: null });
  });

  it("gives anonymous visitors no access", async () => {
    const { data } = await anonClient().from("appointments").select("id");
    expect(data ?? []).toEqual([]);
    const { error } = await anonClient()
      .from("appointments")
      .insert({
        business_id: aliceBusinessId,
        client_id: aliceClientId,
        title: "Anon",
        starts_at: inHours(24),
        ends_at: inHours(25),
      });
    expect(error).not.toBeNull();
  });
});
