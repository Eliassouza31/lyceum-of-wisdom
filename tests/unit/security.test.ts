import type { ErrorEvent } from "@sentry/nextjs";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { clientIp, RATE_LIMITS, rateLimitKey } from "@/lib/rate-limit";
import { scrubEvent, scrubUrl, sentryOptions } from "@/lib/sentry";

describe("rateLimitKey", () => {
  it("hashes the value, so IPs and emails are not stored", () => {
    const key = rateLimitKey("sign-in:email", "Ana@Example.com");
    expect(key).toMatch(/^sign-in:email:[0-9a-f]{32}$/);
    expect(key).not.toContain("example");
  });

  it("ignores case and surrounding spaces", () => {
    expect(rateLimitKey("sign-in:email", " ANA@example.com ")).toBe(
      rateLimitKey("sign-in:email", "ana@example.com"),
    );
  });

  it("keeps each limit separate", () => {
    expect(rateLimitKey("sign-in:ip", "1.2.3.4")).not.toBe(
      rateLimitKey("sign-up:ip", "1.2.3.4"),
    );
  });

  it("has positive limits that fit the hourly cleanup", () => {
    for (const rule of Object.values(RATE_LIMITS)) {
      expect(rule.max).toBeGreaterThan(0);
      expect(rule.windowSeconds).toBeGreaterThan(0);
      expect(rule.windowSeconds).toBeLessThanOrEqual(24 * 60 * 60);
    }
  });
});

describe("clientIp", () => {
  it("takes the first address of x-forwarded-for", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" });
    expect(clientIp(headers)).toBe("203.0.113.7");
  });

  it("returns null without the header", () => {
    expect(clientIp(new Headers())).toBeNull();
  });
});

describe("Sentry privacy", () => {
  it("hides tokens in URLs", () => {
    expect(scrubUrl("https://app.test/unsubscribe?token=abc-123&done=1")).toBe(
      "https://app.test/unsubscribe?token=[REDACTED]&done=1",
    );
    expect(scrubUrl("/auth/confirm?token_hash=xyz&type=email")).toBe(
      "/auth/confirm?token_hash=[REDACTED]&type=email",
    );
  });

  it("removes cookies, auth headers, IPs and user details", () => {
    const event = scrubEvent({
      type: undefined,
      request: {
        url: "https://app.test/api/unsubscribe?token=secret",
        query_string: "token=secret",
        cookies: { "sb-auth": "jwt" },
        headers: {
          Cookie: "sb-auth=jwt",
          authorization: "Bearer x",
          "x-forwarded-for": "203.0.113.7",
          "user-agent": "Test",
        },
      },
      user: { id: "u_1", email: "ana@example.com", ip_address: "1.2.3.4" },
      breadcrumbs: [
        {
          message: "GET /unsubscribe?token=secret",
          data: { url: "/x?code=1" },
        },
      ],
    } as ErrorEvent);

    expect(JSON.stringify(event)).not.toMatch(/secret|jwt|Bearer|203\.0|ana@/);
    expect(event.request?.headers).toEqual({ "user-agent": "Test" });
    expect(event.user).toEqual({ id: "u_1" });
  });

  it("stays off without a DSN", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    expect(sentryOptions().enabled).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://key@o1.ingest.sentry.io/1");
    expect(sentryOptions().enabled).toBe(true);
    vi.unstubAllEnvs();
  });
});
