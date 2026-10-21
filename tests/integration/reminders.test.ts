import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { runDispatch } from "@/features/reminders/dispatcher";
import type { OutgoingEmail, SendEmail } from "@/features/reminders/resend";
import type { Database } from "@/types/database.types";

import {
  adminClient,
  anonClient,
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "./helpers";

let alice: TestUser;
let bob: TestUser;
let carol: TestUser;
let aliceBusinessId: string;
let bobBusinessId: string;
let aliceRuleId: string;
let consentingClientId: string;

const HOUR = 60 * 60 * 1000;
const inHours = (hours: number) =>
  new Date(Date.now() + hours * HOUR).toISOString();
const admin = () => adminClient() as unknown as SupabaseClient<Database>;

async function createBusiness(user: TestUser, name: string) {
  const { data, error } = await user.client.rpc("create_business", {
    p_name: name,
    p_timezone: "America/Chicago",
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

async function addAppointment(
  user: TestUser,
  businessId: string,
  clientId: string,
  startsInHours: number,
) {
  const { data, error } = await user.client
    .from("appointments")
    .insert({
      business_id: businessId,
      client_id: clientId,
      title: "Haircut",
      starts_at: inHours(startsInHours),
      ends_at: inHours(startsInHours + 1),
      location: "Chair <2>",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

type Job = {
  id: string;
  status: string;
  send_at: string;
  rule_id: string | null;
  skip_reason: string | null;
  attempts: number;
  next_attempt_at: string | null;
  last_error: string | null;
  provider_message_id: string | null;
};

async function jobsOf(appointmentId: string): Promise<Job[]> {
  const { data, error } = await admin()
    .from("reminder_jobs")
    .select(
      "id, status, send_at, rule_id, skip_reason, attempts, next_attempt_at, last_error, provider_message_id",
    )
    .eq("appointment_id", appointmentId)
    .order("send_at");
  if (error) throw error;
  return data;
}

/** Makes a job due right now, as if its send time had arrived. */
async function makeDue(jobId: string) {
  const { error } = await admin()
    .from("reminder_jobs")
    .update({ next_attempt_at: new Date(Date.now() - 1000).toISOString() })
    .eq("id", jobId);
  if (error) throw error;
}

/** Jobs other tests made due must not leak into the next test. */
async function drainQueue() {
  await admin()
    .from("reminder_jobs")
    .update({ status: "cancelled", next_attempt_at: null })
    .in("status", ["pending", "failed", "processing"])
    .lte("next_attempt_at", new Date().toISOString());
}

function fakeSender(result: Awaited<ReturnType<SendEmail>>) {
  const sent: OutgoingEmail[] = [];
  const send: SendEmail = async (email) => {
    sent.push(email);
    return result;
  };
  return { sent, send };
}

beforeAll(async () => {
  alice = await createTestUser("Alice Owner");
  bob = await createTestUser("Bob Owner");
  carol = await createTestUser("Carol Staff");
  aliceBusinessId = await createBusiness(alice, "Alice Barbershop");
  bobBusinessId = await createBusiness(bob, "Bob Salon");

  const { error: memberError } = await adminClient()
    .from("business_members")
    .insert({ business_id: aliceBusinessId, user_id: carol.id, role: "staff" });
  if (memberError) throw memberError;

  const { error: addressError } = await alice.client
    .from("businesses")
    .update({
      postal_address: "100 Main St, Austin, TX 78701",
      contact_email: "owner@example.com",
    })
    .eq("id", aliceBusinessId);
  if (addressError) throw addressError;

  const { data: rule, error: ruleError } = await alice.client
    .from("reminder_rules")
    .select("id")
    .eq("business_id", aliceBusinessId)
    .single();
  if (ruleError) throw ruleError;
  aliceRuleId = rule.id;

  consentingClientId = await addClient(alice, aliceBusinessId, {
    email: `maria-${Date.now()}@example.com`,
    email_reminders_consent: true,
  });
});

beforeEach(drainQueue);

afterAll(async () => {
  await deleteTestUser(alice);
  await deleteTestUser(bob);
  await deleteTestUser(carol);
});

describe("reminder rules", () => {
  it("gives every new business a 24-hour email reminder", async () => {
    const { data, error } = await bob.client
      .from("reminder_rules")
      .select("offset_minutes, is_active, channel")
      .eq("business_id", bobBusinessId);
    expect(error).toBeNull();
    expect(data).toEqual([
      { offset_minutes: 1440, is_active: true, channel: "email" },
    ]);
  });

  it("keeps rules within 15 minutes and 14 days, one per time", async () => {
    for (const offset of [5, 20161]) {
      const { error } = await alice.client
        .from("reminder_rules")
        .insert({ business_id: aliceBusinessId, offset_minutes: offset });
      expect(error?.code).toBe("23514");
    }
    const { error } = await alice.client
      .from("reminder_rules")
      .insert({ business_id: aliceBusinessId, offset_minutes: 1440 });
    expect(error?.code).toBe("23505");
  });

  it("lets staff read rules but not change them", async () => {
    const { data } = await carol.client
      .from("reminder_rules")
      .select("id")
      .eq("business_id", aliceBusinessId);
    expect(data).toHaveLength(1);

    const { error } = await carol.client
      .from("reminder_rules")
      .insert({ business_id: aliceBusinessId, offset_minutes: 60 });
    expect(error).not.toBeNull();

    const { data: updated } = await carol.client
      .from("reminder_rules")
      .update({ is_active: false })
      .eq("id", aliceRuleId)
      .select("id");
    expect(updated ?? []).toHaveLength(0);
  });

  it("keeps each business's reminders private", async () => {
    const appointmentId = await addAppointment(
      alice,
      aliceBusinessId,
      consentingClientId,
      72,
    );
    for (const table of [
      "reminder_rules",
      "message_templates",
      "reminder_jobs",
      "notification_events",
    ] as const) {
      const { data } = await bob.client
        .from(table)
        .select("business_id")
        .eq("business_id", aliceBusinessId);
      expect(data ?? []).toHaveLength(0);
      const { data: anonData } = await anonClient().from(table).select("*");
      expect(anonData ?? []).toHaveLength(0);
    }
    const { data: own } = await alice.client
      .from("reminder_jobs")
      .select("id")
      .eq("appointment_id", appointmentId);
    expect(own).toHaveLength(1);
  });
});

describe("reminder jobs follow appointments", () => {
  it("schedules a job 24 hours before a new appointment", async () => {
    const appointmentId = await addAppointment(
      alice,
      aliceBusinessId,
      consentingClientId,
      48,
    );
    const [job] = await jobsOf(appointmentId);
    expect(job?.status).toBe("pending");
    const { data: appointment } = await alice.client
      .from("appointments")
      .select("starts_at")
      .eq("id", appointmentId)
      .single();
    expect(new Date(job!.send_at).getTime()).toBe(
      new Date(appointment!.starts_at).getTime() - 24 * HOUR,
    );

    const { data: events } = await alice.client
      .from("notification_events")
      .select("event")
      .eq("job_id", job!.id);
    expect(events).toEqual([{ event: "queued" }]);
  });

  it("skips a reminder whose time already passed", async () => {
    const appointmentId = await addAppointment(
      alice,
      aliceBusinessId,
      consentingClientId,
      2,
    );
    const [job] = await jobsOf(appointmentId);
    expect(job).toMatchObject({ status: "skipped", skip_reason: "too_late" });
  });

  it("reschedules, cancels and brings back jobs with the appointment", async () => {
    const appointmentId = await addAppointment(
      alice,
      aliceBusinessId,
      consentingClientId,
      48,
    );
    const newStart = inHours(96);
    await alice.client
      .from("appointments")
      .update({ starts_at: newStart, ends_at: inHours(97) })
      .eq("id", appointmentId);
    let [job] = await jobsOf(appointmentId);
    expect(job?.status).toBe("pending");
    expect(new Date(job!.send_at).getTime()).toBe(
      new Date(newStart).getTime() - 24 * HOUR,
    );

    await alice.client
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", appointmentId);
    [job] = await jobsOf(appointmentId);
    expect(job?.status).toBe("cancelled");

    await alice.client
      .from("appointments")
      .update({ status: "scheduled" })
      .eq("id", appointmentId);
    [job] = await jobsOf(appointmentId);
    expect(job?.status).toBe("pending");

    await alice.client
      .from("appointments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", appointmentId);
    [job] = await jobsOf(appointmentId);
    expect(job?.status).toBe("cancelled");
  });

  it("adds, pauses and deletes reminders for upcoming appointments", async () => {
    const appointmentId = await addAppointment(
      alice,
      aliceBusinessId,
      consentingClientId,
      30,
    );
    const { data: rule, error } = await alice.client
      .from("reminder_rules")
      .insert({ business_id: aliceBusinessId, offset_minutes: 120 })
      .select("id")
      .single();
    expect(error).toBeNull();
    let jobs = await jobsOf(appointmentId);
    expect(jobs.map((job) => job.status)).toEqual(["pending", "pending"]);

    await alice.client
      .from("reminder_rules")
      .update({ is_active: false })
      .eq("id", rule!.id);
    jobs = await jobsOf(appointmentId);
    expect(jobs.find((job) => job.rule_id === rule!.id)?.status).toBe(
      "cancelled",
    );

    await alice.client
      .from("reminder_rules")
      .update({ is_active: true })
      .eq("id", rule!.id);
    jobs = await jobsOf(appointmentId);
    expect(jobs.find((job) => job.rule_id === rule!.id)?.status).toBe(
      "pending",
    );

    await alice.client.from("reminder_rules").delete().eq("id", rule!.id);
    jobs = await jobsOf(appointmentId);
    // The job stays in the history, cancelled and without its rule.
    expect(jobs.map((job) => [job.status, job.rule_id])).toEqual([
      ["pending", aliceRuleId],
      ["cancelled", null],
    ]);
  });

  it("does not let members write jobs or run the dispatcher", async () => {
    const { error: insertError } = await alice.client
      .from("reminder_jobs")
      .insert({
        business_id: aliceBusinessId,
        appointment_id: "00000000-0000-0000-0000-000000000000",
        channel: "email",
        offset_minutes: 60,
        send_at: inHours(1),
      });
    expect(insertError).not.toBeNull();

    for (const fn of ["claim_due_reminder_jobs", "get_dispatch_secret"]) {
      const { error } = await alice.client.rpc(fn);
      expect(error, fn).not.toBeNull();
    }
  });
});

describe("dispatcher", () => {
  it("sends a due reminder once and records it", async () => {
    const appointmentId = await addAppointment(
      alice,
      aliceBusinessId,
      consentingClientId,
      30,
    );
    const [job] = await jobsOf(appointmentId);
    await makeDue(job!.id);

    const { sent, send } = fakeSender({ ok: true, id: "email_123" });
    const [first, second] = await Promise.all([
      runDispatch({
        db: admin(),
        send,
        appUrl: "https://app.example.com",
        fromAddress: "reminders@example.com",
      }),
      runDispatch({
        db: admin(),
        send,
        appUrl: "https://app.example.com",
        fromAddress: "reminders@example.com",
      }),
    ]);
    // Two runs at the same time: the job went to exactly one of them.
    expect(first.sent + second.sent).toBe(1);
    expect(sent).toHaveLength(1);

    const email = sent[0]!;
    expect(email.to).toMatch(/^maria-.*@example\.com$/);
    expect(email.from).toBe('"Alice Barbershop" <reminders@example.com>');
    expect(email.replyTo).toBe("owner@example.com");
    expect(email.subject).toMatch(/^Reminder: Haircut on /);
    expect(email.html).toContain("Chair &lt;2&gt;");
    expect(email.text).toContain("100 Main St, Austin, TX 78701");
    expect(email.text).toMatch(
      /https:\/\/app\.example\.com\/unsubscribe\?token=[0-9a-f-]{36}/,
    );
    expect(email.headers?.["List-Unsubscribe"]).toMatch(
      /^<https:\/\/app\.example\.com\/api\/unsubscribe\?token=/,
    );
    expect(email.idempotencyKey).toContain(job!.id);

    const [after] = await jobsOf(appointmentId);
    expect(after).toMatchObject({
      status: "sent",
      provider_message_id: "email_123",
      attempts: 1,
    });

    const { data: usage } = await alice.client
      .from("usage_counters")
      .select("emails_sent")
      .eq("business_id", aliceBusinessId)
      .single();
    expect(usage?.emails_sent).toBeGreaterThanOrEqual(1);
  });

  it("retries temporary failures with backoff, then gives up", async () => {
    const appointmentId = await addAppointment(
      alice,
      aliceBusinessId,
      consentingClientId,
      30,
    );
    const [job] = await jobsOf(appointmentId);
    const { send } = fakeSender({
      ok: false,
      error: "Resend responded 503",
      permanent: false,
    });

    const expectedDelays = [1, 5, 30, 120];
    for (const minutes of expectedDelays) {
      await makeDue(job!.id);
      const before = Date.now();
      await runDispatch({
        db: admin(),
        send,
        appUrl: "https://app.example.com",
        fromAddress: "reminders@example.com",
      });
      const [after] = await jobsOf(appointmentId);
      expect(after?.status).toBe("failed");
      const delay = new Date(after!.next_attempt_at!).getTime() - before;
      expect(delay).toBeGreaterThan((minutes - 0.5) * 60_000);
      expect(delay).toBeLessThan((minutes + 0.5) * 60_000);
    }

    await makeDue(job!.id);
    await runDispatch({
      db: admin(),
      send,
      appUrl: "https://app.example.com",
      fromAddress: "reminders@example.com",
    });
    const [final] = await jobsOf(appointmentId);
    expect(final).toMatchObject({
      status: "failed",
      attempts: 5,
      next_attempt_at: null,
      last_error: "Resend responded 503",
    });
  });

  it("stops at once on a permanent failure", async () => {
    const appointmentId = await addAppointment(
      alice,
      aliceBusinessId,
      consentingClientId,
      30,
    );
    const [job] = await jobsOf(appointmentId);
    await makeDue(job!.id);
    const { send } = fakeSender({
      ok: false,
      error: "Resend responded 422: Invalid `to` field",
      permanent: true,
    });
    await runDispatch({
      db: admin(),
      send,
      appUrl: "https://app.example.com",
      fromAddress: "reminders@example.com",
    });
    const [after] = await jobsOf(appointmentId);
    expect(after).toMatchObject({ status: "failed", next_attempt_at: null });
  });

  it("skips clients without consent and says why", async () => {
    const clientId = await addClient(alice, aliceBusinessId, {
      email: `no-consent-${Date.now()}@example.com`,
    });
    const appointmentId = await addAppointment(
      alice,
      aliceBusinessId,
      clientId,
      30,
    );
    const [job] = await jobsOf(appointmentId);
    await makeDue(job!.id);
    const { sent, send } = fakeSender({ ok: true, id: "never" });
    await runDispatch({
      db: admin(),
      send,
      appUrl: "https://app.example.com",
      fromAddress: "reminders@example.com",
    });
    expect(sent).toHaveLength(0);
    const [after] = await jobsOf(appointmentId);
    expect(after).toMatchObject({
      status: "skipped",
      skip_reason: "no_consent",
    });
  });

  it("skips businesses without a mailing address", async () => {
    const clientId = await addClient(bob, bobBusinessId, {
      email: `pedro-${Date.now()}@example.com`,
      email_reminders_consent: true,
    });
    const appointmentId = await addAppointment(
      bob,
      bobBusinessId,
      clientId,
      30,
    );
    const [job] = await jobsOf(appointmentId);
    await makeDue(job!.id);
    const { sent, send } = fakeSender({ ok: true, id: "never" });
    await runDispatch({
      db: admin(),
      send,
      appUrl: "https://app.example.com",
      fromAddress: "reminders@example.com",
    });
    expect(sent).toHaveLength(0);
    const [after] = await jobsOf(appointmentId);
    expect(after?.skip_reason).toBe("missing_postal_address");
  });

  it("puts back jobs left behind by a run that crashed", async () => {
    const appointmentId = await addAppointment(
      alice,
      aliceBusinessId,
      consentingClientId,
      30,
    );
    const [job] = await jobsOf(appointmentId);
    await admin()
      .from("reminder_jobs")
      .update({
        status: "processing",
        locked_at: new Date(Date.now() - 11 * 60_000).toISOString(),
      })
      .eq("id", job!.id);

    const { sent, send } = fakeSender({ ok: true, id: "email_recovered" });
    await runDispatch({
      db: admin(),
      send,
      appUrl: "https://app.example.com",
      fromAddress: "reminders@example.com",
    });
    expect(sent).toHaveLength(1);
    const [after] = await jobsOf(appointmentId);
    expect(after?.status).toBe("sent");
  });
});

describe("delivery events and unsubscribing", () => {
  it("blocks an address after a hard bounce", async () => {
    const email = `bounce-${Date.now()}@example.com`;
    const clientId = await addClient(alice, aliceBusinessId, {
      email,
      email_reminders_consent: true,
    });
    const first = await addAppointment(alice, aliceBusinessId, clientId, 30);
    const [job] = await jobsOf(first);
    await makeDue(job!.id);
    const { send } = fakeSender({ ok: true, id: `email_${clientId}` });
    await runDispatch({
      db: admin(),
      send,
      appUrl: "https://app.example.com",
      fromAddress: "reminders@example.com",
    });

    const record = (eventId: string) =>
      admin().rpc("record_email_event", {
        p_provider_message_id: `email_${clientId}`,
        p_event: "bounced",
        p_provider_event_id: eventId,
        p_detail: { bounce_type: "Permanent" },
        p_permanent_bounce: true,
      });
    const { data: known, error } = await record(`evt_${clientId}`);
    expect(error).toBeNull();
    expect(known).toBe(true);
    // The same webhook delivered twice is recorded once.
    await record(`evt_${clientId}`);
    const { data: events } = await alice.client
      .from("notification_events")
      .select("event")
      .eq("job_id", job!.id)
      .eq("event", "bounced");
    expect(events).toHaveLength(1);

    const second = await addAppointment(alice, aliceBusinessId, clientId, 50);
    const [nextJob] = await jobsOf(second);
    await makeDue(nextJob!.id);
    const blocked = fakeSender({ ok: true, id: "never" });
    await runDispatch({
      db: admin(),
      send: blocked.send,
      appUrl: "https://app.example.com",
      fromAddress: "reminders@example.com",
    });
    expect(blocked.sent).toHaveLength(0);
    const [after] = await jobsOf(second);
    expect(after?.skip_reason).toBe("suppressed");
  });

  it("ignores events for unknown emails", async () => {
    const { data } = await admin().rpc("record_email_event", {
      p_provider_message_id: "email_unknown",
      p_event: "delivered",
      p_provider_event_id: `evt_unknown_${Date.now()}`,
    });
    expect(data).toBe(false);
  });

  it("lets a client unsubscribe with the link and records it", async () => {
    const clientId = await addClient(alice, aliceBusinessId, {
      email: `leaving-${Date.now()}@example.com`,
      email_reminders_consent: true,
    });
    const { data: client } = await admin()
      .from("clients")
      .select("unsubscribe_token")
      .eq("id", clientId)
      .single();
    const token = client!.unsubscribe_token;

    // Only the app's server (service role) may call these, after its rate limit.
    const anon = anonClient();
    const { error: anonInfoError } = await anon.rpc("get_unsubscribe_info", {
      p_token: token,
    });
    expect(anonInfoError).not.toBeNull();
    const { error: anonUnsubscribeError } = await anon.rpc(
      "unsubscribe_by_token",
      { p_token: token },
    );
    expect(anonUnsubscribeError).not.toBeNull();

    const server = admin();
    const { data: info } = await server
      .rpc("get_unsubscribe_info", { p_token: token })
      .single();
    expect(info).toEqual({
      business_name: "Alice Barbershop",
      subscribed: true,
    });

    const { data: businessName, error } = await server.rpc(
      "unsubscribe_by_token",
      { p_token: token, p_ip_address: "203.0.113.7", p_user_agent: "Test" },
    );
    expect(error).toBeNull();
    expect(businessName).toBe("Alice Barbershop");

    const { data: after } = await alice.client
      .from("clients")
      .select("email_reminders_consent")
      .eq("id", clientId)
      .single();
    expect(after?.email_reminders_consent).toBe(false);

    const { data: trail } = await alice.client
      .from("consent_events")
      .select("action, source, ip_address")
      .eq("client_id", clientId)
      .order("created_at");
    expect(trail).toEqual([
      { action: "granted", source: "staff_entry", ip_address: null },
      {
        action: "revoked",
        source: "unsubscribe_link",
        ip_address: "203.0.113.7",
      },
    ]);

    const { data: unknown } = await server.rpc("unsubscribe_by_token", {
      p_token: "00000000-0000-4000-8000-000000000000",
    });
    expect(unknown).toBeNull();
  });

  it("keeps the dispatch secret in the database, for the service role only", async () => {
    const { data } = await admin().rpc("get_dispatch_secret");
    expect(data).toMatch(/^[0-9a-f]{64}$/);
    const { error } = await anonClient().rpc("get_dispatch_secret");
    expect(error).not.toBeNull();
  });
});
