"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { clientIp, parseUnsubscribeToken, unsubscribe } from "./unsubscribe";

export async function unsubscribeAction(token: string): Promise<void> {
  const parsed = parseUnsubscribeToken(token);
  if (!parsed) redirect("/unsubscribe");
  const requestHeaders = await headers();
  await unsubscribe(parsed, {
    ipAddress: clientIp(requestHeaders),
    userAgent: requestHeaders.get("user-agent"),
  });
  redirect(`/unsubscribe?token=${parsed}&done=1`);
}
