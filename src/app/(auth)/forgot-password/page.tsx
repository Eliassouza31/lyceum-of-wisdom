import type { Metadata } from "next";
import Link from "next/link";

import { CenteredCard } from "@/components/layout/centered-card";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <CenteredCard
      title="Reset your password"
      description="Enter the email you signed up with and we'll send you a reset link."
      footer={
        <Link
          href="/login"
          className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
        >
          Back to sign in
        </Link>
      }
    >
      <ForgotPasswordForm />
    </CenteredCard>
  );
}
