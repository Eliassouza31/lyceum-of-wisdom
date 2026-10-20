import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { safeNextPath } from "@/lib/auth/redirects";
import { logger } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const OTP_TYPES: readonly EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

/**
 * Landing point for links in Supabase Auth emails (sign-up confirmation and
 * password reset). Supports both the PKCE `code` flow and `token_hash` templates.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  const supabase = await createSupabaseServerClient();

  let error: { code?: string; message: string } | null = null;
  if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else if (tokenHash && OTP_TYPES.includes(type as EmailOtpType)) {
    ({ error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    }));
  } else {
    error = { message: "Missing code" };
  }

  if (!error) {
    return NextResponse.redirect(new URL(next, request.url));
  }

  logger.warn("auth.confirm_failed", { code: error.code });

  // The sign-up link confirms the email before redirecting here, so even when the
  // session cannot be created (e.g. the link was opened in another browser) the
  // user can usually just sign in.
  const failure = new URL("/login", request.url);
  failure.searchParams.set(
    "notice",
    next === "/reset-password" ? "reset_link_invalid" : "confirm_link_invalid",
  );
  return NextResponse.redirect(failure);
}
