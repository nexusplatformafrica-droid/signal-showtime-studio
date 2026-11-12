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

import { overlayRemainingMs } from "@/lib/graphics";
import { cardPhase, cardTextFor, fillCardText } from "@/lib/brand-cards";

describe("up next branding", () => {
  const nextAt = Date.parse("2026-11-12T14:20:00Z"); // 17:20 in Kampala
  it("'before next' shows from `lead` seconds before the next programme, for its duration", () => {
    const o = ov("next_programme", { show_mode: "before_next", lead: 120, duration: 30 });
    const at = (sBefore: number) => ({ ...ctx(0), now: nextAt - sBefore * 1000, nextStartsAt: nextAt });
    expect(isOverlayVisible(o, at(130))).toBe(false);
    expect(isOverlayVisible(o, at(110))).toBe(true);
    expect(overlayRemainingMs(o, at(110))).toBe(20_000);
    expect(isOverlayVisible(o, at(85))).toBe(false);
  });
  it("'before next' with duration 0 stays up until the next programme starts", () => {
    const o = ov("next_programme", { show_mode: "before_next", lead: 60, duration: 0 });
    expect(isOverlayVisible(o, { ...ctx(0), now: nextAt - 5_000, nextStartsAt: nextAt })).toBe(true);
    expect(isOverlayVisible(o, { ...ctx(0), now: nextAt, nextStartsAt: nextAt })).toBe(false);
  });
  it("plays the exit animation when the card is about to leave", () => {
    expect(cardPhase(5_000, 700)).toBe("hold");
    expect(cardPhase(900, 700)).toBe("out");
    expect(cardPhase(null, 700)).toBe("hold");
  });
  it("fills {title}, {time} and {day} from the schedule in the channel timezone", () => {
    const v = { title: "Magical Love Story", startsAt: nextAt, now: nextAt - 3_600_000, timezone: "Africa/Kampala" };
    expect(fillCardText("{day} at {time}", v)).toBe("TODAY at 5:20 PM");
    expect(cardTextFor({}, v)).toEqual({ kicker: "UP NEXT", title: "Magical Love Story", subtitle: "", time: "5:20 PM" });
    expect(cardTextFor({ title: "My own name", kicker: "COMING UP", time_text: "" }, v).title).toBe("My own name");
  });
});
