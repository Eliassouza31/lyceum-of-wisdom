import type { Database } from "@/types/database.types";

export type ReminderJobStatus =
  Database["public"]["Enums"]["reminder_job_status"];
export type NotificationEventType =
  Database["public"]["Enums"]["notification_event_type"];

export type ReminderTone = "neutral" | "info" | "success" | "warning" | "error";

export const SKIP_REASON_LABELS: Record<string, string> = {
  too_late: "The appointment was booked after this reminder's time.",
  appointment_passed: "The appointment had already started.",
  client_removed: "The client was removed.",
  no_consent: "The client has no email or has not agreed to email reminders.",
  suppressed:
    "This address is blocked: an earlier email bounced or was marked as spam.",
  missing_postal_address:
    "Your business mailing address is missing. Add it on the Reminders page.",
};

/**
 * What a reminder looks like to the business: its own status, refined by the
 * latest word from the email provider (delivered, bounced, spam).
 */
export function reminderState(job: {
  status: ReminderJobStatus;
  next_attempt_at: string | null;
  deliveryEvent?: NotificationEventType | null;
}): { label: string; tone: ReminderTone } {
  switch (job.status) {
    case "pending":
      return { label: "Queued", tone: "info" };
    case "processing":
      return { label: "Sending", tone: "info" };
    case "sent":
      if (job.deliveryEvent === "delivered") {
        return { label: "Delivered", tone: "success" };
      }
      if (job.deliveryEvent === "bounced") {
        return { label: "Bounced", tone: "error" };
      }
      if (job.deliveryEvent === "complained") {
        return { label: "Marked as spam", tone: "error" };
      }
      return { label: "Sent", tone: "success" };
    case "failed":
      return job.next_attempt_at
        ? { label: "Will retry", tone: "warning" }
        : { label: "Failed", tone: "error" };
    case "cancelled":
      return { label: "Cancelled", tone: "neutral" };
    case "skipped":
      return { label: "Not sent", tone: "neutral" };
  }
}

const DELIVERY_EVENTS: readonly NotificationEventType[] = [
  "delivered",
  "bounced",
  "complained",
];

/** The most recent delivery event, if the provider reported any. */
export function latestDeliveryEvent(
  events: { event: NotificationEventType; created_at: string }[],
): NotificationEventType | null {
  let latest: { event: NotificationEventType; created_at: string } | null =
    null;
  for (const item of events) {
    if (!DELIVERY_EVENTS.includes(item.event)) continue;
    if (!latest || item.created_at > latest.created_at) latest = item;
  }
  return latest?.event ?? null;
}

/** The sentence under a reminder explaining why it was not (yet) sent. */
export function reminderNote(job: {
  status: ReminderJobStatus;
  skip_reason: string | null;
  last_error: string | null;
}): string | null {
  if (job.status === "skipped" && job.skip_reason) {
    return SKIP_REASON_LABELS[job.skip_reason] ?? job.skip_reason;
  }
  if (job.status === "failed" && job.last_error) return job.last_error;
  return null;
}
