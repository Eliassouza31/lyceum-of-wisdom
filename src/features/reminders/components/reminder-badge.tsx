import { cn } from "@/lib/cn";

import type { ReminderTone } from "../format";

const tones: Record<ReminderTone, string> = {
  info: "bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:ring-indigo-900",
  success:
    "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900",
  warning:
    "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900",
  error:
    "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900",
  neutral:
    "bg-zinc-100 text-zinc-600 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700",
};

export function ReminderBadge({
  label,
  tone,
}: {
  label: string;
  tone: ReminderTone;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        tones[tone],
      )}
    >
      {label}
    </span>
  );
}
