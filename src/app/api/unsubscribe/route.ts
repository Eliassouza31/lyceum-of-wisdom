import type { NextRequest } from "next/server";

import {
  clientIp,
  parseUnsubscribeToken,
  unsubscribe,
} from "@/features/reminders/unsubscribe";

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
  await unsubscribe(token, {
    ipAddress: clientIp(request.headers),
    userAgent: request.headers.get("user-agent"),
  });
  return Response.json(
    { unsubscribed: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
