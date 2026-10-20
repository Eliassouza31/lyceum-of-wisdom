export const DEFAULT_AFTER_LOGIN = "/dashboard";

/** Paths that require a signed-in user. */
export const PROTECTED_PREFIXES = [
  "/dashboard",
  "/onboarding",
  "/calendar",
  "/clients",
  "/appointments",
  "/reminders",
  "/notifications",
  "/billing",
  "/settings",
  "/reset-password",
] as const;

/** Auth pages a signed-in user should skip. */
export const GUEST_ONLY_PATHS = ["/login", "/signup"] as const;

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

export function isGuestOnlyPath(pathname: string): boolean {
  return GUEST_ONLY_PATHS.some((prefix) => matchesPrefix(pathname, prefix));
}

/**
 * Accepts only same-site relative paths, preventing open redirects such as
 * `?next=https://evil.example` or `?next=//evil.example`.
 */
export function safeNextPath(
  value: unknown,
  fallback: string = DEFAULT_AFTER_LOGIN,
): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (value.includes("\\") || /[\u0000-\u001f]/.test(value)) return fallback;
  try {
    const parsed = new URL(value, "http://localhost");
    if (parsed.origin !== "http://localhost") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
