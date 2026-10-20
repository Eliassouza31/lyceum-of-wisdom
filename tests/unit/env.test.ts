import { describe, expect, it } from "vitest";

import { parsePublicEnv } from "@/lib/env";

describe("parsePublicEnv", () => {
  it("uses localhost when the app URL is not set", () => {
    expect(parsePublicEnv({}).NEXT_PUBLIC_APP_URL).toBe(
      "http://localhost:3000",
    );
  });

  it("removes trailing slashes from the app URL", () => {
    const env = parsePublicEnv({
      NEXT_PUBLIC_APP_URL: "https://example.com//",
    });
    expect(env.NEXT_PUBLIC_APP_URL).toBe("https://example.com");
  });

  it("rejects values that are not http(s) URLs", () => {
    expect(() => parsePublicEnv({ NEXT_PUBLIC_APP_URL: "not-a-url" })).toThrow(
      /NEXT_PUBLIC_APP_URL/,
    );
    expect(() =>
      parsePublicEnv({ NEXT_PUBLIC_APP_URL: "ftp://example.com" }),
    ).toThrow(/NEXT_PUBLIC_APP_URL/);
  });
});
