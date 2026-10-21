import type { NextRequest } from "next/server";

import {
  parseUnsubscribeToken,
  unsubscribe,
} from "@/features/reminders/unsubscribe";
import {
  clientIp,
  consumeRateLimit,
  RATE_LIMITED_MESSAGE,
  RATE_LIMITS,
} from "@/lib/rate-limit";

/**
 * One-click unsubscribe (RFC 8058): mail apps POST here when the reader
 * presses their own "Unsubscribe" button, using the List-Unsubscribe header.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const token = parseUnsubscribeToken(
    request.nextUrl.searchParams.get("token"),
  );
  if (!token) {
    return Response.json({ error: "Invalid link" }, { status: 400 });
  }
  const ipAddress = clientIp(request.headers);
  if (!(await consumeRateLimit("unsubscribe:ip", ipAddress))) {
    return Response.json(
      { error: RATE_LIMITED_MESSAGE },
      {
        status: 429,
        headers: {
          "Retry-After": String(RATE_LIMITS["unsubscribe:ip"].windowSeconds),
        },
      },
    );
  }
  await unsubscribe(token, {
    ipAddress,
    userAgent: request.headers.get("user-agent"),
  });
  return Response.json(
    { unsubscribed: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
