import { describe, expect, it } from "vitest";

import {
  calendarHref,
  calendarRange,
  parseDate,
  parseView,
  startOfWeek,
} from "@/features/appointments/calendar";
import {
  durationMinutes,
  formatDuration,
  formatTimeRange,
  statusActions,
} from "@/features/appointments/format";
import { appointmentSchema } from "@/features/appointments/schemas";

const NOW = new Date("2026-10-20T15:00:00Z");
const CLIENT_ID = "6f1c1f9e-6c5b-4a8e-9a77-2f0f1b3f6a10";

describe("appointmentSchema", () => {
  const schema = appointmentSchema("America/Chicago", NOW);
  const valid = {
    clientId: CLIENT_ID,
    title: "  Haircut ",
    date: "2026-10-22",
    startTime: "09:30",
    duration: "45",
    location: "  ",
    notes: " Bring photos ",
  };

  it("turns business time into UTC start and end", () => {
    expect(schema.parse(valid)).toEqual({
      clientId: CLIENT_ID,
      title: "Haircut",
      startsAt: new Date("2026-10-22T14:30:00Z"),
      endsAt: new Date("2026-10-22T15:15:00Z"),
      location: null,
      notes: "Bring photos",
    });
  });

  it("measures length in real minutes across the DST change", () => {
    // 1:30 AM CDT + 60 min = 1:30 AM CST on the day clocks fall back.
    const result = schema.parse({
      ...valid,
      date: "2026-11-01",
      startTime: "01:30",
      duration: "60",
    });
    expect(result.startsAt.toISOString()).toBe("2026-11-01T06:30:00.000Z");
    expect(result.endsAt.toISOString()).toBe("2026-11-01T07:30:00.000Z");
  });

  it.each([
    [{ clientId: "" }, "clientId", "Choose a client."],
    [{ title: " " }, "title", "Enter what the appointment is for."],
    [{ title: "x".repeat(121) }, "title", "Title is too long."],
    [{ date: "2026-02-30" }, "date", "Choose a valid date."],
    [
      { date: "2062-10-22" },
      "date",
      "Choose a date within the next two years.",
    ],
    [{ startTime: "" }, "startTime", "Choose a start time."],
    [{ duration: "0" }, "duration", "Choose how long it takes."],
    [{ duration: "abc" }, "duration", "Choose how long it takes."],
    [{ duration: "1441" }, "duration", "Appointments can last up to 24 hours."],
    [
      { notes: "x".repeat(1001) },
      "notes",
      "Notes are too long (1,000 characters max).",
    ],
  ])("rejects %j", (override, field, message) => {
    const result = schema.safeParse({ ...valid, ...override });
    expect(result.success).toBe(false);
    expect(
      result.error?.issues.find((issue) => issue.path[0] === field)?.message,
    ).toBe(message);
  });

  it("rejects a time skipped by the spring-forward change", () => {
    const result = appointmentSchema("America/Chicago", NOW).safeParse({
      ...valid,
      date: "2027-03-14",
      startTime: "02:15",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["startTime"]);
    expect(result.error?.issues[0]?.message).toMatch(/clocks move forward/);
  });
});

describe("calendar ranges", () => {
  it("parses the view and date from the URL", () => {
    expect(parseView("month")).toBe("month");
    expect(parseView(["day", "week"])).toBe("day");
    expect(parseView("year")).toBe("week");
    expect(parseView(undefined)).toBe("week");
    expect(parseDate("2026-11-05", "2026-10-20")).toBe("2026-11-05");
    expect(parseDate("2026-02-30", "2026-10-20")).toBe("2026-10-20");
    expect(parseDate("1900-01-01", "2026-10-20")).toBe("2026-10-20");
    expect(parseDate(undefined, "2026-10-20")).toBe("2026-10-20");
  });

  it("starts weeks on Sunday", () => {
    expect(startOfWeek("2026-10-20")).toBe("2026-10-18");
    expect(startOfWeek("2026-10-18")).toBe("2026-10-18");
    expect(startOfWeek("2026-11-01")).toBe("2026-11-01");
  });

  it("covers one day", () => {
    const range = calendarRange("day", "2026-03-08", "America/New_York");
    expect(range.days).toEqual(["2026-03-08"]);
    expect(range.start.toISOString()).toBe("2026-03-08T05:00:00.000Z");
    // A 23-hour day.
    expect(range.end.toISOString()).toBe("2026-03-09T04:00:00.000Z");
    expect(range.previous).toBe("2026-03-07");
    expect(range.next).toBe("2026-03-09");
    expect(range.title).toBe("Sunday, March 8, 2026");
  });

  it("covers a week", () => {
    const range = calendarRange("week", "2026-10-21", "America/Chicago");
    expect(range.days[0]).toBe("2026-10-18");
    expect(range.days[6]).toBe("2026-10-24");
    expect(range.start.toISOString()).toBe("2026-10-18T05:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-10-25T05:00:00.000Z");
    expect(range.previous).toBe("2026-10-14");
    expect(range.next).toBe("2026-10-28");
    expect(range.title).toBe("Oct 18 – Oct 24, 2026");
  });

  it("covers a month in whole weeks", () => {
    const range = calendarRange("month", "2026-10-20", "America/Chicago");
    expect(range.days[0]).toBe("2026-09-27");
    expect(range.days.at(-1)).toBe("2026-10-31");
    expect(range.days).toHaveLength(35);
    expect(range.previous).toBe("2026-09-01");
    expect(range.next).toBe("2026-11-01");
    expect(range.title).toBe("October 2026");

    const february = calendarRange("month", "2026-02-10", "America/Chicago");
    expect(february.days[0]).toBe("2026-02-01");
    expect(february.days).toHaveLength(28);

    const january = calendarRange("month", "2027-01-31", "America/Chicago");
    expect(january.previous).toBe("2026-12-01");
    expect(january.next).toBe("2027-02-01");
  });

  it("builds links", () => {
    expect(calendarHref("week", "2026-10-20")).toBe(
      "/calendar?view=week&date=2026-10-20",
    );
  });
});

describe("formatting", () => {
  it("formats lengths", () => {
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(60)).toBe("1 h");
    expect(formatDuration(90)).toBe("1 h 30 min");
    expect(
      durationMinutes("2026-10-20T14:00:00Z", "2026-10-20T15:30:00Z"),
    ).toBe(90);
  });

  it("formats a time range in the business time zone", () => {
    expect(
      formatTimeRange(
        "2026-10-20T14:00:00Z",
        "2026-10-20T15:30:00Z",
        "America/New_York",
      ),
    ).toBe("10:00 AM – 11:30 AM");
  });

  it("offers status changes that make sense", () => {
    const future = "2026-10-21T15:00:00Z";
    const past = "2026-10-19T15:00:00Z";
    expect(statusActions("scheduled", future, NOW)).toEqual(["cancelled"]);
    expect(statusActions("scheduled", past, NOW)).toEqual([
      "completed",
      "no_show",
      "cancelled",
    ]);
    expect(statusActions("cancelled", future, NOW)).toEqual(["scheduled"]);
    expect(statusActions("completed", past, NOW)).toEqual(["scheduled"]);
  });
});
