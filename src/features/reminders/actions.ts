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

import { MAX_RULES } from "./offsets";
import {
  RULE_FORM_FIELDS,
  ruleSchema,
  SENDER_FORM_FIELDS,
  senderSchema,
  TEMPLATE_FORM_FIELDS,
  templateSchema,
} from "./schemas";

const ruleId = z.uuid();

const NOT_ALLOWED: FormState = {
  status: "error",
  message: "Only the business owner or an admin can change reminder settings.",
};

async function requireEditor() {
  const context = await requireBusinessContext();
  const canEdit =
    context.business.role === "owner" || context.business.role === "admin";
  return { ...context, canEdit };
}

function failed(
  event: string,
  error: { code: string; message: string },
  values: Record<string, string>,
): FormState {
  logger.error(event, { code: error.code, message: error.message });
  return {
    status: "error",
    message: "We could not save this. Please try again.",
    values,
  };
}

export async function addRuleAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { business, canEdit } = await requireEditor();
  const raw = formDataToObject(formData);
  const values = pick(raw, RULE_FORM_FIELDS);
  if (!canEdit) return { ...NOT_ALLOWED, values };
  const parsed = ruleSchema.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createSupabaseServerClient();
  const { count, error: countError } = await supabase
    .from("reminder_rules")
    .select("id", { count: "exact", head: true })
    .eq("business_id", business.id);
  if (countError)
    return failed("reminders.rule_count_failed", countError, values);
  if ((count ?? 0) >= MAX_RULES) {
    return {
      status: "error",
      message: `You can have up to ${MAX_RULES} reminders. Delete one to add another.`,
      values,
    };
  }

  const { error } = await supabase
    .from("reminder_rules")
    .insert({ business_id: business.id, offset_minutes: parsed.data });
  if (error?.code === "23505") {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: { amount: ["You already have a reminder at this time."] },
      values,
    };
  }
  if (error) return failed("reminders.rule_add_failed", error, values);
  redirect("/reminders?saved=rule_added");
}

export async function setRuleActiveAction(
  id: string,
  active: boolean,
): Promise<void> {
  const { business, canEdit } = await requireEditor();
  if (!canEdit || !ruleId.safeParse(id).success) redirect("/reminders");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("reminder_rules")
    .update({ is_active: active })
    .eq("business_id", business.id)
    .eq("id", id);
  if (error) {
    logger.error("reminders.rule_toggle_failed", { message: error.message });
    throw new Error("We could not update this reminder. Please try again.");
  }
  redirect(`/reminders?saved=${active ? "rule_on" : "rule_off"}`);
}

export async function deleteRuleAction(id: string): Promise<void> {
  const { business, canEdit } = await requireEditor();
  if (!canEdit || !ruleId.safeParse(id).success) redirect("/reminders");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("reminder_rules")
    .delete()
    .eq("business_id", business.id)
    .eq("id", id);
  if (error) {
    logger.error("reminders.rule_delete_failed", { message: error.message });
    throw new Error("We could not delete this reminder. Please try again.");
  }
  redirect("/reminders?saved=rule_deleted");
}

export async function saveTemplateAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { business, canEdit } = await requireEditor();
  const raw = formDataToObject(formData);
  const values = pick(raw, TEMPLATE_FORM_FIELDS);
  if (!canEdit) return { ...NOT_ALLOWED, values };
  const parsed = templateSchema.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createSupabaseServerClient();
  const { data: updated, error: updateError } = await supabase
    .from("message_templates")
    .update(parsed.data)
    .eq("business_id", business.id)
    .eq("channel", "email")
    .select("id");
  if (updateError) {
    return failed("reminders.template_save_failed", updateError, values);
  }
  if (updated.length === 0) {
    const { error } = await supabase
      .from("message_templates")
      .insert({ business_id: business.id, ...parsed.data });
    if (error) return failed("reminders.template_save_failed", error, values);
  }
  redirect("/reminders?saved=template");
}

export async function resetTemplateAction(): Promise<void> {
  const { business, canEdit } = await requireEditor();
  if (!canEdit) redirect("/reminders");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("message_templates")
    .delete()
    .eq("business_id", business.id)
    .eq("channel", "email");
  if (error) {
    logger.error("reminders.template_reset_failed", { message: error.message });
    throw new Error("We could not reset the message. Please try again.");
  }
  redirect("/reminders?saved=template_reset");
}

export async function saveSenderAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { business, canEdit } = await requireEditor();
  const raw = formDataToObject(formData);
  const values = pick(raw, SENDER_FORM_FIELDS);
  if (!canEdit) return { ...NOT_ALLOWED, values };
  const parsed = senderSchema.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("businesses")
    .update({
      contact_email: parsed.data.contactEmail,
      postal_address: parsed.data.postalAddress,
    })
    .eq("id", business.id)
    .select("id");
  if (error) return failed("reminders.sender_save_failed", error, values);
  if (data.length === 0) return { ...NOT_ALLOWED, values };
  redirect("/reminders?saved=sender");
}
