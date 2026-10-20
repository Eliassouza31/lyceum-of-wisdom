import type { Metadata } from "next";
import Link from "next/link";

import { CenteredCard } from "@/components/layout/centered-card";
import { SignUpForm } from "@/features/auth/components/sign-up-form";

export const metadata: Metadata = { title: "Create your account" };

export default function SignUpPage() {
  return (
    <CenteredCard
      title="Create your account"
      description="Start your 14-day free trial. No credit card required."
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            Sign in
          </Link>
        </>
      }
    >
      <SignUpForm />
    </CenteredCard>
  );
}
