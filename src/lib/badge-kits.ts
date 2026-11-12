/**
 * Design kits for the small always-on graphics: "Now showing", the local-time clock, the
 * ON AIR / LIVE tag and the text under the channel logo (watermark). Same pattern as
 * card-kits.ts: design lists, ready-made wordings and pure text helpers shared by every screen.
 */
import { fillNewsText } from "@/lib/news-cards";
import type { KitDesign, KitTemplate } from "@/lib/card-kits";

export type BadgeKind = "now_showing" | "clock" | "on_air" | "logo";

export const NOW_DESIGNS: KitDesign[] = [
  { id: "tab", name: "Top tab", c1: "#e11d2a", c2: "#111827" },
  { id: "pill", name: "Play pill", c1: "#f97316", c2: "#16a34a" },
  { id: "glass", name: "Dark glass", c1: "#22d3ee", c2: "#0f172a" },
  { id: "split", name: "Split slant", c1: "#1d4ed8", c2: "#fbbf24" },
  { id: "neon", name: "Neon glow", c1: "#d946ef", c2: "#22d3ee" },
  { id: "ribbon", name: "Arrow ribbon", c1: "#dc2626", c2: "#111827" },
  { id: "film", name: "Film strip", c1: "#f59e0b", c2: "#111111" },
  { id: "bar", name: "Side bar", c1: "#10b981", c2: "#0f172a" },
  { id: "logo-box", name: "Logo box", c1: "#7c3aed", c2: "#f59e0b", note: "uses your logo" },
  { id: "gradient", name: "Gradient", c1: "#f97316", c2: "#db2777" },
  { id: "minimal", name: "Minimal", c1: "#fbbf24", c2: "#ffffff" },
  { id: "ticket", name: "Cinema ticket", c1: "#e11d2a", c2: "#fbbf24" },
];

export const CLOCK_DESIGNS: KitDesign[] = [
  { id: "plain", name: "Plain box", c1: "#111827", c2: "#e11d2a" },
  { id: "pill", name: "White pill", c1: "#e11d2a", c2: "#111827" },
  { id: "date-block", name: "Date block", c1: "#1d4ed8", c2: "#111827", note: "shows the date" },
  { id: "digital", name: "Digital LED", c1: "#22c55e", c2: "#050505" },
  { id: "city", name: "City name", c1: "#f97316", c2: "#0f172a" },
  { id: "tab", name: "Top tab", c1: "#7c3aed", c2: "#111827" },
  { id: "glass", name: "Glass", c1: "#38bdf8", c2: "#0f172a" },
  { id: "analog", name: "Clock face", c1: "#e11d2a", c2: "#111827" },
  { id: "circle", name: "Round", c1: "#0ea5e9", c2: "#111827" },
  { id: "slant", name: "Two-tone slant", c1: "#dc2626", c2: "#1e3a8a", note: "shows the date" },
  { id: "neon", name: "Neon", c1: "#f0abfc", c2: "#a21caf" },
  { id: "calendar", name: "Calendar", c1: "#16a34a", c2: "#111827", note: "shows the date" },
];

export const ONAIR_DESIGNS: KitDesign[] = [
  { id: "tally", name: "Red tally", c1: "#e11d2a", c2: "#ffffff" },
  { id: "pill", name: "Dot pill", c1: "#e11d2a", c2: "#111827" },
  { id: "outline", name: "Outline", c1: "#ef4444", c2: "#111827" },
  { id: "neon", name: "Neon sign", c1: "#ff2d55", c2: "#ff9f0a" },
  { id: "rec", name: "REC", c1: "#ef4444", c2: "#050505" },
  { id: "split", name: "Split tag", c1: "#e11d2a", c2: "#111827", note: "uses the small tag" },
  { id: "waves", name: "Radio waves", c1: "#f97316", c2: "#111827" },
  { id: "glass", name: "Glass", c1: "#ef4444", c2: "#0f172a" },
  { id: "slant", name: "Slant", c1: "#dc2626", c2: "#fbbf24" },
  { id: "circle", name: "Round badge", c1: "#e11d2a", c2: "#ffffff" },
  { id: "tv", name: "Live TV", c1: "#16a34a", c2: "#111827", note: "uses the small tag" },
  { id: "pulse", name: "Pulse ring", c1: "#e11d2a", c2: "#ffffff" },
];

/** Styles for the text under / next to the channel logo. */
export const CAPTION_DESIGNS: KitDesign[] = [
  { id: "plain", name: "Plain", c1: "#ffffff", c2: "#e11d2a" },
  { id: "spaced", name: "Wide spaced", c1: "#ffffff", c2: "#fbbf24" },
  { id: "pill", name: "Pill", c1: "#e11d2a", c2: "#ffffff" },
  { id: "box", name: "Solid box", c1: "#f97316", c2: "#ffffff" },
  { id: "outline", name: "Outline", c1: "#ffffff", c2: "#e11d2a" },
  { id: "gradient", name: "Gradient text", c1: "#f97316", c2: "#facc15" },
  { id: "glow", name: "Neon glow", c1: "#22d3ee", c2: "#d946ef" },
  { id: "lines", name: "Side lines", c1: "#ffffff", c2: "#fbbf24" },
  { id: "slant", name: "Slant box", c1: "#1d4ed8", c2: "#ffffff" },
  { id: "glass", name: "Glass", c1: "#ffffff", c2: "#38bdf8" },
  { id: "stamp", name: "Sticker", c1: "#facc15", c2: "#111827" },
  { id: "gold", name: "Gold", c1: "#fde68a", c2: "#b45309" },
  { id: "split", name: "Two-tone", c1: "#e11d2a", c2: "#111827" },
  { id: "dots", name: "Dots", c1: "#ffffff", c2: "#22c55e" },
];

export const CAPTION_PLACES = [
  { id: "below", name: "Under the logo" },
  { id: "right", name: "Right of the logo" },
  { id: "left", name: "Left of the logo" },
  { id: "above", name: "Above the logo" },
] as const;

export const NOW_TEMPLATES: KitTemplate[] = [
  { id: "now", name: "Now showing", patch: { kicker: "NOW SHOWING" } },
  { id: "watching", name: "You're watching", patch: { kicker: "YOU'RE WATCHING" } },
  { id: "on-now", name: "On now", patch: { kicker: "ON NOW" } },
  { id: "playing", name: "Now playing", patch: { kicker: "NOW PLAYING" } },
  { id: "airing", name: "Currently airing", patch: { kicker: "CURRENTLY AIRING" } },
  { id: "movie", name: "Movie time", patch: { kicker: "MOVIE TIME" } },
  { id: "premiere", name: "Premiere", patch: { kicker: "PREMIERE" } },
  { id: "channel", name: "On MOVIE MAX", patch: { kicker: "NOW ON MOVIE MAX" } },
];

export const CLOCK_TEMPLATES: KitTemplate[] = [
  { id: "kampala", name: "Kampala", patch: { kicker: "KAMPALA" } },
  { id: "local", name: "Local time", patch: { kicker: "LOCAL TIME" } },
  { id: "uganda", name: "Uganda", patch: { kicker: "UGANDA" } },
  { id: "eat", name: "EAT", patch: { kicker: "EAT" } },
  { id: "time", name: "Time", patch: { kicker: "TIME" } },
  { id: "none", name: "No label", patch: { kicker: "" } },
];

export const ONAIR_TEMPLATES: KitTemplate[] = [
  { id: "on-air", name: "On air", patch: { text: "ON AIR", tag: "" } },
  { id: "live", name: "Live", patch: { text: "LIVE", tag: "" } },
  { id: "live-hd", name: "Live HD", patch: { text: "LIVE", tag: "HD" } },
  { id: "live-now", name: "Live now", patch: { text: "LIVE NOW", tag: "" } },
  { id: "channel", name: "Live · channel", patch: { text: "LIVE", tag: "MOVIE MAX" } },
  { id: "247", name: "24/7", patch: { text: "ON AIR", tag: "24/7" } },
  { id: "rec", name: "REC", patch: { text: "REC", tag: "" } },
  { id: "exclusive", name: "Exclusive", patch: { text: "EXCLUSIVE", tag: "LIVE" } },
];

export const CAPTION_TEMPLATES: KitTemplate[] = [
  { id: "tv", name: "TV", patch: { caption: "TV" } },
  { id: "hd", name: "HD", patch: { caption: "HD" } },
  { id: "tv-hd", name: "TV HD", patch: { caption: "TV HD" } },
  { id: "247", name: "24/7", patch: { caption: "24/7" } },
  { id: "uganda", name: "Uganda", patch: { caption: "UGANDA" } },
  { id: "movies", name: "Movies", patch: { caption: "MOVIES" } },
  { id: "live", name: "Live", patch: { caption: "LIVE" } },
  { id: "none", name: "No text", patch: { caption: "" } },
];

export const badgeDesigns = (k: BadgeKind) => (k === "now_showing" ? NOW_DESIGNS : k === "clock" ? CLOCK_DESIGNS : k === "on_air" ? ONAIR_DESIGNS : CAPTION_DESIGNS);
export const badgeTemplates = (k: BadgeKind) => (k === "now_showing" ? NOW_TEMPLATES : k === "clock" ? CLOCK_TEMPLATES : k === "on_air" ? ONAIR_TEMPLATES : CAPTION_TEMPLATES);

export interface ClockParts { time: string; hm: string; seconds: string; ampm: string; weekday: string; day: string; month: string; date: string; hours: number; minutes: number }

/** Clock pieces in the channel timezone, 24-hour by default. */
export function clockParts(now: number, tz: string, opts: { h12?: boolean | undefined; seconds?: boolean | undefined } = {}): ClockParts {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", weekday: "short", day: "numeric", month: "short" })
      .formatToParts(now).map((p) => [p.type, p.value]),
  ) as Partial<Record<"hour" | "minute" | "second" | "weekday" | "day" | "month", string>>;
  const h24 = Number(parts.hour) % 24;
  const minutes = Number(parts.minute);
  const h = opts.h12 ? String(h24 % 12 || 12) : String(h24).padStart(2, "0");
  const hm = `${h}:${parts.minute}`;
  return {
    hm,
    time: opts.seconds ? `${hm}:${parts.second}` : hm,
    seconds: parts.second ?? "00",
    ampm: opts.h12 ? (h24 < 12 ? "AM" : "PM") : "",
    weekday: (parts.weekday ?? "").toUpperCase(),
    day: parts.day ?? "",
    month: (parts.month ?? "").toUpperCase(),
    date: `${(parts.weekday ?? "").toUpperCase()} ${parts.day} ${(parts.month ?? "").toUpperCase()}`,
    hours: h24,
    minutes,
  };
}

export interface NowText { kicker: string; title: string; subtitle: string; badge: string; time: string }

/** "Now showing" text: the programme's own title unless the operator typed one. */
export function nowShowingText(c: { kicker?: string | undefined; title?: string | undefined; subtitle?: string | undefined; badge?: string | undefined; time_text?: string | undefined }, programme: string | null, now: number, tz: string): NowText {
  const typed = (c.title ?? "").trim();
  return {
    kicker: fillNewsText(c.kicker ?? "NOW SHOWING", now, tz),
    title: typed ? fillNewsText(typed, now, tz) : programme ?? "Programme title",
    subtitle: fillNewsText(c.subtitle, now, tz),
    badge: fillNewsText(c.badge, now, tz),
    time: fillNewsText(c.time_text ?? "", now, tz),
  };
}

/** What each badge kind shows before anything is typed. */
export const BADGE_DEFAULTS = {
  on_air: { text: "ON AIR" },
  clock: { kicker: "KAMPALA" },
  logo: { caption: "TV" },
} as const;
