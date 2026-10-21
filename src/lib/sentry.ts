import type { ErrorEvent } from "@sentry/nextjs";

// Unsubscribe links carry a token that works without signing in.
const SECRET_QUERY = /([?&](?:token|code|token_hash)=)[^&#\s]*/gi;
const SECRET_HEADER = /^(authorization|cookie|x-forwarded-for|x-real-ip)$/i;

export function scrubUrl(value: string): string {
  return value.replace(SECRET_QUERY, "$1[REDACTED]");
}

/** Removes cookies, auth headers, IPs and link tokens before an event leaves the app. */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  const request = event.request;
  if (request) {
    delete request.cookies;
    if (request.url) request.url = scrubUrl(request.url);
    if (typeof request.query_string === "string") {
      request.query_string = scrubUrl(`?${request.query_string}`).slice(1);
    } else if (request.query_string) {
      request.query_string = "[REDACTED]";
    }
    if (request.headers) {
      request.headers = Object.fromEntries(
        Object.entries(request.headers).filter(
          ([key]) => !SECRET_HEADER.test(key),
        ),
      );
    }
  }
  if (event.user) event.user = { id: event.user.id };
  for (const breadcrumb of event.breadcrumbs ?? []) {
    const url = breadcrumb.data?.url;
    if (typeof url === "string") breadcrumb.data!.url = scrubUrl(url);
    if (breadcrumb.message) breadcrumb.message = scrubUrl(breadcrumb.message);
  }
  return event;
}

/**
 * Shared Sentry settings for the browser and the server. Without
 * NEXT_PUBLIC_SENTRY_DSN (local development, CI) Sentry stays off.
 * Errors only: no performance tracing or session replays.
 */
export function sentryOptions() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  return {
    dsn,
    enabled: Boolean(dsn),
    environment:
      process.env.NEXT_PUBLIC_VERCEL_ENV ??
      process.env.VERCEL_ENV ??
      process.env.NODE_ENV,
    sendDefaultPii: false,
    beforeSend: scrubEvent,
  };
}
