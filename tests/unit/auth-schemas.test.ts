import { describe, expect, it } from "vitest";

import { authErrorMessage } from "@/features/auth/errors";
import {
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "@/features/auth/schemas";
import { createBusinessSchema } from "@/features/business/schemas";
import {
  US_TIMEZONES,
  isUsTimezone,
  timezoneLabel,
} from "@/features/business/timezones";

describe("signUpSchema", () => {
  const valid = {
    fullName: "  Jordan Rivera ",
    email: " Jordan@Example.COM ",
    password: "Passw0rd",
  };

  it("normalizes name and email", () => {
    expect(signUpSchema.parse(valid)).toEqual({
      fullName: "Jordan Rivera",
      email: "jordan@example.com",
      password: "Passw0rd",
    });
  });

  it.each([
    ["short", "Use at least 8 characters."],
    ["onlyletters", "Include at least one number."],
    ["12345678", "Include at least one letter."],
  ])("rejects the password %j", (password, message) => {
    const result = signUpSchema.safeParse({ ...valid, password });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain(
      message,
    );
  });

  it("rejects invalid emails", () => {
    expect(
      signUpSchema.safeParse({ ...valid, email: "not-an-email" }).success,
    ).toBe(false);
  });
});

describe("signInSchema", () => {
  it("requires a password", () => {
    const result = signInSchema.safeParse({ email: "a@b.co", password: "" });
    expect(result.error?.issues[0]?.message).toBe("Enter your password.");
  });
});

describe("resetPasswordSchema", () => {
  it("requires matching passwords", () => {
    const result = resetPasswordSchema.safeParse({
      password: "Passw0rd",
      confirmPassword: "Passw0rd!",
    });
    expect(result.error?.issues[0]).toMatchObject({
      path: ["confirmPassword"],
      message: "Passwords do not match.",
    });
  });
});

describe("createBusinessSchema", () => {
  it("accepts a US time zone and trims the name", () => {
    expect(
      createBusinessSchema.parse({
        name: "  Main St Barbers ",
        timezone: "America/Chicago",
      }),
    ).toEqual({ name: "Main St Barbers", timezone: "America/Chicago" });
  });

  it("rejects time zones outside the supported list", () => {
    expect(
      createBusinessSchema.safeParse({ name: "Shop", timezone: "Europe/Paris" })
        .success,
    ).toBe(false);
  });
});

describe("time zones", () => {
  it("labels known zones and falls back to the raw value", () => {
    expect(isUsTimezone("America/Phoenix")).toBe(true);
    expect(timezoneLabel("America/Denver")).toBe("Mountain Time (Denver)");
    expect(timezoneLabel("UTC")).toBe("UTC");
  });

  it("only lists zones the runtime knows", () => {
    for (const zone of US_TIMEZONES) {
      expect(
        () => new Intl.DateTimeFormat("en-US", { timeZone: zone.value }),
      ).not.toThrow();
    }
  });
});

describe("authErrorMessage", () => {
  it("maps known codes to friendly messages", () => {
    expect(
      authErrorMessage({ code: "invalid_credentials", message: "x" }),
    ).toBe("Incorrect email or password.");
    expect(authErrorMessage({ message: "x", status: 429 })).toMatch(
      /Too many attempts/,
    );
  });

  it("never leaks raw provider messages", () => {
    expect(
      authErrorMessage({
        code: "unexpected",
        message: "db connection refused",
      }),
    ).toBe("Something went wrong. Please try again.");
  });
});
