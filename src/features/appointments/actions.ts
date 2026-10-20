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
import { localDateOf } from "@/lib/time";

import { calendarHref } from "./calendar";
import {
  APPOINTMENT_FORM_FIELDS,
  appointmentSchema,
  appointmentStatusSchema,
  type AppointmentInput,
} from "./schemas";

const appointmentId = z.uuid();

function toColumns(input: AppointmentInput) {
  return {
    client_id: input.clientId,
    title: input.title,
    starts_at: input.startsAt.toISOString(),
    ends_at: input.endsAt.toISOString(),
    location: input.location,
    notes: input.notes,
  };
}

function saveFailed(
  error: { code: string; message: string },
  values: Record<string, string>,
  event: string,
): FormState {
  // Foreign key or trigger: the client is gone or belongs to another business.
  if (error.code === "23503") {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: {
        clientId: ["This client is no longer available. Choose another one."],
      },
      values,
    };
  }
  logger.error(event, { code: error.code, message: error.message });
  return {
    status: "error",
    message: "We could not save this appointment. Please try again.",
    values,
  };
}

export async function createAppointmentAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { business } = await requireBusinessContext();
  const raw = formDataToObject(formData);
  const values = pick(raw, APPOINTMENT_FORM_FIELDS);
  const parsed = appointmentSchema(business.timezone).safeParse(raw);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("appointments")
    .insert({ business_id: business.id, ...toColumns(parsed.data) })
    .select("id")
    .single();

  if (error) return saveFailed(error, values, "appointments.create_failed");
  redirect(`/appointments/${data.id}?saved=created`);
}

export async function updateAppointmentAction(
  id: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { business } = await requireBusinessContext();
  const raw = formDataToObject(formData);
  const values = pick(raw, APPOINTMENT_FORM_FIELDS);
  if (!appointmentId.safeParse(id).success) redirect("/appointments");
  const parsed = appointmentSchema(business.timezone).safeParse(raw);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("appointments")
    .update(toColumns(parsed.data))
    .eq("business_id", business.id)
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");

  if (error) return saveFailed(error, values, "appointments.update_failed");
  // Nothing matched: deleted in the meantime, or not this business's appointment.
  if (data.length === 0) redirect("/appointments");
  redirect(`/appointments/${id}?saved=updated`);
}

export async function setAppointmentStatusAction(
  id: string,
  status: string,
): Promise<void> {
  const { business } = await requireBusinessContext();
  const parsedStatus = appointmentStatusSchema.safeParse(status);
  if (!appointmentId.safeParse(id).success || !parsedStatus.success) {
    redirect("/appointments");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("appointments")
    .update({ status: parsedStatus.data })
    .eq("business_id", business.id)
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");

  if (error) {
    logger.error("appointments.status_failed", {
      code: error.code,
      message: error.message,
    });
    throw new Error("We could not update this appointment. Please try again.");
  }
  if (data.length === 0) redirect("/appointments");
  redirect(`/appointments/${id}?saved=${parsedStatus.data}`);
}

/** Soft delete: the appointment disappears from the app but stays in the database. */
export async function deleteAppointmentAction(id: string): Promise<void> {
  const { business } = await requireBusinessContext();
  if (!appointmentId.safeParse(id).success) redirect("/appointments");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("appointments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("business_id", business.id)
    .eq("id", id)
    .is("deleted_at", null)
    .select("starts_at");

  if (error) {
    logger.error("appointments.delete_failed", {
      code: error.code,
      message: error.message,
    });
    throw new Error("We could not delete this appointment. Please try again.");
  }
  const deleted = data[0];
  if (!deleted) redirect("/appointments");
  redirect(
    `${calendarHref("day", localDateOf(deleted.starts_at, business.timezone))}&deleted=1`,
  );
}
