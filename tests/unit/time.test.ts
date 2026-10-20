import { describe, expect, it } from "vitest";

import {
  addDays,
  dayOfWeek,
  formatLocalDate,
  formatTime,
  isLocalDate,
  isLocalTime,
  localDateOf,
  localTimeOf,
  startOfLocalDay,
  todayIn,
  zonedTimeToUtc,
} from "@/lib/time";

const iso = (date: Date | null) => date?.toISOString() ?? null;

describe("zonedTimeToUtc", () => {
  it("converts business time to UTC, with and without DST", () => {
    expect(iso(zonedTimeToUtc("2026-10-20", "16:05", "America/Chicago"))).toBe(
      "2026-10-20T21:05:00.000Z",
    );
    expect(iso(zonedTimeToUtc("2026-12-20", "15:05", "America/Chicago"))).toBe(
      "2026-12-20T21:05:00.000Z",
    );
    expect(iso(zonedTimeToUtc("2026-07-01", "09:00", "America/Phoenix"))).toBe(
      "2026-07-01T16:00:00.000Z",
    );
    expect(iso(zonedTimeToUtc("2026-07-01", "09:00", "Pacific/Honolulu"))).toBe(
      "2026-07-01T19:00:00.000Z",
    );
  });

  it("handles the day clocks spring forward (2nd Sunday of March)", () => {
    // 2026-03-08: 2:00 AM jumps to 3:00 AM in New York.
    expect(iso(zonedTimeToUtc("2026-03-08", "01:59", "America/New_York"))).toBe(
      "2026-03-08T06:59:00.000Z",
    );
    expect(zonedTimeToUtc("2026-03-08", "02:00", "America/New_York")).toBe(
      null,
    );
    expect(zonedTimeToUtc("2026-03-08", "02:30", "America/New_York")).toBe(
      null,
    );
    expect(iso(zonedTimeToUtc("2026-03-08", "03:00", "America/New_York"))).toBe(
      "2026-03-08T07:00:00.000Z",
    );
    // Arizona does not observe DST, so the same time exists there.
    expect(iso(zonedTimeToUtc("2026-03-08", "02:30", "America/Phoenix"))).toBe(
      "2026-03-08T09:30:00.000Z",
    );
  });

  it("uses the first 1:30 AM on the day clocks fall back (1st Sunday of November)", () => {
    // 2026-11-01: 1:00–1:59 AM happens twice in Chicago (CDT, then CST).
    expect(iso(zonedTimeToUtc("2026-11-01", "01:30", "America/Chicago"))).toBe(
      "2026-11-01T06:30:00.000Z",
    );
    expect(iso(zonedTimeToUtc("2026-11-01", "02:00", "America/Chicago"))).toBe(
      "2026-11-01T08:00:00.000Z",
    );
  });

  it("round-trips with localDateOf and localTimeOf", () => {
    for (const [date, time] of [
      ["2026-03-07", "23:45"],
      ["2026-03-08", "03:15"],
      ["2026-11-01", "00:30"],
      ["2026-11-01", "23:59"],
      ["2027-01-01", "00:00"],
    ] as const) {
      const utc = zonedTimeToUtc(date, time, "America/Los_Angeles");
      expect(utc).not.toBeNull();
      expect(localDateOf(utc!, "America/Los_Angeles")).toBe(date);
      expect(localTimeOf(utc!, "America/Los_Angeles")).toBe(time);
    }
  });

  it.each([
    ["2026-02-30", "09:00"],
    ["2026-13-01", "09:00"],
    ["26-01-01", "09:00"],
    ["2026-01-01", "24:00"],
    ["2026-01-01", "9:00"],
    ["2026-01-01", ""],
  ])("rejects %j %j", (date, time) => {
    expect(zonedTimeToUtc(date, time, "America/New_York")).toBeNull();
  });
});

describe("local calendar days", () => {
  it("validates dates and times", () => {
    expect(isLocalDate("2028-02-29")).toBe(true);
    expect(isLocalDate("2026-02-29")).toBe(false);
    expect(isLocalTime("23:59")).toBe(true);
    expect(isLocalTime("12:60")).toBe(false);
  });

  it("knows today in the business time zone", () => {
    const now = new Date("2026-10-21T03:30:00Z");
    expect(todayIn("America/Los_Angeles", now)).toBe("2026-10-20");
    expect(todayIn("America/New_York", now)).toBe("2026-10-20");
    expect(todayIn("UTC", now)).toBe("2026-10-21");
  });

  it("finds where a day starts, including 23- and 25-hour days", () => {
    expect(
      startOfLocalDay("2026-03-08", "America/New_York").toISOString(),
    ).toBe("2026-03-08T05:00:00.000Z");
    expect(
      startOfLocalDay("2026-03-09", "America/New_York").toISOString(),
    ).toBe("2026-03-09T04:00:00.000Z");
    expect(
      startOfLocalDay("2026-11-02", "America/New_York").toISOString(),
    ).toBe("2026-11-02T05:00:00.000Z");
  });

  it("adds days across months, years and leap days", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
    expect(addDays("2026-03-08", 7)).toBe("2026-03-15");
  });

  it("formats days and times", () => {
    expect(dayOfWeek("2026-10-18")).toBe(0);
    expect(dayOfWeek("2026-10-24")).toBe(6);
    expect(formatLocalDate("2026-10-20")).toBe("Tue, Oct 20, 2026");
    expect(formatTime("2026-10-20T21:05:00Z", "America/Chicago")).toBe(
      "4:05 PM",
    );
  });
});
