import { describe, expect, it } from "vitest";
import { isOverlayVisible, type GraphicsContext, type LiveOverlay } from "@/lib/graphics";

const start = Date.parse("2026-11-12T11:02:00Z");
const ctx = (secondsIn: number, extra: Partial<GraphicsContext> = {}): GraphicsContext => ({ now: start + secondsIn * 1000, live: true, title: "Film", nextTitle: "Next film", programmeStartedAt: start, ...extra });
const ov = (kind: LiveOverlay["kind"], config: LiveOverlay["config"] = {}, extra: Partial<LiveOverlay> = {}): LiveOverlay => ({ id: kind, kind, name: kind, config, show_from: null, show_until: null, published_at: "2026-11-12T11:00:00Z", ...extra });

describe("on-screen graphics timing", () => {
  it("shows 'now showing' for its duration at the programme start, then every 10 minutes", () => {
    const o = ov("now_showing", { duration: 10 });
    expect(isOverlayVisible(o, ctx(5))).toBe(true);
    expect(isOverlayVisible(o, ctx(15))).toBe(false);
    expect(isOverlayVisible(o, ctx(605))).toBe(true);
  });
  it("shows 'up next' straight after 'now showing' so they never overlap", () => {
    const o = ov("next_programme", { duration: 10 });
    expect(isOverlayVisible(o, ctx(5))).toBe(false);
    expect(isOverlayVisible(o, ctx(12))).toBe(true);
    expect(isOverlayVisible(o, ctx(12, { nextTitle: null }))).toBe(false);
  });
  it("only shows the ON AIR / LIVE tag while something is playing", () => {
    expect(isOverlayVisible(ov("on_air"), ctx(5))).toBe(true);
    expect(isOverlayVisible(ov("on_air"), ctx(5, { live: false }))).toBe(false);
  });
  it("respects the scheduled display window", () => {
    const o = ov("ticker", {}, { show_from: "2026-11-12T12:00:00Z", show_until: "2026-11-12T13:00:00Z" });
    expect(isOverlayVisible(o, ctx(60))).toBe(false);
    expect(isOverlayVisible(o, { ...ctx(0), now: Date.parse("2026-11-12T12:30:00Z") })).toBe(true);
    expect(isOverlayVisible(o, { ...ctx(0), now: Date.parse("2026-11-12T13:00:00Z") })).toBe(false);
  });
  it("shows a lower third once for its duration after publishing", () => {
    const o = ov("lower_third", { duration: 20 }, { published_at: "2026-11-12T11:02:00Z" });
    expect(isOverlayVisible(o, ctx(10))).toBe(true);
    expect(isOverlayVisible(o, ctx(30))).toBe(false);
  });
});
