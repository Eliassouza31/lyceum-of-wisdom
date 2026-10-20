import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Alert } from "@/components/ui/alert";
import { CenteredCard, FormSkeleton } from "@/components/layout/centered-card";
import { SignInForm } from "@/features/auth/components/sign-in-form";
import { safeNextPath } from "@/lib/auth/redirects";

export const metadata: Metadata = { title: "Sign in" };

const NOTICES: Record<string, { tone: "info" | "error"; text: string }> = {
  confirm_link_invalid: {
    tone: "info",
    text: "That confirmation link has expired or was already used. If you already confirmed your email, just sign in.",
  },
  reset_link_invalid: {
    tone: "error",
    text: "That password reset link has expired or was already used. Please request a new one.",
  },
};

async function SignInContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next =
    typeof params.next === "string" ? safeNextPath(params.next) : undefined;
  const notice =
    typeof params.notice === "string" ? NOTICES[params.notice] : undefined;

  return (
    <div className="space-y-5">
      {notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}
      <SignInForm next={next} />
    </div>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <CenteredCard
      title="Sign in to your account"
      description="Welcome back. Enter your details to continue."
      footer={
        <>
          New here?{" "}
          <Link
            href="/signup"
            className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            Create an account
          </Link>
        </>
      }
    >
      <Suspense fallback={<FormSkeleton />}>
        <SignInContent searchParams={searchParams} />
      </Suspense>
    </CenteredCard>
  );
}
