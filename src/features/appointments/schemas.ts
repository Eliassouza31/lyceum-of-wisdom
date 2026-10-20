import { z } from "zod";

import { isLocalDate, isLocalTime, zonedTimeToUtc } from "@/lib/time";

/** Lengths offered in the form, in minutes. */
export const DURATION_OPTIONS = [
  15, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300, 360, 480,
] as const;

const MAX_DURATION_MINUTES = 24 * 60;
// Catches typos such as 2062 instead of 2026.
const MAX_DAYS_AHEAD = 2 * 366;
const MAX_DAYS_BEHIND = 366;
const DAY_MS = 24 * 60 * 60 * 1000;

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => value || null);

/**
 * Validates the appointment form. Date and time are typed in the business's
 * time zone and come out as UTC instants.
 */
export function appointmentSchema(timeZone: string, now: Date = new Date()) {
  return z
    .object({
      clientId: z.uuid("Choose a client."),
      title: z
        .string()
        .trim()
        .min(1, "Enter what the appointment is for.")
        .max(120, "Title is too long."),
      date: z
        .string()
        .trim()
        .refine(isLocalDate, "Choose a valid date.")
        .refine((value) => {
          const day = new Date(`${value}T12:00:00Z`).getTime();
          return (
            day >= now.getTime() - MAX_DAYS_BEHIND * DAY_MS &&
            day <= now.getTime() + MAX_DAYS_AHEAD * DAY_MS
          );
        }, "Choose a date within the next two years."),
      startTime: z.string().trim().refine(isLocalTime, "Choose a start time."),
      duration: z.coerce
        .number("Choose how long it takes.")
        .int("Choose how long it takes.")
        .min(5, "Choose how long it takes.")
        .max(MAX_DURATION_MINUTES, "Appointments can last up to 24 hours."),
      location: optionalText(200, "Location is too long."),
      notes: optionalText(1000, "Notes are too long (1,000 characters max)."),
    })
    .transform((values, context) => {
      const startsAt = zonedTimeToUtc(values.date, values.startTime, timeZone);
      if (!startsAt) {
        context.addIssue({
          code: "custom",
          path: ["startTime"],
          message:
            "This time does not exist on that day because the clocks move forward. Choose another time.",
        });
        return z.NEVER;
      }
      return {
        clientId: values.clientId,
        title: values.title,
        startsAt,
        endsAt: new Date(startsAt.getTime() + values.duration * 60_000),
        location: values.location,
        notes: values.notes,
      };
    });
}

export type AppointmentInput = z.output<ReturnType<typeof appointmentSchema>>;

/** Fields echoed back to the form after a failed submit. */
export const APPOINTMENT_FORM_FIELDS = [
  "clientId",
  "title",
  "date",
  "startTime",
  "duration",
  "location",
  "notes",
] as const;

export const APPOINTMENT_STATUSES = [
  "scheduled",
  "cancelled",
  "completed",
  "no_show",
] as const;

export const appointmentStatusSchema = z.enum(APPOINTMENT_STATUSES);
