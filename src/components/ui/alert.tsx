import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

const tones = {
  error:
    "bg-red-50 text-red-800 ring-red-200 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-900",
  success:
    "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900",
  warning:
    "bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900",
  info: "bg-indigo-50 text-indigo-800 ring-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-200 dark:ring-indigo-900",
} as const;

export function Alert({
  tone,
  children,
}: {
  tone: keyof typeof tones;
  children: ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-lg px-4 py-3 text-sm ring-1 ring-inset",
        tones[tone],
      )}
    >
      {children}
    </div>
  );
}
