"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialFormState } from "@/lib/forms";

import { signInAction } from "../actions";

export function SignInForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState(signInAction, initialFormState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.status === "error" && state.message ? (
        <Alert tone="error">{state.message}</Alert>
      ) : null}
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <TextField
        id="email"
        label="Email"
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
        autoComplete="current-password"
        required
        errors={state.fieldErrors?.password}
      />
      <div className="flex justify-end">
        <Link
          href="/forgot-password"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
        >
          Forgot password?
        </Link>
      </div>
      <SubmitButton pendingLabel="Signing in…" className="w-full">
        Sign in
      </SubmitButton>
    </form>
  );
}
