import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { CenteredCard, FormSkeleton } from "@/components/layout/centered-card";
import { OnboardingForm } from "@/features/business/components/onboarding-form";
import { getSessionContext } from "@/features/business/queries";

export const metadata: Metadata = { title: "Set up your business" };

async function OnboardingGate() {
  const context = await getSessionContext();
  if (!context) redirect("/login?next=/onboarding");
  if (context.business) redirect("/dashboard");
  return <OnboardingForm />;
}

export default function OnboardingPage() {
  return (
    <CenteredCard
      title="Set up your business"
      description="Just two details and you're ready to add clients and appointments."
    >
      <Suspense fallback={<FormSkeleton />}>
        <OnboardingGate />
      </Suspense>
    </CenteredCard>
  );
}
