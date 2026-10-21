import "server-only";

import { requireBusinessContext } from "@/features/business/queries";
import { logger } from "@/lib/logger";
import { getServerEnv } from "@/lib/server-env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { monthStartIn } from "@/lib/time";
import type { Database } from "@/types/database.types";

import {
  latestDeliveryEvent,
  type NotificationEventType,
  type ReminderJobStatus,
} from "./format";

export const HISTORY_PAGE_SIZE = 25;

type RuleRow = Database["public"]["Tables"]["reminder_rules"]["Row"];
export type ReminderRule = Pick<RuleRow, "id" | "offset_minutes" | "is_active">;

export type ReminderSettings = {
  rules: ReminderRule[];
  template: { subject: string; body: string } | null;
  contactEmail: string | null;
  postalAddress: string | null;
  canEdit: boolean;
  /** Both server secrets the sender needs are set. */
  emailConfigured: boolean;
};

export type ReminderJobSummary = {
  id: string;
  status: ReminderJobStatus;
  send_at: string;
  sent_at: string | null;
  next_attempt_at: string | null;
  offset_minutes: number;
  skip_reason: string | null;
  last_error: string | null;
  deliveryEvent: NotificationEventType | null;
};

export type HistoryItem = ReminderJobSummary & {
  appointment: {
    id: string;
    title: string;
    starts_at: string;
    client: { id: string; first_name: string; last_name: string };
  };
};

const JOB_COLUMNS =
  "id, status, send_at, sent_at, next_attempt_at, offset_minutes, skip_reason, last_error, events:notification_events (event, created_at)";

function loadFailed(event: string, message: string): never {
  logger.error(event, { message });
  throw new Error("Could not load your reminders. Please try again.");
}

function withDelivery<
  T extends { events: { event: NotificationEventType; created_at: string }[] },
>({ events, ...job }: T) {
  return { ...job, deliveryEvent: latestDeliveryEvent(events) };
}

export async function getReminderSettings(): Promise<ReminderSettings> {
  const { business } = await requireBusinessContext();
  const supabase = await createSupabaseServerClient();
  const [rules, template, details] = await Promise.all([
    supabase
      .from("reminder_rules")
      .select("id, offset_minutes, is_active")
      .eq("business_id", business.id)
      .order("offset_minutes", { ascending: false }),
    supabase
      .from("message_templates")
      .select("subject, body")
      .eq("business_id", business.id)
      .eq("channel", "email")
      .maybeSingle(),
    supabase
      .from("businesses")
      .select("contact_email, postal_address")
      .eq("id", business.id)
      .single(),
  ]);
  const error = rules.error ?? template.error ?? details.error;
  if (error) loadFailed("reminders.settings_failed", error.message);

  const env = getServerEnv();
  return {
    rules: rules.data ?? [],
    template: template.data,
    contactEmail: details.data?.contact_email ?? null,
    postalAddress: details.data?.postal_address ?? null,
    canEdit: business.role === "owner" || business.role === "admin",
    emailConfigured: Boolean(env.RESEND_API_KEY && env.SUPABASE_SECRET_KEY),
  };
}

/** Every reminder of the business, latest first, one page at a time. */
export async function listReminderHistory(
  page: number,
): Promise<{ items: HistoryItem[]; total: number }> {
  const { business } = await requireBusinessContext();
  const supabase = await createSupabaseServerClient();
  const from = (page - 1) * HISTORY_PAGE_SIZE;
  const { data, count, error } = await supabase
    .from("reminder_jobs")
    .select(
      `${JOB_COLUMNS}, appointment:appointments!inner (id, title, starts_at, client:clients!inner (id, first_name, last_name))`,
      { count: "exact" },
    )
    .eq("business_id", business.id)
    .order("send_at", { ascending: false })
    .order("id", { ascending: true })
    .range(from, from + HISTORY_PAGE_SIZE - 1);

  if (error) loadFailed("reminders.history_failed", error.message);
  return { items: data.map(withDelivery), total: count ?? 0 };
}

/** The reminders of one appointment, soonest first. */
export async function listAppointmentReminders(
  appointmentId: string,
): Promise<ReminderJobSummary[]> {
  const { business } = await requireBusinessContext();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("reminder_jobs")
    .select(JOB_COLUMNS)
    .eq("business_id", business.id)
    .eq("appointment_id", appointmentId)
    .order("send_at", { ascending: true });

  if (error) loadFailed("reminders.appointment_failed", error.message);
  return data.map(withDelivery);
}

/** Reminder emails sent in the current month (business time zone). */
export async function getMonthlyEmailCount(): Promise<number> {
  const { business } = await requireBusinessContext();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("usage_counters")
    .select("emails_sent")
    .eq("business_id", business.id)
    .eq("period_start", monthStartIn(business.timezone))
    .maybeSingle();
  if (error) loadFailed("reminders.usage_failed", error.message);
  return data?.emails_sent ?? 0;
}
