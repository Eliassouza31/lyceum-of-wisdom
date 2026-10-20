"use server";

import { redirect } from "next/navigation";

import {
  formDataToObject,
  pick,
  validationError,
  type FormState,
} from "@/lib/forms";
import { logger } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { createBusinessSchema } from "./schemas";

export async function createBusinessAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = formDataToObject(formData);
  const values = pick(raw, ["name", "timezone"]);
  const parsed = createBusinessSchema.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("create_business", {
    p_name: parsed.data.name,
    p_timezone: parsed.data.timezone,
  });

  if (error) {
    // Already onboarded (e.g. a double submit): just continue to the app.
    if (error.message.includes("already own a business"))
      redirect("/dashboard");

    logger.error("business.create_failed", {
      code: error.code,
      message: error.message,
    });
    return {
      status: "error",
      message: "We could not create your business. Please try again.",
      values,
    };
  }

  redirect("/dashboard");
}
