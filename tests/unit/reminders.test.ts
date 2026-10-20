import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  composeReminder,
  type ClaimedJob,
} from "@/features/reminders/dispatcher";
import {
  latestDeliveryEvent,
  reminderNote,
  reminderState,
} from "@/features/reminders/format";
import {
  formatOffset,
  splitOffset,
  toOffsetMinutes,
} from "@/features/reminders/offsets";
import {
  createResendSender,
  formatSender,
  isPermanentFailure,
} from "@/features/reminders/resend";
import {
  ruleSchema,
  senderSchema,
  templateSchema,
} from "@/features/reminders/schemas";
import {
  buildReminderEmail,
  DEFAULT_TEMPLATE,
  renderTemplate,
  sampleValues,
  unknownVariables,
} from "@/features/reminders/templates";
import {
  isBearerAuthorized,
  parseEmailEvent,
  verifyWebhookSignature,
} from "@/features/reminders/webhook";
import { parseServerEnv } from "@/lib/server-env";

describe("reminder offsets", () => {
  it("converts and describes offsets in the largest exact unit", () => {
    expect(toOffsetMinutes(2, "hours")).toBe(120);
    expect(toOffsetMinutes(1, "days")).toBe(1440);
    expect(splitOffset(1440)).toEqual({ amount: 1, unit: "days" });
    expect(splitOffset(180)).toEqual({ amount: 3, unit: "hours" });
    expect(splitOffset(90)).toEqual({ amount: 90, unit: "minutes" });
    expect(formatOffset(1440)).toBe("1 day before");
    expect(formatOffset(2880)).toBe("2 days before");
    expect(formatOffset(60)).toBe("1 hour before");
    expect(formatOffset(15)).toBe("15 minutes before");
  });

  it("accepts rules between 15 minutes and 14 days", () => {
    expect(ruleSchema.safeParse({ amount: "24", unit: "hours" }).data).toBe(
      1440,
    );
    expect(ruleSchema.safeParse({ amount: "14", unit: "days" }).success).toBe(
      true,
    );
    for (const input of [
      { amount: "10", unit: "minutes" },
      { amount: "15", unit: "days" },
      { amount: "0", unit: "hours" },
      { amount: "1.5", unit: "hours" },
      { amount: "abc", unit: "hours" },
      { amount: "2", unit: "weeks" },
    ]) {
      expect(ruleSchema.safeParse(input).success, JSON.stringify(input)).toBe(
        false,
      );
    }
  });
});

describe("reminder templates", () => {
  const values = sampleValues("Alice Barbershop");

  it("fills in variables", () => {
    expect(
      renderTemplate(
        "Hi {{client_first_name}}, see you {{ appointment_date }}",
        values,
      ),
    ).toBe("Hi Maria, see you Tuesday, October 20, 2026");
  });

  it("drops lines whose variables are all empty", () => {
    const text = renderTemplate("Hello\n\nLocation: {{location}}\n\nBye", {
      ...values,
      location: "",
    });
    expect(text).toBe("Hello\n\nBye");
  });

  it("finds variables it does not know", () => {
    expect(
      unknownVariables("{{client_first_name}} {{clinet_name}} {{x}}"),
    ).toEqual(["clinet_name", "x"]);
    expect(unknownVariables(DEFAULT_TEMPLATE.body)).toEqual([]);
    expect(unknownVariables(DEFAULT_TEMPLATE.subject)).toEqual([]);
  });

  it("validates templates before saving", () => {
    expect(templateSchema.safeParse(DEFAULT_TEMPLATE).success).toBe(true);
    const typo = templateSchema.safeParse({
      subject: "Hi {{name}}",
      body: "Body",
    });
    expect(typo.error?.issues[0]?.message).toMatch(
      /Unknown variable: \{\{name\}\}/,
    );
    expect(
      templateSchema.safeParse({ subject: "Two\nlines", body: "Body" }).success,
    ).toBe(false);
    expect(
      templateSchema.safeParse({ subject: " ", body: "Body" }).success,
    ).toBe(false);
  });

  it("escapes HTML and always adds the legal footer", () => {
    const email = buildReminderEmail({
      subject: "Reminder for {{client_first_name}}",
      body: "Hi {{client_first_name}}\nSee you at {{location}}",
      values: {
        ...values,
        client_first_name: '<script>alert("x")</script>',
        location: "Tom & Jerry's",
      },
      businessName: "Alice <Barbershop>",
      postalAddress: "100 Main St\nAustin, TX",
      unsubscribeUrl: "https://app.example.com/unsubscribe?token=abc&x=1",
    });
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("Tom &amp; Jerry&#39;s");
    expect(email.html).toContain(
      'href="https://app.example.com/unsubscribe?token=abc&amp;x=1"',
    );
    expect(email.text).toContain(
      "Alice <Barbershop> · 100 Main St, Austin, TX",
    );
    expect(email.text).toContain(
      "Unsubscribe from reminders: https://app.example.com/unsubscribe?token=abc&x=1",
    );
    expect(email.subject).toBe('Reminder for <script>alert("x")</script>');
  });

  it("validates the sender details", () => {
    expect(
      senderSchema.parse({ contactEmail: "", postalAddress: "100 Main St" }),
    ).toEqual({ contactEmail: null, postalAddress: "100 Main St" });
    expect(
      senderSchema.parse({
        contactEmail: " Owner@Example.com ",
        postalAddress: "100 Main St",
      }).contactEmail,
    ).toBe("owner@example.com");
    expect(
      senderSchema.safeParse({
        contactEmail: "nope",
        postalAddress: "100 Main St",
      }).success,
    ).toBe(false);
    expect(
      senderSchema.safeParse({ contactEmail: "", postalAddress: "" }).success,
    ).toBe(false);
  });
});

describe("composeReminder", () => {
  const job: ClaimedJob = {
    job_id: "4b8b0f4e-0d6a-4f4e-9d8a-3c1a3a4f0c11",
    business_id: "b",
    send_at: "2026-11-01T06:30:00Z",
    attempts: 1,
    business_name: "Alice Barbershop",
    business_timezone: "America/Chicago",
    business_contact_email: null,
    business_postal_address: "100 Main St",
    client_first_name: "Maria",
    client_email: "maria@example.com",
    unsubscribe_token: "6f1c8a51-5a4c-4e57-9a0e-3c2e6f0a8b22",
    appointment_title: "Haircut",
    // 1:30 AM CDT, the first of the two 1:30s on the night clocks fall back.
    appointment_starts_at: "2026-11-01T06:30:00Z",
    appointment_location: null,
    template_subject: null,
    template_body: null,
  };

  it("writes the date and time in the business's time zone", () => {
    const email = composeReminder(job, {
      appUrl: "https://app.example.com",
      fromAddress: "reminders@example.com",
    });
    expect(email.subject).toBe("Reminder: Haircut on Sunday, November 1, 2026");
    expect(email.text).toContain("at 1:30 AM CDT.");
    expect(email.text).not.toContain("Location:");
    expect(email.replyTo).toBeNull();
    expect(email.idempotencyKey).toBe(
      `reminder-${job.job_id}-${Date.parse(job.send_at)}`,
    );
    expect(email.headers["List-Unsubscribe-Post"]).toBe(
      "List-Unsubscribe=One-Click",
    );
  });

  it("uses the business's own template when there is one", () => {
    const email = composeReminder(
      {
        ...job,
        template_subject: "See you, {{client_first_name}}",
        template_body: "Short and sweet.",
      },
      { appUrl: "https://app.example.com", fromAddress: "r@example.com" },
    );
    expect(email.subject).toBe("See you, Maria");
    expect(email.text.startsWith("Short and sweet.")).toBe(true);
  });
});

describe("Resend client", () => {
  it("knows which failures are worth retrying", () => {
    for (const status of [429, 500, 503, 401, 403, 409]) {
      expect(isPermanentFailure(status), String(status)).toBe(false);
    }
    for (const status of [400, 404, 422]) {
      expect(isPermanentFailure(status), String(status)).toBe(true);
    }
  });

  it("sends with the idempotency key and returns the email id", async () => {
    let request: { url: string; init: RequestInit } | undefined;
    const send = createResendSender({
      apiKey: "re_test",
      fetchImpl: async (url, init) => {
        request = { url: String(url), init: init! };
        return Response.json({ id: "email_1" });
      },
    });
    const result = await send({
      from: "a@example.com",
      to: "b@example.com",
      replyTo: "c@example.com",
      subject: "S",
      html: "<p>H</p>",
      text: "H",
      idempotencyKey: "key-1",
    });
    expect(result).toEqual({ ok: true, id: "email_1" });
    expect(request?.url).toBe("https://api.resend.com/emails");
    const headers = request?.init.headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toBe("key-1");
    expect(headers.Authorization).toBe("Bearer re_test");
    expect(JSON.parse(String(request?.init.body))).toMatchObject({
      to: ["b@example.com"],
      reply_to: "c@example.com",
    });
  });

  it("reports errors and network failures", async () => {
    const rejected = createResendSender({
      apiKey: "re_test",
      fetchImpl: async () =>
        Response.json({ message: "Invalid `to` field" }, { status: 422 }),
    });
    expect(
      await rejected({
        from: "a@example.com",
        to: "bad",
        subject: "S",
        html: "",
        text: "",
        idempotencyKey: "k",
      }),
    ).toEqual({
      ok: false,
      error: "Resend responded 422: Invalid `to` field",
      permanent: true,
    });

    const offline = createResendSender({
      apiKey: "re_test",
      fetchImpl: async () => {
        throw new Error("getaddrinfo ENOTFOUND");
      },
    });
    const result = await offline({
      from: "a@example.com",
      to: "b@example.com",
      subject: "S",
      html: "",
      text: "",
      idempotencyKey: "k",
    });
    expect(result).toMatchObject({ ok: false, permanent: false });
  });

  it("formats the sender name safely", () => {
    expect(formatSender('Bob "The" <Barber>', "r@example.com")).toBe(
      '"Bob The Barber" <r@example.com>',
    );
    expect(formatSender("", "r@example.com")).toBe("r@example.com");
  });
});

describe("webhook signatures", () => {
  const secret = `whsec_${Buffer.from("test-secret-key").toString("base64")}`;
  const sign = (id: string, timestamp: string, body: string) =>
    createHmac("sha256", Buffer.from("test-secret-key"))
      .update(`${id}.${timestamp}.${body}`)
      .digest("base64");
  const body = '{"type":"email.delivered"}';
  const now = 1_800_000_000;

  it("accepts a valid signature, also among several", () => {
    const signature = sign("msg_1", String(now), body);
    expect(
      verifyWebhookSignature({
        secret,
        id: "msg_1",
        timestamp: String(now),
        signature: `v1,${signature}`,
        body,
        nowSeconds: now,
      }),
    ).toBe(true);
    expect(
      verifyWebhookSignature({
        secret,
        id: "msg_1",
        timestamp: String(now),
        signature: `v1,b2xkLXNpZ25hdHVyZQ== v1,${signature}`,
        body,
        nowSeconds: now + 60,
      }),
    ).toBe(true);
  });

  it("rejects tampered, old or missing signatures", () => {
    const signature = `v1,${sign("msg_1", String(now), body)}`;
    const base = {
      secret,
      id: "msg_1",
      timestamp: String(now),
      signature,
      body,
      nowSeconds: now,
    };
    expect(verifyWebhookSignature({ ...base, body: `${body} ` })).toBe(false);
    expect(verifyWebhookSignature({ ...base, id: "msg_2" })).toBe(false);
    expect(verifyWebhookSignature({ ...base, nowSeconds: now + 301 })).toBe(
      false,
    );
    expect(verifyWebhookSignature({ ...base, signature: null })).toBe(false);
    expect(verifyWebhookSignature({ ...base, secret: "whsec_d3Jvbmc=" })).toBe(
      false,
    );
  });

  it("reads delivery, bounce and complaint events", () => {
    expect(
      parseEmailEvent({ type: "email.delivered", data: { email_id: "e1" } }),
    ).toEqual({
      event: "delivered",
      emailId: "e1",
      permanentBounce: false,
      detail: {},
    });
    expect(
      parseEmailEvent({
        type: "email.bounced",
        data: {
          email_id: "e2",
          bounce: { type: "Permanent", message: "No such user" },
        },
      }),
    ).toMatchObject({ event: "bounced", permanentBounce: true });
    expect(
      parseEmailEvent({
        type: "email.bounced",
        data: { email_id: "e3", bounce: { type: "Transient" } },
      }),
    ).toMatchObject({ permanentBounce: false });
    expect(parseEmailEvent({ type: "email.opened", data: {} })).toBeNull();
    expect(parseEmailEvent({ type: "email.delivered" })).toBeNull();
    expect(parseEmailEvent("nope")).toBeNull();
  });

  it("checks the cron secret", () => {
    expect(isBearerAuthorized("Bearer abc", "abc")).toBe(true);
    expect(isBearerAuthorized("Bearer abd", "abc")).toBe(false);
    expect(isBearerAuthorized("abc", "abc")).toBe(false);
    expect(isBearerAuthorized(null, "abc")).toBe(false);
    expect(isBearerAuthorized("Bearer ", "")).toBe(false);
    expect(isBearerAuthorized("Bearer null", null)).toBe(false);
  });
});

describe("reminder status for people", () => {
  it("combines the job status with delivery events", () => {
    expect(
      reminderState({ status: "pending", next_attempt_at: "x" }).label,
    ).toBe("Queued");
    expect(
      reminderState({
        status: "sent",
        next_attempt_at: null,
        deliveryEvent: "delivered",
      }),
    ).toEqual({ label: "Delivered", tone: "success" });
    expect(
      reminderState({
        status: "failed",
        next_attempt_at: "2026-10-20T00:00:00Z",
      }).label,
    ).toBe("Will retry");
    expect(
      reminderState({ status: "failed", next_attempt_at: null }).label,
    ).toBe("Failed");
  });

  it("picks the latest delivery event and explains skips", () => {
    expect(
      latestDeliveryEvent([
        { event: "queued", created_at: "2026-10-20T10:00:00Z" },
        { event: "delivered", created_at: "2026-10-20T10:01:00Z" },
        { event: "bounced", created_at: "2026-10-20T10:02:00Z" },
        { event: "sent", created_at: "2026-10-20T10:03:00Z" },
      ]),
    ).toBe("bounced");
    expect(latestDeliveryEvent([])).toBeNull();
    expect(
      reminderNote({
        status: "skipped",
        skip_reason: "no_consent",
        last_error: null,
      }),
    ).toMatch(/not agreed/);
    expect(
      reminderNote({ status: "sent", skip_reason: null, last_error: null }),
    ).toBeNull();
  });
});

describe("parseServerEnv", () => {
  it("treats empty values as not set and applies defaults", () => {
    const env = parseServerEnv({
      RESEND_API_KEY: "",
      SUPABASE_SECRET_KEY: " ",
    });
    expect(env.RESEND_API_KEY).toBeUndefined();
    expect(env.RESEND_FROM_EMAIL).toBe("onboarding@resend.dev");
    expect(env.RESEND_API_URL).toBe("https://api.resend.com");
  });

  it("rejects malformed values", () => {
    expect(() => parseServerEnv({ RESEND_WEBHOOK_SECRET: "abc" })).toThrow(
      /RESEND_WEBHOOK_SECRET/,
    );
    expect(() => parseServerEnv({ RESEND_FROM_EMAIL: "not an email" })).toThrow(
      /RESEND_FROM_EMAIL/,
    );
  });
});
