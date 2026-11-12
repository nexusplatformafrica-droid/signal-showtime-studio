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

import { headlineIndex, newsTextFor } from "@/lib/news-cards";

describe("news lower third", () => {
  const pub = "2026-11-12T11:00:00Z";
  const at = (s: number) => ({ ...ctx(0), now: Date.parse(pub) + s * 1000 });
  it("shows once for its duration after publishing", () => {
    const o = ov("lower_third", { duration: 20, show_mode: "once" }, { published_at: pub });
    expect(isOverlayVisible(o, at(10))).toBe(true);
    expect(isOverlayVisible(o, at(25))).toBe(false);
    expect(isOverlayVisible(o, at(605))).toBe(false);
  });
  it("repeats every N minutes for its duration when set to repeat", () => {
    const o = ov("lower_third", { duration: 20, show_mode: "repeat", every: 5 }, { published_at: pub });
    expect(isOverlayVisible(o, at(10))).toBe(true);
    expect(isOverlayVisible(o, at(100))).toBe(false);
    expect(isOverlayVisible(o, at(305))).toBe(true);
    expect(overlayRemainingMs(o, at(305))).toBe(15_000);
  });
  it("stays up when the duration is 0", () => {
    expect(isOverlayVisible(ov("lower_third", { duration: 0 }, { published_at: pub }), at(99_999))).toBe(true);
  });
  it("takes turns between headlines, the same for every viewer", () => {
    expect(headlineIndex(3, 0, 8)).toBe(0);
    expect(headlineIndex(3, 8_000, 8)).toBe(1);
    expect(headlineIndex(3, 24_000, 8)).toBe(0);
    const t = newsTextFor({ title: "First story\n\nSecond story", rotate: 10 }, 10_000, "Africa/Kampala");
    expect(t.headline).toBe("Second story");
  });
  it("fills {clock} with the channel's local time", () => {
    const t = newsTextFor({}, Date.parse("2026-11-12T19:00:00Z"), "Africa/Kampala");
    expect(t.time).toBe("10:00 PM");
    expect(t.kicker).toBe("BREAKING NEWS");
  });
});
