import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

const controlClasses =
  "block w-full rounded-lg border-0 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 aria-invalid:ring-red-500 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-700";

type FieldShellProps = {
  id: string;
  label: string;
  errors?: string[];
  hint?: ReactNode;
  children: (describedBy: string | undefined) => ReactNode;
};

function FieldShell({ id, label, errors, hint, children }: FieldShellProps) {
  const errorId = errors?.length ? `${id}-error` : undefined;
  const hintId = hint ? `${id}-hint` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
      >
        {label}
      </label>
      {children(describedBy)}
      {hint && !errors?.length ? (
        <p id={hintId} className="text-xs text-zinc-500 dark:text-zinc-400">
          {hint}
        </p>
      ) : null}
      {errors?.length ? (
        <p id={errorId} className="text-sm text-red-600 dark:text-red-400">
          {errors[0]}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({
  id,
  label,
  errors,
  hint,
  className,
  ...props
}: ComponentProps<"input"> & {
  id: string;
  label: string;
  errors?: string[];
  hint?: ReactNode;
}) {
  return (
    <FieldShell id={id} label={label} errors={errors} hint={hint}>
      {(describedBy) => (
        <input
          id={id}
          name={id}
          aria-invalid={errors?.length ? true : undefined}
          aria-describedby={describedBy}
          className={cn(controlClasses, className)}
          {...props}
        />
      )}
    </FieldShell>
  );
}

export function SelectField({
  id,
  label,
  errors,
  hint,
  className,
  children,
  ...props
}: ComponentProps<"select"> & {
  id: string;
  label: string;
  errors?: string[];
  hint?: ReactNode;
}) {
  return (
    <FieldShell id={id} label={label} errors={errors} hint={hint}>
      {(describedBy) => (
        <select
          id={id}
          name={id}
          aria-invalid={errors?.length ? true : undefined}
          aria-describedby={describedBy}
          className={cn(controlClasses, className)}
          {...props}
        >
          {children}
        </select>
      )}
    </FieldShell>
  );
}

export function TextAreaField({
  id,
  label,
  errors,
  hint,
  className,
  ...props
}: ComponentProps<"textarea"> & {
  id: string;
  label: string;
  errors?: string[];
  hint?: ReactNode;
}) {
  return (
    <FieldShell id={id} label={label} errors={errors} hint={hint}>
      {(describedBy) => (
        <textarea
          id={id}
          name={id}
          aria-invalid={errors?.length ? true : undefined}
          aria-describedby={describedBy}
          className={cn(controlClasses, "min-h-24", className)}
          {...props}
        />
      )}
    </FieldShell>
  );
}

export function CheckboxField({
  id,
  label,
  errors,
  hint,
  ...props
}: Omit<ComponentProps<"input">, "type"> & {
  id: string;
  label: string;
  errors?: string[];
  hint?: ReactNode;
}) {
  const errorId = errors?.length ? `${id}-error` : undefined;
  const hintId = hint ? `${id}-hint` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex gap-3">
      <input
        id={id}
        name={id}
        type="checkbox"
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={describedBy}
        className="mt-0.5 size-4 shrink-0 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-600 dark:border-zinc-700 dark:bg-zinc-900"
        {...props}
      />
      <div className="space-y-1">
        <label
          htmlFor={id}
          className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          {label}
        </label>
        {hint ? (
          <p id={hintId} className="text-xs text-zinc-500 dark:text-zinc-400">
            {hint}
          </p>
        ) : null}
        {errors?.length ? (
          <p id={errorId} className="text-sm text-red-600 dark:text-red-400">
            {errors[0]}
          </p>
        ) : null}
      </div>
    </div>
  );
}
