import type { Metadata } from "next";
import { Suspense } from "react";

import { CenteredCard, FormSkeleton } from "@/components/layout/centered-card";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { unsubscribeAction } from "@/features/reminders/unsubscribe-actions";
import {
  getUnsubscribeInfo,
  parseUnsubscribeToken,
} from "@/features/reminders/unsubscribe";

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false },
};

async function UnsubscribeContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const token = parseUnsubscribeToken(params.token);
  const info = token ? await getUnsubscribeInfo(token) : null;

  if (!token || !info) {
    return (
      <Alert tone="error">
        This unsubscribe link is not valid. If you keep getting reminders you do
        not want, reply to one of them and ask the business to stop.
      </Alert>
    );
  }

  if (!info.subscribed) {
    return (
      <Alert tone="success">
        {params.done === "1" ? "Done. " : null}You will no longer receive email
        reminders from {info.businessName}.
      </Alert>
    );
  }

  return (
    <form action={unsubscribeAction.bind(null, token)} className="space-y-5">
      <p className="text-sm text-zinc-700 dark:text-zinc-300">
        Stop receiving appointment reminder emails from{" "}
        <strong>{info.businessName}</strong>?
      </p>
      <SubmitButton pendingLabel="Unsubscribing…" className="w-full">
        Unsubscribe
      </SubmitButton>
    </form>
  );
}

// A button (not the link itself) unsubscribes, so link scanners in mail
// programs that open every link cannot unsubscribe people by accident.
export default function UnsubscribePage({
  searchParams,
}: PageProps<"/unsubscribe">) {
  return (
    <CenteredCard title="Email reminders">
      <Suspense fallback={<FormSkeleton fields={0} />}>
        <UnsubscribeContent searchParams={searchParams} />
      </Suspense>
    </CenteredCard>
  );
}
