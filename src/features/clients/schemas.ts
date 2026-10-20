import { z } from "zod";

import { toE164 } from "@/lib/phone";

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => value || null);

export const clientSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(1, "Enter the client's first name.")
      .max(60, "First name is too long."),
    lastName: z.string().trim().max(60, "Last name is too long."),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(254, "Email is too long.")
      .pipe(z.union([z.literal(""), z.email("Enter a valid email address.")]))
      .transform((value) => value || null),
    phone: z
      .string()
      .trim()
      .transform((value, context) => {
        if (!value) return null;
        const e164 = toE164(value);
        if (!e164) {
          context.addIssue({
            code: "custom",
            message: "Enter a valid phone number, e.g. (555) 123-4567.",
          });
          return z.NEVER;
        }
        return e164;
      }),
    // An unchecked checkbox is simply missing from the form data.
    emailConsent: z
      .literal("on")
      .optional()
      .transform((value) => value === "on"),
    notes: optionalText(1000, "Notes are too long (1,000 characters max)."),
  })
  .refine((values) => !values.emailConsent || values.email, {
    message: "Add an email address to send reminders.",
    path: ["emailConsent"],
  });

export type ClientInput = z.infer<typeof clientSchema>;

/** Fields echoed back to the form after a failed submit. */
export const CLIENT_FORM_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "emailConsent",
  "notes",
] as const;
