import { describe, expect, it } from "vitest";

import { clientName, consentEventLabel } from "@/features/clients/format";
import { clientSchema } from "@/features/clients/schemas";
import { parsePage, searchPattern } from "@/features/clients/search";
import { formatPhone, toE164 } from "@/lib/phone";
import { formatDateTime } from "@/lib/time";

describe("toE164", () => {
  it.each([
    ["(555) 234-5678", "+15552345678"],
    ["555.234.5678", "+15552345678"],
    ["1 555 234 5678", "+15552345678"],
    ["+1 (555) 234-5678", "+15552345678"],
    ["+44 20 7946 0958", "+442079460958"],
  ])("converts %j", (input, expected) => {
    expect(toE164(input)).toBe(expected);
  });

  it.each([
    "",
    "12345",
    "555-1234",
    "(055) 234-5678",
    "+0 123 456 789",
    "call me",
  ])("rejects %j", (input) => {
    expect(toE164(input)).toBeNull();
  });
});

describe("formatPhone", () => {
  it("formats US numbers and leaves others as stored", () => {
    expect(formatPhone("+15552345678")).toBe("(555) 234-5678");
    expect(formatPhone("+442079460958")).toBe("+442079460958");
  });
});

describe("clientSchema", () => {
  const valid = {
    firstName: "  Maria ",
    lastName: " Lopez ",
    email: " Maria@Example.COM ",
    phone: "(555) 234-5678",
    emailConsent: "on",
    notes: "  Prefers mornings ",
  };

  it("normalizes the input", () => {
    expect(clientSchema.parse(valid)).toEqual({
      firstName: "Maria",
      lastName: "Lopez",
      email: "maria@example.com",
      phone: "+15552345678",
      emailConsent: true,
      notes: "Prefers mornings",
    });
  });

  it("turns empty optional fields into null and a missing checkbox into false", () => {
    expect(
      clientSchema.parse({
        firstName: "Maria",
        lastName: "",
        email: "",
        phone: " ",
        notes: "",
      }),
    ).toEqual({
      firstName: "Maria",
      lastName: "",
      email: null,
      phone: null,
      emailConsent: false,
      notes: null,
    });
  });

  it.each([
    [{ firstName: " " }, "firstName", "Enter the client's first name."],
    [{ email: "not-an-email" }, "email", "Enter a valid email address."],
    [
      { phone: "123" },
      "phone",
      "Enter a valid phone number, e.g. (555) 123-4567.",
    ],
    [
      { notes: "x".repeat(1001) },
      "notes",
      "Notes are too long (1,000 characters max).",
    ],
    [{ email: "" }, "emailConsent", "Add an email address to send reminders."],
  ])("rejects %j", (override, field, message) => {
    const result = clientSchema.safeParse({ ...valid, ...override });
    expect(result.success).toBe(false);
    expect(
      result.error?.issues.find((issue) => issue.path[0] === field)?.message,
    ).toBe(message);
  });
});

describe("searchPattern", () => {
  it("wraps the term in wildcards", () => {
    expect(searchPattern("  maria  lopez ")).toBe("*maria lopez*");
    expect(searchPattern("o'brien@example.com")).toBe("*o'brien@example.com*");
  });

  it("drops characters that could change the PostgREST filter", () => {
    expect(searchPattern("a,id.eq.1)")).toBe("*a id.eq.1*");
    expect(searchPattern('100%_"x"\\')).toBe("*100 x*");
  });

  it("returns null when nothing is left", () => {
    expect(searchPattern("  ,() ")).toBeNull();
  });
});

describe("parsePage", () => {
  it.each([
    [undefined, 1],
    ["3", 3],
    [["2", "5"], 2],
    ["0", 1],
    ["-1", 1],
    ["1.5", 1],
    ["abc", 1],
    ["99999999", 1],
  ])("parses %j as %i", (value, expected) => {
    expect(parsePage(value)).toBe(expected);
  });
});

describe("formatting", () => {
  it("builds the display name", () => {
    expect(clientName({ first_name: "Maria", last_name: "" })).toBe("Maria");
    expect(clientName({ first_name: "Maria", last_name: "Lopez" })).toBe(
      "Maria Lopez",
    );
  });

  it("describes consent events", () => {
    expect(
      consentEventLabel({
        id: "1",
        channel: "email",
        action: "granted",
        source: "staff_entry",
        created_at: "2026-10-20T21:05:00Z",
      }),
    ).toBe("Email reminders allowed · Recorded by staff");
  });

  it("shows times in the business time zone, across DST", () => {
    expect(formatDateTime("2026-10-20T21:05:00Z", "America/Chicago")).toBe(
      "Oct 20, 2026, 4:05 PM CDT",
    );
    expect(formatDateTime("2026-12-20T21:05:00Z", "America/Chicago")).toBe(
      "Dec 20, 2026, 3:05 PM CST",
    );
  });
});
