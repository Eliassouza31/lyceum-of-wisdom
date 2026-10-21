import * as Sentry from "@sentry/nextjs";

type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContext = Record<string, unknown>;

const SENSITIVE_KEY =
  /pass(word)?|secret|token|api[-_]?key|authorization|cookie/i;
const REDACTED = "[REDACTED]";
const MAX_DEPTH = 5;

/** Recursively replaces values whose key looks sensitive, so secrets never reach the logs. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return "[Truncated]";
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        SENSITIVE_KEY.test(key) ? REDACTED : redact(entry, depth + 1),
      ]),
    );
  }
  return value;
}

export function formatLogEntry(
  level: LogLevel,
  message: string,
  context: LogContext = {},
  now: Date = new Date(),
): string {
  return JSON.stringify({
    level,
    message,
    time: now.toISOString(),
    ...(redact(context) as LogContext),
  });
}

function write(level: LogLevel, message: string, context?: LogContext): void {
  const line = formatLogEntry(level, message, context);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/** Structured JSON logger. Vercel captures stdout/stderr and makes these lines searchable. */
export const logger = {
  debug: (message: string, context?: LogContext) => {
    if (process.env.NODE_ENV !== "production") write("debug", message, context);
  },
  info: (message: string, context?: LogContext) =>
    write("info", message, context),
  warn: (message: string, context?: LogContext) =>
    write("warn", message, context),
  /** Also reported to Sentry (when configured), so handled failures are not missed. */
  error: (message: string, context?: LogContext) => {
    write("error", message, context);
    Sentry.captureMessage(message, {
      level: "error",
      extra: redact(context ?? {}) as LogContext,
    });
  },
};
