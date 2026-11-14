import { describe, expect, it } from "vitest";
import { bestSample, offsetFromSample } from "@/lib/clock";
import { endFromDuration, scheduleTail, toZoned, zonedToUtc } from "@/lib/broadcast";

describe("real online time instead of the device clock", () => {
  it("corrects a device clock that is 5 minutes slow", () => {
    // Device sent at 1000 and got the answer at 1200; server said 301100 → device is 300000 ms behind.
    expect(offsetFromSample(301_100, 1_000, 1_200)).toBe(300_000);
  });
  it("corrects a device clock that is 2 hours fast", () => {
    expect(offsetFromSample(0, 7_200_000, 7_200_000)).toBe(-7_200_000);
  });
  it("trusts the answer that came back fastest", () => {
    expect(bestSample([{ rttMs: 400, offset: 1 }, { rttMs: 80, offset: 2 }, { rttMs: 900, offset: 3 }])?.offset).toBe(2);
  });
});

describe("scheduling: start after the last programme", () => {
  const now = Date.parse("2026-11-14T07:00:00Z");
  const entries = [
    { id: "a", title: "Morning film", starts_at: "2026-11-14T06:00:00Z", ends_at: "2026-11-14T07:40:12Z", status: "published" },
    { id: "b", title: "News", starts_at: "2026-11-14T07:40:12Z", ends_at: "2026-11-14T08:10:00Z", status: "draft" },
    { id: "c", title: "Dropped", starts_at: "2026-11-14T08:10:00Z", ends_at: "2026-11-14T09:00:00Z", status: "cancelled" },
    { id: "old", title: "Yesterday", starts_at: "2026-11-13T06:00:00Z", ends_at: "2026-11-13T07:00:00Z", status: "published" },
  ];
  it("starts exactly when the last programme still to come ends", () => {
    const t = scheduleTail(entries, now);
    expect(t.at.toISOString()).toBe("2026-11-14T08:10:00.000Z");
    expect(t.after?.title).toBe("News");
  });
  it("ignores cancelled programmes", () => {
    expect(scheduleTail(entries, now).after?.id).not.toBe("c");
  });
  it("starts right now (next whole second) when nothing is coming up", () => {
    expect(scheduleTail([entries[3]!], now + 400).at.toISOString()).toBe("2026-11-14T07:00:01.000Z");
  });
  it("does not count the programme being edited", () => {
    expect(scheduleTail(entries, now, "b").at.toISOString()).toBe("2026-11-14T07:40:12.000Z");
  });
});

describe("scheduling: end time follows the real video length", () => {
  it("ends 1:38:39 after the start for a 1:38:39 video", () => {
    expect(endFromDuration("2026-11-14T08:10:00Z", 5919).toISOString()).toBe("2026-11-14T09:48:39.000Z");
  });
  it("rounds part-seconds up so the video is never cut", () => {
    expect(endFromDuration("2026-11-14T08:10:00Z", 59.2).toISOString()).toBe("2026-11-14T08:11:00.000Z");
  });
  it("keeps seconds when converting Kampala time", () => {
    expect(zonedToUtc("2026-11-14", "11:10:05", "Africa/Kampala").toISOString()).toBe("2026-11-14T08:10:05.000Z");
    expect(toZoned("2026-11-14T08:10:05Z", "Africa/Kampala").timeSec).toBe("11:10:05");
  });
});
