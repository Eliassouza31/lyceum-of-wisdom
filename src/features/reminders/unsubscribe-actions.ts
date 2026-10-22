"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { clientIp, consumeRateLimit } from "@/lib/rate-limit";

import { parseUnsubscribeToken, unsubscribe } from "./unsubscribe";

export async function unsubscribeAction(token: string): Promise<void> {
  const parsed = parseUnsubscribeToken(token);
  if (!parsed) redirect("/unsubscribe");
  const requestHeaders = await headers();
  const ipAddress = clientIp(requestHeaders);
  if (!(await consumeRateLimit("unsubscribe:ip", ipAddress))) {
    redirect(`/unsubscribe?token=${parsed}&limited=1`);
  }
  await unsubscribe(parsed, {
    ipAddress,
    userAgent: requestHeaders.get("user-agent"),
  });
  redirect(`/unsubscribe?token=${parsed}&done=1`);
}
