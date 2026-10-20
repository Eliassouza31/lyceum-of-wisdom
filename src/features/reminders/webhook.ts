import { createHmac, timingSafeEqual } from "node:crypto";

/** Webhooks older (or newer) than this are rejected, so a captured one cannot be replayed later. */
const TOLERANCE_SECONDS = 5 * 60;

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Checks a Resend webhook signature. Resend signs with Svix:
 * base64(HMAC-SHA256(secret, "<svix-id>.<svix-timestamp>.<raw body>")).
 * https://docs.svix.com/receiving/verifying-payloads/how-manual
 */
export function verifyWebhookSignature({
  secret,
  id,
  timestamp,
  signature,
  body,
  nowSeconds = Math.floor(Date.now() / 1000),
}: {
  secret: string;
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  body: string;
  nowSeconds?: number;
}): boolean {
  if (!id || !timestamp || !signature || !/^\d+$/.test(timestamp)) {
    return false;
  }
  if (Math.abs(nowSeconds - Number(timestamp)) > TOLERANCE_SECONDS) {
    return false;
  }
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
  // The header can carry several signatures ("v1,abc v1,def") during key rotation.
  return signature
    .split(" ")
    .map((entry) => entry.split(","))
    .some(
      ([version, value]) =>
        version === "v1" && value !== undefined && safeEqual(value, expected),
    );
}

export type EmailEvent = {
  event: "delivered" | "bounced" | "complained";
  emailId: string;
  permanentBounce: boolean;
  detail: Record<string, string>;
};

const EVENT_TYPES = {
  "email.delivered": "delivered",
  "email.bounced": "bounced",
  "email.complained": "complained",
} as const;

/** The parts of a Resend webhook we use, or null for events we ignore. */
export function parseEmailEvent(payload: unknown): EmailEvent | null {
  if (typeof payload !== "object" || payload === null) return null;
  const { type, data } = payload as { type?: unknown; data?: unknown };
  if (typeof type !== "string" || !Object.hasOwn(EVENT_TYPES, type)) {
    return null;
  }
  const event = EVENT_TYPES[type as keyof typeof EVENT_TYPES];
  const record = (data ?? {}) as {
    email_id?: unknown;
    bounce?: { type?: unknown; message?: unknown };
  };
  if (typeof record.email_id !== "string" || !record.email_id) return null;

  const bounceType =
    typeof record.bounce?.type === "string" ? record.bounce.type : "";
  const detail: Record<string, string> = {};
  if (bounceType) detail.bounce_type = bounceType;
  if (typeof record.bounce?.message === "string") {
    detail.message = record.bounce.message.slice(0, 300);
  }

  return {
    event,
    emailId: record.email_id,
    // Resend reports permanent rejections as bounces; only an explicit
    // "Transient" bounce (e.g. a full mailbox) is worth trying again later.
    permanentBounce: event === "bounced" && !/^transient$/i.test(bounceType),
    detail,
  };
}

/** Constant-time check of the "Authorization: Bearer <secret>" header. */
export function isBearerAuthorized(
  header: string | null,
  secret: string | null | undefined,
): boolean {
  if (!header || !secret) return false;
  return safeEqual(header, `Bearer ${secret}`);
}
