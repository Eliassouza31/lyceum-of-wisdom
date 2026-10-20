import type { Metadata } from "next";

import { CenteredCard } from "@/components/layout/centered-card";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";

export const metadata: Metadata = { title: "Choose a new password" };

// Reached through the emailed reset link, which signs the user in first.
// The proxy sends visitors without a session to /login.
export default function ResetPasswordPage() {
  return (
    <CenteredCard
      title="Choose a new password"
      description="Pick a password you don't use anywhere else."
    >
      <ResetPasswordForm />
    </CenteredCard>
  );
}
