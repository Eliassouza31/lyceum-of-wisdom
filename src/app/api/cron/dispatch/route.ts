import { connection } from "next/server";

import { runDispatch } from "@/features/reminders/dispatcher";
import { createResendSender } from "@/features/reminders/resend";
import { isBearerAuthorized } from "@/features/reminders/webhook";
import { publicEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getServerEnv } from "@/lib/server-env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Vercel stops the function after this many seconds.
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" };

function reply(status: number, body: Record<string, unknown>): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

/**
 * Called every minute by pg_cron in Supabase (see the phase 6 migration) with
 * "Authorization: Bearer <secret>". The secret lives only in the Supabase
 * vault, so the app reads it from there instead of a Vercel variable.
 */
export async function POST(request: Request): Promise<Response> {
  await connection();
  const db = createSupabaseAdminClient();
  if (!db) {
    return reply(503, { error: "SUPABASE_SECRET_KEY is not set." });
  }

  const { data: secret, error: secretError } = await db.rpc(
    "get_dispatch_secret",
  );
  if (secretError) {
    logger.error("reminders.secret_failed", { message: secretError.message });
    return reply(500, { error: "Could not check the request." });
  }
  if (!isBearerAuthorized(request.headers.get("authorization"), secret)) {
    return reply(401, { error: "Unauthorized" });
  }

  const env = getServerEnv();
  if (!env.RESEND_API_KEY) {
    // Nothing is claimed, so reminders wait in the queue until email is set up.
    return reply(503, { error: "RESEND_API_KEY is not set." });
  }

  try {
    const summary = await runDispatch({
      db,
      send: createResendSender({
        apiKey: env.RESEND_API_KEY,
        apiUrl: env.RESEND_API_URL,
      }),
      appUrl: publicEnv.NEXT_PUBLIC_APP_URL,
      fromAddress: env.RESEND_FROM_EMAIL,
    });
    if (summary.claimed > 0) logger.info("reminders.dispatched", summary);
    return reply(200, summary);
  } catch (error) {
    logger.error("reminders.dispatch_failed", { error });
    return reply(500, { error: "Dispatch failed." });
  }
}
