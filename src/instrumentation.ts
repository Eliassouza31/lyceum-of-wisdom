import * as Sentry from "@sentry/nextjs";

import { sentryOptions } from "@/lib/sentry";

export function register() {
  Sentry.init(sentryOptions());
}

// Errors thrown while rendering pages, in Server Actions and in API routes.
export const onRequestError = Sentry.captureRequestError;
