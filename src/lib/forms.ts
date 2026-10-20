import type { z } from "zod";

/** State returned by Server Actions to the forms that call them. */
export type FormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[]>;
  /** Echo of non-secret inputs, so a failed submit does not clear the form. */
  values?: Record<string, string>;
};

export const initialFormState: FormState = { status: "idle" };

export function formDataToObject(formData: FormData): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") result[key] = value;
  }
  return result;
}

export function validationError(
  error: z.ZodError,
  values: Record<string, string> = {},
): FormState {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return {
    status: "error",
    message: "Please fix the highlighted fields.",
    fieldErrors,
    values,
  };
}

/** Keeps only the listed keys, so passwords are never echoed back to the browser. */
export function pick(
  values: Record<string, string>,
  keys: readonly string[],
): Record<string, string> {
  return Object.fromEntries(
    keys.filter((key) => key in values).map((key) => [key, values[key] ?? ""]),
  );
}
