"use client";

import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "./button";
import { Spinner } from "./spinner";

/** Submit button that disables itself and shows a spinner while its form is pending. */
export function SubmitButton({
  children,
  pendingLabel,
  className,
  variant,
}: {
  children: ReactNode;
  pendingLabel: string;
  className?: string;
  variant?: ComponentProps<typeof Button>["variant"];
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={className}
      variant={variant}
    >
      {pending ? (
        <>
          <Spinner />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
