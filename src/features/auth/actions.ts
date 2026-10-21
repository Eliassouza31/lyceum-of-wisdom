"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { safeNextPath } from "@/lib/auth/redirects";
import { publicEnv } from "@/lib/env";
import {
  formDataToObject,
  pick,
  validationError,
  type FormState,
} from "@/lib/forms";
import { logger } from "@/lib/logger";
import {
  clientIp,
  consumeRateLimit,
  RATE_LIMITED_MESSAGE,
  type RateLimitName,
} from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { authErrorMessage } from "./errors";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "./schemas";

function confirmUrl(next: string): string {
  const url = new URL("/auth/confirm", publicEnv.NEXT_PUBLIC_APP_URL);
  url.searchParams.set("next", next);
  return url.toString();
}

/** Counts the attempt against every limit; false when any of them is reached. */
async function withinRateLimits(
  limits: Array<[RateLimitName, string | null]>,
): Promise<boolean> {
  const results = await Promise.all(
    limits.map(([name, value]) => consumeRateLimit(name, value)),
  );
  return results.every(Boolean);
}

function rateLimited(values: Record<string, string>): FormState {
  return { status: "error", message: RATE_LIMITED_MESSAGE, values };
}

export async function signUpAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = formDataToObject(formData);
  const values = pick(raw, ["fullName", "email"]);
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error, values);

  const ip = clientIp(await headers());
  if (!(await withinRateLimits([["sign-up:ip", ip]]))) {
    return rateLimited(values);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: confirmUrl("/onboarding"),
    },
  });

  if (error) {
    logger.warn("auth.sign_up_failed", {
      code: error.code,
      status: error.status,
    });
    return { status: "error", message: authErrorMessage(error), values };
  }

  // With email confirmation enabled no session is returned. If confirmation is
  // ever disabled, the user is signed in right away.
  if (data.session) redirect("/onboarding");

  return {
    status: "success",
    message: `We sent a confirmation link to ${parsed.data.email}. Open it to activate your account.`,
  };
}

export async function signInAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = formDataToObject(formData);
  const values = pick(raw, ["email"]);
  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error, values);

  const ip = clientIp(await headers());
  const allowed = await withinRateLimits([
    ["sign-in:ip", ip],
    ["sign-in:email", parsed.data.email],
  ]);
  if (!allowed) return rateLimited(values);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    logger.warn("auth.sign_in_failed", {
      code: error.code,
      status: error.status,
    });
    return { status: "error", message: authErrorMessage(error), values };
  }

  // Users who never finished onboarding go straight there instead of bouncing
  // through the dashboard.
  const { count } = await supabase
    .from("business_members")
    .select("business_id", { count: "exact", head: true })
    .eq("user_id", data.user.id);
  if (count === 0) redirect("/onboarding");

  redirect(safeNextPath(raw.next));
}

export async function requestPasswordResetAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = formDataToObject(formData);
  const values = pick(raw, ["email"]);
  const parsed = forgotPasswordSchema.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error, values);

  const ip = clientIp(await headers());
  const allowed = await withinRateLimits([
    ["password-reset:ip", ip],
    ["password-reset:email", parsed.data.email],
  ]);
  if (!allowed) return rateLimited(values);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    { redirectTo: confirmUrl("/reset-password") },
  );

  if (error) {
    logger.warn("auth.password_reset_request_failed", {
      code: error.code,
      status: error.status,
    });
    if (error.status === 429) {
      return { status: "error", message: authErrorMessage(error), values };
    }
  }

  // Same answer whether or not the account exists, so emails cannot be enumerated.
  return {
    status: "success",
    message:
      "If an account exists for that email, we sent a link to reset your password.",
  };
}

export async function updatePasswordAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    logger.warn("auth.password_update_failed", {
      code: error.code,
      status: error.status,
    });
    return { status: "error", message: authErrorMessage(error) };
  }

  redirect("/dashboard?passwordUpdated=1");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();
  if (error) logger.warn("auth.sign_out_failed", { code: error.code });
  redirect("/login");
}
