"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/** A one-button form that asks for confirmation before running its action. */
export function ConfirmActionButton({
  action,
  label,
  confirmMessage,
  danger = false,
}: {
  action: () => Promise<void>;
  label: string;
  confirmMessage?: string;
  danger?: boolean;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      <Button
        type="submit"
        variant="secondary"
        className={cn(
          "w-full sm:w-auto",
          danger && "text-red-700 dark:text-red-400",
        )}
      >
        {label}
      </Button>
    </form>
  );
}
