import { describe, expect, it } from "vitest";

import {
  isGuestOnlyPath,
  isProtectedPath,
  safeNextPath,
} from "@/lib/auth/redirects";

describe("safeNextPath", () => {
  it("keeps same-site paths with query and hash", () => {
    expect(safeNextPath("/clients?page=2#top")).toBe("/clients?page=2#top");
  });

  it.each([
    "https://evil.example.com",
    "//evil.example.com",
    "/\\evil.example.com",
    "\\\\evil.example.com",
    "javascript:alert(1)",
    "dashboard",
    "/%0d%0aLocation:%20https://evil.example.com".replace("%0d%0a", "\r\n"),
    "",
  ])("rejects %j", (value) => {
    expect(safeNextPath(value)).toBe("/dashboard");
  });

  it("uses the fallback for non-strings", () => {
    expect(safeNextPath(undefined)).toBe("/dashboard");
    expect(safeNextPath(["/clients"], "/onboarding")).toBe("/onboarding");
  });
});

describe("path guards", () => {
  it("protects app routes and their children only", () => {
    expect(isProtectedPath("/dashboard")).toBe(true);
    expect(isProtectedPath("/clients/123")).toBe(true);
    expect(isProtectedPath("/dashboard-tour")).toBe(false);
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/login")).toBe(false);
  });

  it("marks sign-in and sign-up as guest only", () => {
    expect(isGuestOnlyPath("/login")).toBe(true);
    expect(isGuestOnlyPath("/signup")).toBe(true);
    expect(isGuestOnlyPath("/forgot-password")).toBe(false);
  });
});
