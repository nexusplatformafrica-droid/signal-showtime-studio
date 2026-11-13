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

import { publishPatch, showNowPatch, takeOffPatch } from "@/lib/graphics";
import { KIT_DEFAULTS, kitTextFor, tickerLine } from "@/lib/card-kits";

describe("ticker, breaking news and pop-up cards", () => {
  const pub = "2026-11-12T11:02:00Z";
  it("pop-up card shows once for its duration after Show now", () => {
    const o = ov("ad_banner", { duration: 15, show_mode: "once" }, { published_at: pub });
    expect(isOverlayVisible(o, ctx(10))).toBe(true);
    expect(isOverlayVisible(o, ctx(16))).toBe(false);
    expect(isOverlayVisible(o, ctx(610))).toBe(false);
  });
  it("pop-up card set to repeat comes back every N minutes", () => {
    const o = ov("ad_banner", { duration: 15, show_mode: "repeat", every: 5 }, { published_at: pub });
    expect(isOverlayVisible(o, ctx(20))).toBe(false);
    expect(isOverlayVisible(o, ctx(305))).toBe(true);
  });
  it("ticker and breaking news stay up when the duration is 0", () => {
    expect(isOverlayVisible(ov("ticker", { duration: 0 }, { published_at: pub }), ctx(99_999))).toBe(true);
    expect(isOverlayVisible(ov("breaking_news", {}, { published_at: pub }), ctx(99_999))).toBe(true);
  });
  it("ticker rolls every item, using the defaults when nothing is typed", () => {
    const t = kitTextFor({ title: "One\nTwo" }, start, "Africa/Kampala", KIT_DEFAULTS.ticker);
    expect(tickerLine(t.lines, "•")).toBe("One   •   Two");
    expect(kitTextFor({}, start, "Africa/Kampala", KIT_DEFAULTS.ticker).line).toBe("Welcome to MOVIE MAX");
    expect(kitTextFor({}, start, "Africa/Kampala", KIT_DEFAULTS.ticker).kicker).toBe("LATEST NEWS");
  });
  it("older tickers saved with `text` keep their wording", () => {
    expect(kitTextFor({ text: "Old ticker" }, start, "Africa/Kampala", KIT_DEFAULTS.ticker).line).toBe("Old ticker");
  });
});

describe("publishing graphics", () => {
  const ts = "2026-11-12T12:00:00Z";
  const row = { config: { title: "A" }, enabled: true, published_config: { title: "A" }, published_enabled: true };
  it("does not restart the timer of a graphic that did not change", () => {
    expect(publishPatch(row, { title: "A" }, true, ts)).not.toHaveProperty("published_at");
  });
  it("restarts the timer when the design or on/off state changed", () => {
    expect(publishPatch(row, { title: "B" }, true, ts).published_at).toBe(ts);
    expect(publishPatch(row, { title: "A" }, false, ts).published_at).toBe(ts);
  });
  it("Show now always switches it on and restarts its timer", () => {
    expect(showNowPatch({ title: "A" }, ts)).toEqual({ config: { title: "A" }, enabled: true, published_config: { title: "A" }, published_enabled: true, published_at: ts });
  });
  it("Take off air removes it from viewers", () => {
    expect(takeOffPatch()).toEqual({ enabled: false, published_enabled: false });
  });
});

import { hiddenReason, timingMode } from "@/lib/graphics";

describe("every graphic can stay up, show once or repeat", () => {
  const pub = "2026-11-12T11:02:00Z";
  it("clock and logo saved before these options stay on screen", () => {
    expect(timingMode(ov("clock", { size: 8 }))).toBe("always");
    expect(isOverlayVisible(ov("logo", {}, { published_at: pub }), ctx(99_999))).toBe(true);
  });
  it("'Stays on screen' keeps it up even with an old duration left in it", () => {
    expect(isOverlayVisible(ov("clock", { show_mode: "always", duration: 15 }, { published_at: pub }), ctx(99_999))).toBe(true);
  });
  it("clock set to 'once' shows for its seconds after Show now, then says its time is over", () => {
    const o = ov("clock", { show_mode: "once", duration: 30 }, { published_at: pub });
    expect(isOverlayVisible(o, ctx(20))).toBe(true);
    expect(hiddenReason(o, ctx(40))).toBe("timer_done");
  });
  it("logo set to repeat comes back every N minutes", () => {
    const o = ov("logo", { show_mode: "repeat", duration: 20, every: 2 }, { published_at: pub });
    expect(isOverlayVisible(o, ctx(10))).toBe(true);
    expect(hiddenReason(o, ctx(60))).toBe("waiting");
    expect(isOverlayVisible(o, ctx(125))).toBe(true);
  });
  it("ON AIR still needs a programme playing, whatever the timing", () => {
    expect(hiddenReason(ov("on_air", { show_mode: "always" }), ctx(5, { live: false }))).toBe("needs_programme");
  });
  it("now showing can be set to 'once' from Show now instead of the programme start", () => {
    const o = ov("now_showing", { show_mode: "once", duration: 10 }, { published_at: pub });
    expect(isOverlayVisible(o, ctx(5))).toBe(true);
    expect(isOverlayVisible(o, ctx(605))).toBe(false);
  });
  it("explains a graphic waiting for its display window", () => {
    expect(hiddenReason(ov("clock", {}, { show_from: "2026-11-12T12:00:00Z" }), ctx(0))).toBe("before_window");
  });
});
