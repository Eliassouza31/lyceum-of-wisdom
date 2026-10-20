"use client";

import { Button } from "@/components/ui/button";

export function DeleteClientButton({
  action,
  clientName,
}: {
  action: () => Promise<void>;
  clientName: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (
          !window.confirm(
            `Remove ${clientName}? They will no longer appear in your client list.`,
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <Button
        type="submit"
        variant="secondary"
        className="text-red-700 dark:text-red-400"
      >
        Remove client
      </Button>
    </form>
  );
}
