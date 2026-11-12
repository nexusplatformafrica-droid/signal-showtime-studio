import { describe, expect, it } from "vitest";
import { CAPTION_DESIGNS, CLOCK_DESIGNS, NOW_DESIGNS, ONAIR_DESIGNS, clockParts, nowShowingText } from "@/lib/badge-kits";

const at = Date.parse("2026-11-12T15:05:09Z"); // 18:05:09 in Kampala (UTC+3)

describe("local time clock", () => {
  it("shows Kampala time in 24-hour format by default", () => {
    const p = clockParts(at, "Africa/Kampala");
    expect(p.time).toBe("18:05");
    expect(p.ampm).toBe("");
  });
  it("can show 12-hour time with AM/PM and seconds", () => {
    const p = clockParts(at, "Africa/Kampala", { h12: true, seconds: true });
    expect(p.time).toBe("6:05:09");
    expect(p.ampm).toBe("PM");
  });
  it("gives the date pieces in the channel timezone", () => {
    const p = clockParts(Date.parse("2026-11-12T22:30:00Z"), "Africa/Kampala"); // already 13 Nov in Kampala
    expect(p.day).toBe("13");
    expect(p.month).toBe("NOV");
  });
});

describe("now showing text", () => {
  it("uses the programme's own name unless a title is typed", () => {
    expect(nowShowingText({}, "Spiritual Part 5", at, "Africa/Kampala").title).toBe("Spiritual Part 5");
    expect(nowShowingText({ title: "Movie Night" }, "Spiritual Part 5", at, "Africa/Kampala").title).toBe("Movie Night");
    expect(nowShowingText({}, null, at, "Africa/Kampala").kicker).toBe("NOW SHOWING");
  });
});

describe("design lists", () => {
  it("offers many designs for each graphic", () => {
    for (const list of [NOW_DESIGNS, CLOCK_DESIGNS, ONAIR_DESIGNS, CAPTION_DESIGNS]) {
      expect(list.length).toBeGreaterThanOrEqual(12);
      expect(new Set(list.map((d) => d.id)).size).toBe(list.length);
    }
  });
});
