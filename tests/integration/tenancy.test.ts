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

beforeAll(async () => {
  alice = await createTestUser("Alice Owner");
  bob = await createTestUser("Bob Stranger");

  const { data, error } = await alice.client.rpc("create_business", {
    p_name: "Alice Barbershop",
    p_timezone: "America/Chicago",
  });
  if (error) throw error;
  aliceBusinessId = data as string;
});

afterAll(async () => {
  await deleteTestUser(alice);
  await deleteTestUser(bob);
});

describe("profiles", () => {
  it("are created automatically with the sign-up name", async () => {
    const { data, error } = await alice.client
      .from("profiles")
      .select("user_id, full_name")
      .single();
    expect(error).toBeNull();
    expect(data).toEqual({ user_id: alice.id, full_name: "Alice Owner" });
  });

  it("are not visible to other users", async () => {
    const { data } = await bob.client
      .from("profiles")
      .select("user_id")
      .eq("user_id", alice.id);
    expect(data).toEqual([]);
  });
});

describe("create_business", () => {
  it("creates the business with the caller as owner", async () => {
    const { data: business } = await alice.client
      .from("businesses")
      .select("id, name, timezone, created_by")
      .single();
    expect(business).toEqual({
      id: aliceBusinessId,
      name: "Alice Barbershop",
      timezone: "America/Chicago",
      created_by: alice.id,
    });

    const { data: members } = await alice.client
      .from("business_members")
      .select("user_id, role");
    expect(members).toEqual([{ user_id: alice.id, role: "owner" }]);
  });

  it("allows only one owned business per user", async () => {
    const { error } = await alice.client.rpc("create_business", {
      p_name: "Second Shop",
      p_timezone: "America/Chicago",
    });
    expect(error?.message).toMatch(/already own a business/);
  });

  it("rejects an invalid time zone", async () => {
    const { error } = await bob.client.rpc("create_business", {
      p_name: "Bad Zone",
      p_timezone: "Mars/Olympus_Mons",
    });
    expect(error?.message).toMatch(/Invalid time zone/);
  });

  it("rejects names that are too short", async () => {
    const { error } = await bob.client.rpc("create_business", {
      p_name: " x ",
      p_timezone: "America/New_York",
    });
    expect(error).not.toBeNull();
  });

  it("is not callable without signing in", async () => {
    const { error } = await anonClient().rpc("create_business", {
      p_name: "Anonymous Shop",
      p_timezone: "America/New_York",
    });
    expect(error).not.toBeNull();
  });
});

describe("tenant isolation", () => {
  it("hides another business from a non-member", async () => {
    const { data } = await bob.client
      .from("businesses")
      .select("id")
      .eq("id", aliceBusinessId);
    expect(data).toEqual([]);

    const { data: members } = await bob.client
      .from("business_members")
      .select("user_id")
      .eq("business_id", aliceBusinessId);
    expect(members).toEqual([]);
  });

  it("prevents a non-member from updating another business", async () => {
    await bob.client
      .from("businesses")
      .update({ name: "Hijacked" })
      .eq("id", aliceBusinessId);

    const { data } = await adminClient()
      .from("businesses")
      .select("name")
      .eq("id", aliceBusinessId)
      .single();
    expect(data?.name).toBe("Alice Barbershop");
  });

  it("prevents inserting businesses or memberships directly", async () => {
    const { error: businessError } = await bob.client
      .from("businesses")
      .insert({ name: "Direct", timezone: "UTC", created_by: bob.id });
    expect(businessError).not.toBeNull();

    const { error: memberError } = await bob.client
      .from("business_members")
      .insert({ business_id: aliceBusinessId, user_id: bob.id, role: "owner" });
    expect(memberError).not.toBeNull();
  });

  it("prevents changing who created a business", async () => {
    const { error } = await alice.client
      .from("businesses")
      .update({ created_by: bob.id })
      .eq("id", aliceBusinessId);
    expect(error).not.toBeNull();
  });

  it("gives anonymous visitors no access", async () => {
    const anon = anonClient();
    for (const table of ["businesses", "business_members", "profiles"]) {
      const { data, error } = await anon.from(table).select("*");
      expect(error ?? data).toSatisfy(
        (result: unknown) =>
          result instanceof Object &&
          (!Array.isArray(result) || result.length === 0),
      );
    }
  });

  it("lets the owner update their business", async () => {
    const { error } = await alice.client
      .from("businesses")
      .update({ name: "Alice Barber Co" })
      .eq("id", aliceBusinessId);
    expect(error).toBeNull();

    const { data } = await alice.client
      .from("businesses")
      .select("name")
      .single();
    expect(data?.name).toBe("Alice Barber Co");
  });
});
