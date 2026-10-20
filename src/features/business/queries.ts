import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { logger } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

export type CurrentBusiness = {
  id: string;
  name: string;
  timezone: string;
  role: Database["public"]["Enums"]["member_role"];
};

export type SessionContext = {
  userId: string;
  email: string;
  fullName: string;
  business: CurrentBusiness | null;
};

/**
 * Loads the signed-in user and their business once per request.
 * Returns null when nobody is signed in.
 */
export const getSessionContext = cache(
  async (): Promise<SessionContext | null> => {
    const supabase = await createSupabaseServerClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const claims = claimsData?.claims;
    if (!claims?.sub) return null;

    const [profileResult, membershipResult] = await Promise.all([
      supabase.from("profiles").select("full_name").maybeSingle(),
      supabase
        .from("business_members")
        .select("role, businesses (id, name, timezone)")
        .eq("user_id", claims.sub)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    if (profileResult.error || membershipResult.error) {
      logger.error("session_context.load_failed", {
        profileError: profileResult.error?.message,
        membershipError: membershipResult.error?.message,
      });
      throw new Error("Could not load your account. Please try again.");
    }

    const membership = membershipResult.data;
    const business = membership?.businesses ?? null;

    return {
      userId: claims.sub,
      email: typeof claims.email === "string" ? claims.email : "",
      fullName: profileResult.data?.full_name ?? "",
      business:
        membership && business ? { ...business, role: membership.role } : null,
    };
  },
);

/** For pages inside the app: requires a user who has finished onboarding. */
export async function requireBusinessContext(): Promise<
  SessionContext & { business: CurrentBusiness }
> {
  const context = await getSessionContext();
  if (!context) redirect("/login");
  if (!context.business) redirect("/onboarding");
  return context as SessionContext & { business: CurrentBusiness };
}
