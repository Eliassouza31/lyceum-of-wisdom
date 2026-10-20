import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger";
import { formatTime, zoneName } from "@/lib/time";
import type { Database } from "@/types/database.types";

import { formatSender, type SendEmail } from "./resend";
import { buildReminderEmail, DEFAULT_TEMPLATE } from "./templates";

type AdminClient = SupabaseClient<Database>;
type ClaimedRow =
  Database["public"]["Functions"]["claim_due_reminder_jobs"]["Returns"][number];
// The generated types cannot tell which returned columns may be null.
type NullableColumns =
  | "appointment_location"
  | "business_contact_email"
  | "template_subject"
  | "template_body";
export type ClaimedJob = Omit<ClaimedRow, NullableColumns> & {
  [Column in NullableColumns]: string | null;
};

export type DispatchOptions = {
  db: AdminClient;
  send: SendEmail;
  appUrl: string;
  fromAddress: string;
  limit?: number;
  /** Stop starting new sends after this many milliseconds. */
  budgetMs?: number;
  now?: () => number;
};

export type DispatchSummary = {
  claimed: number;
  sent: number;
  failed: number;
};

export function unsubscribeUrls(appUrl: string, token: string) {
  const query = `token=${encodeURIComponent(token)}`;
  return {
    page: `${appUrl}/unsubscribe?${query}`,
    oneClick: `${appUrl}/api/unsubscribe?${query}`,
  };
}

/** Everything Resend needs for one claimed job. Pure, so it is easy to test. */
export function composeReminder(
  job: ClaimedJob,
  { appUrl, fromAddress }: { appUrl: string; fromAddress: string },
) {
  const timeZone = job.business_timezone;
  const startsAt = new Date(job.appointment_starts_at);
  const zone = zoneName(startsAt, timeZone);
  const links = unsubscribeUrls(appUrl, job.unsubscribe_token);

  const email = buildReminderEmail({
    subject: job.template_subject ?? DEFAULT_TEMPLATE.subject,
    body: job.template_body ?? DEFAULT_TEMPLATE.body,
    values: {
      client_first_name: job.client_first_name,
      appointment_title: job.appointment_title,
      appointment_date: new Intl.DateTimeFormat("en-US", {
        dateStyle: "full",
        timeZone,
      }).format(startsAt),
      appointment_time: [formatTime(job.appointment_starts_at, timeZone), zone]
        .filter(Boolean)
        .join(" "),
      business_name: job.business_name,
      location: job.appointment_location ?? "",
    },
    businessName: job.business_name,
    postalAddress: job.business_postal_address,
    unsubscribeUrl: links.page,
  });

  return {
    from: formatSender(job.business_name, fromAddress),
    to: job.client_email,
    replyTo: job.business_contact_email,
    ...email,
    headers: {
      // Lets Gmail and others show their own one-click "Unsubscribe" button.
      "List-Unsubscribe": `<${links.oneClick}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    // Same job and same send time → same key, so a retry never sends twice.
    idempotencyKey: `reminder-${job.job_id}-${new Date(job.send_at).getTime()}`,
  };
}

/**
 * One run of the reminder engine: claim the due jobs, send each one and
 * record the outcome. Safe to run in parallel: the database hands every job
 * to one run only, and Resend drops repeats of the same idempotency key.
 */
export async function runDispatch({
  db,
  send,
  appUrl,
  fromAddress,
  limit = 20,
  budgetMs = 45_000,
  now = Date.now,
}: DispatchOptions): Promise<DispatchSummary> {
  const startedAt = now();
  const { data: jobs, error } = await db.rpc("claim_due_reminder_jobs", {
    p_limit: limit,
  });
  if (error) throw new Error(`Could not claim reminder jobs: ${error.message}`);

  const claimed = jobs as ClaimedJob[];
  const summary: DispatchSummary = {
    claimed: claimed.length,
    sent: 0,
    failed: 0,
  };

  for (const job of claimed) {
    // Out of time: the remaining jobs go back to the queue after 10 minutes.
    if (now() - startedAt > budgetMs) break;

    let result: Awaited<ReturnType<SendEmail>>;
    try {
      result = await send(composeReminder(job, { appUrl, fromAddress }));
    } catch (sendError) {
      result = {
        ok: false,
        error:
          sendError instanceof Error ? sendError.message : String(sendError),
        permanent: false,
      };
    }

    if (result.ok) {
      summary.sent += 1;
      const { error: saveError } = await db.rpc("complete_reminder_job", {
        p_job_id: job.job_id,
        p_provider_message_id: result.id,
      });
      if (saveError) {
        logger.error("reminders.complete_failed", {
          jobId: job.job_id,
          message: saveError.message,
        });
      }
    } else {
      summary.failed += 1;
      logger.warn("reminders.send_failed", {
        jobId: job.job_id,
        attempts: job.attempts,
        permanent: result.permanent,
        error: result.error,
      });
      const { error: saveError } = await db.rpc("fail_reminder_job", {
        p_job_id: job.job_id,
        p_error: result.error,
        p_permanent: result.permanent,
      });
      if (saveError) {
        logger.error("reminders.fail_record_failed", {
          jobId: job.job_id,
          message: saveError.message,
        });
      }
    }
  }

  return summary;
}
