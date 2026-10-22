"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Last-resort screen when even the root layout fails. It renders its own
// document, so it cannot use the app's styles.
export default function GlobalError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          maxWidth: "28rem",
          margin: "4rem auto",
          padding: "0 1rem",
        }}
      >
        <title>Something went wrong</title>
        <h1 style={{ fontSize: "1.25rem" }}>Something went wrong</h1>
        <p>We were notified and are looking into it. Please try again.</p>
        <button type="button" onClick={() => retry()}>
          Try again
        </button>
      </body>
    </html>
  );
}
