"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireBusinessContext } from "@/features/business/queries";
import {
  formDataToObject,
  pick,
  validationError,
  type FormState,
} from "@/lib/forms";
import { logger } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { CLIENT_FORM_FIELDS, clientSchema, type ClientInput } from "./schemas";

const clientId = z.uuid();

function toColumns(input: ClientInput) {
  return {
    first_name: input.firstName,
    last_name: input.lastName,
    email: input.email,
    phone_e164: input.phone,
    email_reminders_consent: input.emailConsent,
    notes: input.notes,
  };
}

function saveFailed(
  error: { code: string; message: string },
  values: Record<string, string>,
  event: string,
): FormState {
  // Unique index on (business_id, email) for active clients.
  if (error.code === "23505") {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: { email: ["Another client already uses this email."] },
      values,
    };
  }
  logger.error(event, { code: error.code, message: error.message });
  return {
    status: "error",
    message: "We could not save this client. Please try again.",
    values,
  };
}

export async function createClientAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { business } = await requireBusinessContext();
  const raw = formDataToObject(formData);
  const values = pick(raw, CLIENT_FORM_FIELDS);
  const parsed = clientSchema.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("clients")
    .insert({ business_id: business.id, ...toColumns(parsed.data) })
    .select("id")
    .single();

  if (error) return saveFailed(error, values, "clients.create_failed");
  redirect(`/clients/${data.id}?saved=created`);
}

export async function updateClientAction(
  id: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { business } = await requireBusinessContext();
  const raw = formDataToObject(formData);
  const values = pick(raw, CLIENT_FORM_FIELDS);
  if (!clientId.safeParse(id).success) redirect("/clients");
  const parsed = clientSchema.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("clients")
    .update(toColumns(parsed.data))
    .eq("business_id", business.id)
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");

  if (error) return saveFailed(error, values, "clients.update_failed");
  // Nothing matched: removed in the meantime, or not this business's client.
  if (data.length === 0) redirect("/clients");
  redirect(`/clients/${id}?saved=updated`);
}

/** Soft delete: the client disappears from the app but their history is kept. */
export async function deleteClientAction(id: string): Promise<void> {
  const { business } = await requireBusinessContext();
  if (!clientId.safeParse(id).success) redirect("/clients");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("clients")
    .update({ deleted_at: new Date().toISOString() })
    .eq("business_id", business.id)
    .eq("id", id)
    .is("deleted_at", null);

  if (error) {
    logger.error("clients.delete_failed", {
      code: error.code,
      message: error.message,
    });
    throw new Error("We could not remove this client. Please try again.");
  }
  redirect("/clients?removed=1");
}
