import { z } from "zod";

import { isUsTimezone } from "./timezones";

export const createBusinessSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter your business name.")
    .max(100, "Business name is too long."),
  timezone: z.string().refine(isUsTimezone, "Choose your business time zone."),
});
