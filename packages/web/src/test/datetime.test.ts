import { describe, expect, it } from "vitest";

import {
  formatCalendarDate,
  formatInstantDate,
  formatInstantDateTime,
  formatRelativeInstant,
} from "../lib/datetime";

describe("date and time formatting", () => {
  it("formats stored UTC instants using the local environment time zone", () => {
    const value = "2026-06-03T06:00:00.000Z";

    expect(formatInstantDateTime(value)).toBe(
      new Date(value).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    );

    expect(formatInstantDate(value)).toBe(
      new Date(value).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    );
  });

  it("formats calendar dates without shifting them across time zones", () => {
    expect(formatCalendarDate("2024-01-01")).toBe(
      new Date(Date.UTC(2024, 0, 1)).toLocaleDateString(undefined, {
        timeZone: "UTC",
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    );

    expect(formatCalendarDate("2024-06", "month")).toBe(
      new Date(Date.UTC(2024, 5, 1)).toLocaleDateString(undefined, {
        timeZone: "UTC",
        month: "short",
        year: "numeric",
      }),
    );

    expect(formatCalendarDate("1998", "year")).toBe("1998");
  });

  it("renders relative timestamps from stored UTC instants", () => {
    const now = new Date();
    const ninetyMinutesAgo = new Date(now.getTime() - 90 * 60 * 1000).toISOString();

    expect(formatRelativeInstant(ninetyMinutesAgo)).toBe("1 hour ago");
    expect(formatRelativeInstant(null)).toBe("—");
  });
});
