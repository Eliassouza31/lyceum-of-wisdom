import { describe, expect, it } from "vitest";

import { formatLogEntry, redact } from "@/lib/logger";

describe("redact", () => {
  it("hides values of sensitive keys at any depth", () => {
    expect(
      redact({
        userId: "u_1",
        password: "hunter2",
        nested: {
          apiKey: "k",
          Authorization: "Bearer x",
          list: [{ token: "t" }],
        },
      }),
    ).toEqual({
      userId: "u_1",
      password: "[REDACTED]",
      nested: {
        apiKey: "[REDACTED]",
        Authorization: "[REDACTED]",
        list: [{ token: "[REDACTED]" }],
      },
    });
  });

  it("serializes errors with their message", () => {
    const result = redact(new Error("boom")) as { message: string };
    expect(result.message).toBe("boom");
  });
});

describe("formatLogEntry", () => {
  it("produces a single JSON line with level, message and time", () => {
    const line = formatLogEntry(
      "info",
      "reminder sent",
      { jobId: "j_1", secret: "s" },
      new Date("2026-01-01T00:00:00.000Z"),
    );
    expect(JSON.parse(line)).toEqual({
      level: "info",
      message: "reminder sent",
      time: "2026-01-01T00:00:00.000Z",
      jobId: "j_1",
      secret: "[REDACTED]",
    });
  });
});
