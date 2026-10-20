import { connection } from "next/server";

import {
  parseEmailEvent,
  verifyWebhookSignature,
} from "@/features/reminders/webhook";
import { logger } from "@/lib/logger";
import { getServerEnv } from "@/lib/server-env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const NO_STORE = { "Cache-Control": "no-store" };

function reply(status: number, body: Record<string, unknown>): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

/**
 * Resend calls this when a reminder is delivered, bounces or is marked as
 * spam. Bounces and complaints block the address from future reminders.
 */
export async function POST(request: Request): Promise<Response> {
  await connection();
  const { RESEND_WEBHOOK_SECRET } = getServerEnv();
  const db = createSupabaseAdminClient();
  if (!RESEND_WEBHOOK_SECRET || !db) {
    return reply(503, { error: "Webhooks are not configured." });
  }

  // The signature covers the exact bytes, so read the raw body first.
  const body = await request.text();
  const id = request.headers.get("svix-id");
  const valid = verifyWebhookSignature({
    secret: RESEND_WEBHOOK_SECRET,
    id,
    timestamp: request.headers.get("svix-timestamp"),
    signature: request.headers.get("svix-signature"),
    body,
  });
  if (!valid) return reply(401, { error: "Invalid signature" });

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return reply(400, { error: "Invalid JSON" });
  }

  const event = parseEmailEvent(payload);
  if (!event) return reply(200, { ignored: true });

  const { data: known, error } = await db.rpc("record_email_event", {
    p_provider_message_id: event.emailId,
    p_event: event.event,
    p_provider_event_id: id ?? "",
    p_detail: event.detail,
    p_permanent_bounce: event.permanentBounce,
  });
  if (error) {
    logger.error("reminders.webhook_failed", { message: error.message });
    // A 5xx makes Resend retry the delivery later.
    return reply(500, { error: "Could not record the event." });
  }
  return reply(200, { recorded: known });
}
