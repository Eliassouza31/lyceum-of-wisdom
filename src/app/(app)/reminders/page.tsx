import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Suspense } from "react";

import { Alert } from "@/components/ui/alert";
import { ConfirmActionButton } from "@/features/appointments/components/confirm-action-button";
import { requireBusinessContext } from "@/features/business/queries";
import {
  addRuleAction,
  deleteRuleAction,
  resetTemplateAction,
  saveSenderAction,
  saveTemplateAction,
  setRuleActiveAction,
} from "@/features/reminders/actions";
import { ReminderBadge } from "@/features/reminders/components/reminder-badge";
import {
  RuleForm,
  SenderForm,
  TemplateForm,
} from "@/features/reminders/components/reminder-forms";
import { formatOffset, MAX_RULES } from "@/features/reminders/offsets";
import { getReminderSettings } from "@/features/reminders/queries";
import {
  buildReminderEmail,
  DEFAULT_TEMPLATE,
  sampleValues,
  TEMPLATE_VARIABLES,
} from "@/features/reminders/templates";

export const metadata: Metadata = { title: "Reminders" };

const SAVED_MESSAGES: Record<string, string> = {
  rule_added: "Reminder added. Upcoming appointments will get it too.",
  rule_on: "Reminder turned on.",
  rule_off: "Reminder paused. Scheduled emails for it were cancelled.",
  rule_deleted: "Reminder deleted.",
  template: "Message saved.",
  template_reset: "Message reset to the default.",
  sender: "Sender details saved.",
};

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
      <div>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

async function RemindersContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ business }, settings, params] = await Promise.all([
    requireBusinessContext(),
    getReminderSettings(),
    searchParams,
  ]);
  const saved = typeof params.saved === "string" ? params.saved : undefined;
  const template = settings.template ?? DEFAULT_TEMPLATE;
  const preview = buildReminderEmail({
    ...template,
    values: sampleValues(business.name),
    businessName: business.name,
    postalAddress: settings.postalAddress ?? "Your mailing address",
    unsubscribeUrl: "(unsubscribe link)",
  });
  const activeRules = settings.rules.filter((rule) => rule.is_active);

  return (
    <>
      {saved && SAVED_MESSAGES[saved] ? (
        <Alert tone="success">{SAVED_MESSAGES[saved]}</Alert>
      ) : null}
      {!settings.emailConfigured ? (
        <Alert tone="info">
          Email sending is not connected yet, so reminders wait in the queue.
          They go out once the email service is set up.
        </Alert>
      ) : null}
      {!settings.postalAddress ? (
        <Alert tone="error">
          Add your business mailing address below. Reminders are not sent
          without it.
        </Alert>
      ) : null}
      {!settings.canEdit ? (
        <Alert tone="info">
          Only the business owner or an admin can change these settings.
        </Alert>
      ) : null}

      <Section
        title="When to send"
        description={
          <>
            Each scheduled appointment gets one email per active reminder, if
            the client agreed to email reminders. Times are exact: “1 day
            before” is 24 hours before, even on daylight saving weekends.
          </>
        }
      >
        {settings.rules.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No reminders yet. Add one below.
          </p>
        ) : (
          <ul
            aria-label="Reminder times"
            className="divide-y divide-zinc-200 rounded-xl ring-1 ring-zinc-200 dark:divide-zinc-800 dark:ring-zinc-800"
          >
            {settings.rules.map((rule) => (
              <li
                key={rule.id}
                className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    Email {formatOffset(rule.offset_minutes)}
                  </span>
                  <ReminderBadge
                    label={rule.is_active ? "On" : "Paused"}
                    tone={rule.is_active ? "success" : "neutral"}
                  />
                </div>
                {settings.canEdit ? (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <ConfirmActionButton
                      action={setRuleActiveAction.bind(
                        null,
                        rule.id,
                        !rule.is_active,
                      )}
                      label={rule.is_active ? "Pause" : "Turn on"}
                    />
                    <ConfirmActionButton
                      action={deleteRuleAction.bind(null, rule.id)}
                      label="Delete"
                      confirmMessage={`Delete the reminder “${formatOffset(rule.offset_minutes)}”?`}
                      danger
                    />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {settings.canEdit && settings.rules.length < MAX_RULES ? (
          <RuleForm action={addRuleAction} />
        ) : null}
        {activeRules.length === 0 && settings.rules.length > 0 ? (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            All reminders are paused: no emails will be sent.
          </p>
        ) : null}
      </Section>

      <Section
        title="Message"
        description="Words in double braces are filled in for each appointment."
      >
        <ul className="grid gap-1 text-xs text-zinc-600 sm:grid-cols-2 dark:text-zinc-400">
          {Object.entries(TEMPLATE_VARIABLES).map(([name, description]) => (
            <li key={name}>
              <code className="rounded bg-zinc-100 px-1 py-0.5 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                {`{{${name}}}`}
              </code>{" "}
              {description}
            </li>
          ))}
        </ul>
        <TemplateForm
          action={saveTemplateAction}
          defaults={template}
          disabled={!settings.canEdit}
        />
        {settings.template && settings.canEdit ? (
          <ConfirmActionButton
            action={resetTemplateAction}
            label="Reset to default message"
            confirmMessage="Replace your message with the default one?"
          />
        ) : null}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Preview
          </h3>
          <div
            data-testid="template-preview"
            className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-800 ring-1 ring-zinc-200 dark:bg-zinc-950 dark:text-zinc-200 dark:ring-zinc-800"
          >
            <p className="font-semibold">{preview.subject}</p>
            <p className="mt-3 whitespace-pre-line">{preview.text}</p>
          </div>
        </div>
      </Section>

      <Section
        title="Sender details"
        description={
          <>Reminders are sent in your business’s name ({business.name}).</>
        }
      >
        <SenderForm
          action={saveSenderAction}
          defaults={{
            contactEmail: settings.contactEmail ?? "",
            postalAddress: settings.postalAddress ?? "",
          }}
          disabled={!settings.canEdit}
        />
      </Section>
    </>
  );
}

function SettingsSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-label="Loading reminders">
      <div className="h-48 rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
      <div className="h-96 rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
    </div>
  );
}

export default function RemindersPage({
  searchParams,
}: PageProps<"/reminders">) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Reminders
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Automatic emails that remind clients of their appointments.
          </p>
        </div>
        <Link
          href="/notifications"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
        >
          History →
        </Link>
      </div>
      <Suspense fallback={<SettingsSkeleton />}>
        <RemindersContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
