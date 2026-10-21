import Link from "next/link";

import { Alert } from "@/components/ui/alert";
import { getSubscription } from "@/features/billing/queries";
import { billingNotice } from "@/lib/billing/plans";

/** Shown on every page while the trial is ending, a payment failed or reminders are paused. */
export async function BillingBanner() {
  const subscription = await getSubscription();
  const notice = subscription ? billingNotice(subscription) : null;
  if (!notice) return null;
  return (
    <div className="mb-6">
      <Alert tone={notice.tone}>
        {notice.message}{" "}
        <Link href="/billing" className="font-semibold underline">
          See plans
        </Link>
      </Alert>
    </div>
  );
}
