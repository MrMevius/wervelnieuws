import { describe, expect, it } from "vitest";
import { formatAmsterdamDateInput, formatAmsterdamDateTime } from "./datetime";

describe("formatAmsterdamDateTime", () => {
  it("formats UTC summer timestamps in Amsterdam local time", () => {
    expect(formatAmsterdamDateTime("2026-06-02T13:32:00Z")).toBe("02-06-2026, 15:32");
  });

  it("treats naive ISO timestamps as UTC before Amsterdam formatting", () => {
    expect(formatAmsterdamDateTime("2026-06-02T13:32:00")).toBe("02-06-2026, 15:32");
  });

  it("formats UTC winter timestamps in Amsterdam local time", () => {
    expect(formatAmsterdamDateTime("2026-01-02T13:32:00Z")).toBe("02-01-2026, 14:32");
  });

  it("returns a stable fallback for invalid timestamps", () => {
    expect(formatAmsterdamDateTime("niet-een-datum")).toBe("Datum onbekend");
  });

  it("formats the Amsterdam calendar date for date inputs", () => {
    expect(formatAmsterdamDateInput("2026-06-01T22:30:00Z")).toBe("2026-06-02");
  });
});
