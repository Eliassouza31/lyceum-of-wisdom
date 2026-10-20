"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialFormState } from "@/lib/forms";

import { signUpAction } from "../actions";
import { PASSWORD_MIN_LENGTH } from "../schemas";

export function SignUpForm() {
  const [state, formAction] = useActionState(signUpAction, initialFormState);

  if (state.status === "success") {
    return (
      <div className="space-y-4">
        <Alert tone="success">{state.message}</Alert>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Didn&apos;t get it? Check your spam folder, or{" "}
          <Link
            href="/signup"
            className="font-medium text-indigo-600 dark:text-indigo-400"
          >
            try again
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.status === "error" && state.message ? (
        <Alert tone="error">{state.message}</Alert>
      ) : null}
      <TextField
        id="fullName"
        label="Full name"
        autoComplete="name"
        required
        defaultValue={state.values?.fullName}
        errors={state.fieldErrors?.fullName}
      />
      <TextField
        id="email"
        label="Work email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        errors={state.fieldErrors?.email}
      />
      <TextField
        id="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        required
        minLength={PASSWORD_MIN_LENGTH}
        hint={`At least ${PASSWORD_MIN_LENGTH} characters, with letters and numbers.`}
        errors={state.fieldErrors?.password}
      />
      <SubmitButton pendingLabel="Creating account…" className="w-full">
        Create account
      </SubmitButton>
      <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
        By creating an account you agree to our Terms of Service and Privacy
        Policy.
      </p>
    </form>
  );
}
