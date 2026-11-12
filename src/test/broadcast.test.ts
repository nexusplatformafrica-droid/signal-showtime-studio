import { describe, expect, it } from "vitest";
import {
  detectScheduleIssues,
  expandRecurrence,
  findNowNext,
  isEngineOnline,
  isOnAir,
  playlistTotals,
  toZoned,
  zonedToUtc,
  type ScheduleSlot,
} from "@/lib/broadcast";
import { can } from "@/lib/permissions";

describe("station timezone (Africa/Kampala, UTC+3)", () => {
  it("converts 20:00 Kampala to 17:00 UTC", () => {
    expect(zonedToUtc("2026-11-12", "20:00", "Africa/Kampala").toISOString()).toBe("2026-11-12T17:00:00.000Z");
  });
  it("converts 01:30 Kampala to the previous UTC day", () => {
    expect(zonedToUtc("2026-11-12", "01:30", "Africa/Kampala").toISOString()).toBe("2026-11-11T22:30:00.000Z");
  });
  it("displays a UTC instant in Kampala local time", () => {
    expect(toZoned("2026-11-12T21:15:00Z", "Africa/Kampala")).toMatchObject({ date: "2026-11-13", time: "00:15" });
  });
});

describe("ON AIR is only shown when the engine confirms it", () => {
  const now = Date.parse("2026-11-12T12:00:00Z");
  it("is on air with a fresh heartbeat reporting on_air", () => {
    expect(isOnAir({ on_air: true, last_heartbeat_at: "2026-11-12T11:59:45Z" }, now)).toBe(true);
  });
  it("is NOT on air when the heartbeat is older than 30 seconds", () => {
    expect(isOnAir({ on_air: true, last_heartbeat_at: "2026-11-12T11:59:20Z" }, now)).toBe(false);
    expect(isEngineOnline({ on_air: true, last_heartbeat_at: "2026-11-12T11:59:20Z" }, now)).toBe(false);
  });
  it("is NOT on air when the engine reports off air", () => {
    expect(isOnAir({ on_air: false, last_heartbeat_at: "2026-11-12T11:59:59Z" }, now)).toBe(false);
  });
  it("is NOT on air without any status", () => {
    expect(isOnAir(null, now)).toBe(false);
  });
});

const slot = (id: string, s: string, e: string, extra: Partial<ScheduleSlot> = {}): ScheduleSlot => ({
  id, title: id, starts_at: s, ends_at: e, status: "published", media_id: "m1", ...extra,
});

describe("schedule conflict detection", () => {
  const media = new Map([["m1", { status: "ready", available: true, duration_seconds: 1800 }]]);
  it("flags overlapping programmes", () => {
    const issues = detectScheduleIssues([
      slot("a", "2026-11-12T17:00:00Z", "2026-11-12T18:00:00Z"),
      slot("b", "2026-11-12T17:30:00Z", "2026-11-12T18:30:00Z"),
    ], { media });
    expect(issues.some((i) => i.kind === "overlap" && i.entryIds.includes("a") && i.entryIds.includes("b"))).toBe(true);
  });
  it("does not flag back-to-back programmes as overlapping", () => {
    const issues = detectScheduleIssues([
      slot("a", "2026-11-12T17:00:00Z", "2026-11-12T18:00:00Z"),
      slot("b", "2026-11-12T18:00:00Z", "2026-11-12T19:00:00Z"),
    ], { media });
    expect(issues.filter((i) => i.kind === "overlap" || i.kind === "gap")).toHaveLength(0);
  });
  it("ignores cancelled programmes", () => {
    const issues = detectScheduleIssues([
      slot("a", "2026-11-12T17:00:00Z", "2026-11-12T18:00:00Z"),
      slot("b", "2026-11-12T17:30:00Z", "2026-11-12T18:30:00Z", { status: "cancelled" }),
    ], { media });
    expect(issues.some((i) => i.kind === "overlap")).toBe(false);
  });
  it("flags missing media, unavailable media, empty airtime and drafts", () => {
    const issues = detectScheduleIssues([
      slot("a", "2026-11-12T17:00:00Z", "2026-11-12T18:00:00Z", { media_id: null }),
      slot("b", "2026-11-12T19:00:00Z", "2026-11-12T20:00:00Z", { media_id: "gone", status: "draft" }),
    ], { media });
    const kinds = issues.map((i) => i.kind);
    expect(kinds).toContain("missing_media");
    expect(kinds).toContain("unavailable_media");
    expect(kinds).toContain("gap");
    expect(kinds).toContain("unpublished");
  });
  it("warns when media is longer than its fixed slot", () => {
    const issues = detectScheduleIssues([slot("a", "2026-11-12T17:00:00Z", "2026-11-12T17:20:00Z")], { media });
    expect(issues.some((i) => i.kind === "duration_mismatch")).toBe(true);
  });
});

describe("recurring programmes", () => {
  it("repeats daily between start and end dates in Kampala time", () => {
    const occ = expandRecurrence({ freq: "daily", startDate: "2026-11-12", endDate: "2026-11-14", startTime: "20:00", durationMinutes: 60 });
    expect(occ.map((o) => o.starts_at.toISOString())).toEqual([
      "2026-11-12T17:00:00.000Z", "2026-11-13T17:00:00.000Z", "2026-11-14T17:00:00.000Z",
    ]);
    expect(occ[0]?.ends_at.toISOString()).toBe("2026-11-12T18:00:00.000Z");
  });
  it("repeats weekly on the starting weekday", () => {
    const occ = expandRecurrence({ freq: "weekly", startDate: "2026-11-12", endDate: "2026-11-30", startTime: "21:00", durationMinutes: 30 });
    expect(occ).toHaveLength(3); // Thu 12, 19, 26
  });
  it("repeats on selected weekdays only", () => {
    // Mon(1) and Wed(3) between Mon 16 Nov and Sun 22 Nov 2026
    const occ = expandRecurrence({ freq: "weekdays", weekdays: [1, 3], startDate: "2026-11-16", endDate: "2026-11-22", startTime: "08:00", durationMinutes: 30 });
    expect(occ.map((o) => toZoned(o.starts_at).date)).toEqual(["2026-11-16", "2026-11-18"]);
  });
});

describe("now / next and playlist totals", () => {
  it("finds the scheduled current and next programme", () => {
    const now = Date.parse("2026-11-12T17:30:00Z");
    const { current, next } = findNowNext([
      slot("a", "2026-11-12T17:00:00Z", "2026-11-12T18:00:00Z"),
      slot("b", "2026-11-12T18:00:00Z", "2026-11-12T19:00:00Z"),
    ], now);
    expect(current?.id).toBe("a");
    expect(next?.id).toBe("b");
  });
  it("sums playlist duration and expected completion", () => {
    const t = playlistTotals([{ duration_seconds: 600 }, { duration_seconds: 1200 }], Date.parse("2026-11-12T17:00:00Z"));
    expect(t.totalSeconds).toBe(1800);
    expect(t.completesAt.toISOString()).toBe("2026-11-12T17:30:00.000Z");
  });
});

describe("role permissions", () => {
  it("only super admins and station managers can trigger emergency takeover", () => {
    expect(can(["super_admin"], "emergency")).toBe(true);
    expect(can(["station_manager"], "emergency")).toBe(true);
    expect(can(["broadcast_operator"], "emergency")).toBe(false);
  });
  it("broadcast operators control the broadcast but analysts cannot", () => {
    expect(can(["broadcast_operator"], "control")).toBe(true);
    expect(can(["analyst"], "control")).toBe(false);
  });
  it("only super admins manage users", () => {
    expect(can(["station_manager"], "users")).toBe(false);
    expect(can(["super_admin"], "users")).toBe(true);
  });
});
