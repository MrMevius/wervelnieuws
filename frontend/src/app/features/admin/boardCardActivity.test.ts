import { describe, expect, it } from "vitest";
import { cardActivityAgeDays, formatCardActivityAge } from "./boardCardActivity";

describe("board card activity", () => {
  const now = new Date(2026, 10, 6, 15, 0).getTime();

  it("counts calendar days rather than 24-hour blocks", () => {
    expect(cardActivityAgeDays(new Date(2026, 10, 6, 1, 0).toISOString(), now)).toBe(0);
    expect(cardActivityAgeDays(new Date(2026, 10, 5, 23, 30).toISOString(), now)).toBe(1);
    expect(cardActivityAgeDays(new Date(2026, 9, 7, 12, 0).toISOString(), now)).toBe(30);
  });

  it("ignores missing or invalid timestamps", () => {
    expect(cardActivityAgeDays(null, now)).toBeNull();
    expect(cardActivityAgeDays("geen datum", now)).toBeNull();
  });

  it("formats ages in Dutch", () => {
    expect(formatCardActivityAge(0)).toBe("vandaag");
    expect(formatCardActivityAge(1)).toBe("gisteren");
    expect(formatCardActivityAge(5)).toBe("5 dagen geleden");
    expect(formatCardActivityAge(21)).toBe("3 weken geleden");
    expect(formatCardActivityAge(95)).toBe("3 maanden geleden");
    expect(formatCardActivityAge(400)).toBe("1 jaar geleden");
  });
});
