import { z } from "zod";

import {
  MAX_OFFSET_MINUTES,
  MIN_OFFSET_MINUTES,
  OFFSET_UNITS,
  toOffsetMinutes,
  type OffsetUnit,
} from "./offsets";
import { TEMPLATE_VARIABLES, unknownVariables } from "./templates";

export const RULE_FORM_FIELDS = ["amount", "unit"] as const;
export const TEMPLATE_FORM_FIELDS = ["subject", "body"] as const;
export const SENDER_FORM_FIELDS = ["contactEmail", "postalAddress"] as const;

const unitSchema = z.enum(
  Object.keys(OFFSET_UNITS) as [OffsetUnit, ...OffsetUnit[]],
  "Choose minutes, hours or days.",
);

export const ruleSchema = z
  .object({
    amount: z.coerce
      .number("Enter a number.")
      .int("Enter a whole number.")
      .positive("Enter a number greater than zero."),
    unit: unitSchema,
  })
  .transform(({ amount, unit }) => toOffsetMinutes(amount, unit))
  .refine(
    (minutes) => minutes >= MIN_OFFSET_MINUTES && minutes <= MAX_OFFSET_MINUTES,
    {
      message: "Choose a time between 15 minutes and 14 days.",
      path: ["amount"],
    },
  );

function withKnownVariables(field: string) {
  return (text: string, context: z.RefinementCtx) => {
    const unknown = unknownVariables(text);
    if (unknown.length > 0) {
      context.addIssue({
        code: "custom",
        message: `Unknown ${unknown.length === 1 ? "variable" : "variables"}: ${unknown
          .map((name) => `{{${name}}}`)
          .join(", ")}. Use only: ${Object.keys(TEMPLATE_VARIABLES)
          .map((name) => `{{${name}}}`)
          .join(", ")}.`,
        path: [field],
      });
    }
  };
}

export const templateSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(1, "Enter a subject.")
    .max(150, "The subject is too long (150 characters at most).")
    .refine((value) => !/[\r\n]/.test(value), "Keep the subject on one line.")
    .superRefine(withKnownVariables("subject")),
  body: z
    .string()
    .trim()
    .min(1, "Enter the message.")
    .max(2000, "The message is too long (2,000 characters at most).")
    .superRefine(withKnownVariables("body")),
});

export const senderSchema = z.object({
  contactEmail: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "This email is too long.")
    .transform((value) => value || null)
    .pipe(z.email("Enter a valid email address.").nullable()),
  postalAddress: z
    .string()
    .trim()
    .min(5, "Enter your business's mailing address.")
    .max(300, "This address is too long."),
});

export type SenderInput = z.infer<typeof senderSchema>;
