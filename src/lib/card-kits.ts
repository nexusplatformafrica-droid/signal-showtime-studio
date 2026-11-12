/**
 * Design kits for the rolling ticker, the breaking news banner and the pop-up card
 * ("anytime" graphics). Same idea as news-cards.ts: a list of designs, ready-made wordings,
 * and one pure helper that fills the text so every screen shows the same thing.
 */
import { fillNewsText, headlineIndex, newsHeadlines } from "@/lib/news-cards";

export interface KitDesign { id: string; name: string; c1: string; c2: string; note?: string }
export interface KitTemplate { id: string; name: string; patch: Record<string, string> }

export const TICKER_DESIGNS: KitDesign[] = [
  { id: "classic", name: "Classic red", c1: "#e11d2a", c2: "#111827" },
  { id: "blue-white", name: "Blue & white", c1: "#1e3a8a", c2: "#7c3aed" },
  { id: "channel", name: "Channel box", c1: "#a21caf", c2: "#111111" },
  { id: "navy-yellow", name: "Navy & yellow", c1: "#1e2a8a", c2: "#fbbf24" },
  { id: "pill", name: "Blue pill", c1: "#0b84e8", c2: "#38bdf8" },
  { id: "diamond", name: "Diamond", c1: "#1f3a4d", c2: "#0ea5e9" },
  { id: "green-live", name: "Green live", c1: "#16a34a", c2: "#111827" },
  { id: "orange-slant", name: "Orange slant", c1: "#f97316", c2: "#1e40af" },
  { id: "purple", name: "Purple glow", c1: "#6d28d9", c2: "#d946ef" },
  { id: "glass", name: "Dark glass", c1: "#e11d2a", c2: "#0f172a" },
  { id: "tab", name: "Top tab", c1: "#1d4ed8", c2: "#e11d2a" },
];

export const BREAKING_DESIGNS: KitDesign[] = [
  { id: "by-top-tag", name: "Top tag", c1: "#1e2a9c", c2: "#fbbf24" },
  { id: "by-hd-box", name: "HD box", c1: "#2563eb", c2: "#fbbf24" },
  { id: "by-tag-right", name: "Tag right", c1: "#2563eb", c2: "#fbbf24" },
  { id: "by-hd-circle", name: "HD circle", c1: "#1e2a9c", c2: "#fbbf24" },
  { id: "by-reporter", name: "Live reporter", c1: "#1e2a9c", c2: "#fbbf24" },
  { id: "by-notched", name: "Notched", c1: "#2563eb", c2: "#fbbf24" },
  { id: "by-speech", name: "News bubble", c1: "#2563eb", c2: "#fbbf24" },
  { id: "by-rounded", name: "Rounded", c1: "#1e2a9c", c2: "#fbbf24" },
  { id: "day-blue", name: "Day box blue", c1: "#1d4ed8", c2: "#0f172a", note: "shows today's date" },
  { id: "day-green", name: "Day box green", c1: "#16a34a", c2: "#0f172a", note: "shows today's date" },
  { id: "day-red", name: "Day box red", c1: "#dc2626", c2: "#0f172a", note: "shows today's date" },
  { id: "day-orange", name: "Orange circle", c1: "#f59e0b", c2: "#ea580c", note: "shows today's date" },
  { id: "day-teal", name: "Teal news tab", c1: "#0d9488", c2: "#f59e0b" },
  { id: "day-purple", name: "Purple live", c1: "#7c3aed", c2: "#0f172a" },
  { id: "day-slant", name: "Orange slant", c1: "#f97316", c2: "#1e40af" },
  { id: "day-circle", name: "Blue circle", c1: "#1d4ed8", c2: "#0f172a", note: "shows today's date" },
];

export const POPUP_DESIGNS: KitDesign[] = [
  { id: "step-left", name: "Step card", c1: "#1d6fd1", c2: "#1d6fd1" },
  { id: "step-3d", name: "3D card left", c1: "#2dd4bf", c2: "#0f766e" },
  { id: "step-3d-right", name: "3D card right", c1: "#fb923c", c2: "#c2410c" },
  { id: "diamond-dark", name: "Dark diamond", c1: "#253f4f", c2: "#334155" },
  { id: "diamond-blue", name: "Blue diamond", c1: "#0ea5e9", c2: "#3f5d73" },
  { id: "diamond-pop", name: "Diamond pop", c1: "#16215a", c2: "#a5e4f7" },
  { id: "pill-icon", name: "Icon pill", c1: "#7c3aed", c2: "#f59e0b" },
  { id: "promo", name: "Promo tag", c1: "#dc2626", c2: "#fbbf24" },
  { id: "social", name: "Follow us", c1: "#ec4899", c2: "#8b5cf6" },
  { id: "call", name: "Call now", c1: "#16a34a", c2: "#facc15" },
];

export const designIn = (list: KitDesign[], id?: string): KitDesign => list.find((d) => d.id === id) ?? list[0]!;

export const TICKER_TEMPLATES: KitTemplate[] = [
  { id: "latest", name: "Latest news", patch: { kicker: "LATEST NEWS" } },
  { id: "headlines", name: "Headlines", patch: { kicker: "HEADLINES" } },
  { id: "breaking", name: "Breaking", patch: { kicker: "BREAKING" } },
  { id: "sports", name: "Sports", patch: { kicker: "SPORTS" } },
  { id: "business", name: "Business", patch: { kicker: "BUSINESS" } },
  { id: "weather", name: "Weather", patch: { kicker: "WEATHER" } },
  { id: "notices", name: "Announcements", patch: { kicker: "ANNOUNCEMENTS" } },
  { id: "coming", name: "Coming up", patch: { kicker: "COMING UP" } },
  { id: "shout", name: "Shout-outs", patch: { kicker: "SHOUT-OUTS" } },
];

export const BREAKING_TEMPLATES: KitTemplate[] = [
  { id: "breaking", name: "Breaking news", patch: { kicker: "BREAKING NEWS", tag: "LIVE" } },
  { id: "morning", name: "Morning live", patch: { kicker: "BREAKING NEWS", tag: "MORNING LIVE" } },
  { id: "reporter", name: "Live reporter", patch: { kicker: "BREAKING NEWS", tag: "LIVE REPORTER" } },
  { id: "just-in", name: "Just in", patch: { kicker: "JUST IN", tag: "LIVE" } },
  { id: "developing", name: "Developing", patch: { kicker: "DEVELOPING STORY", tag: "LIVE" } },
  { id: "alert", name: "News alert", patch: { kicker: "NEWS ALERT", tag: "URGENT" } },
  { id: "flash", name: "News flash", patch: { kicker: "NEWS FLASH", tag: "LIVE" } },
  { id: "latest", name: "Latest news", patch: { kicker: "LATEST NEWS", tag: "HD TV" } },
];

export const POPUP_TEMPLATES: KitTemplate[] = [
  { id: "step", name: "Step 01", patch: { badge: "STEP\n01", kicker: "STEP ONE", icon: "users" } },
  { id: "did-you-know", name: "Did you know", patch: { badge: "", kicker: "DID YOU KNOW?", icon: "info" } },
  { id: "follow", name: "Follow us", patch: { badge: "", kicker: "FOLLOW US", icon: "heart" } },
  { id: "call", name: "Call now", patch: { badge: "", kicker: "CALL NOW", icon: "phone" } },
  { id: "sms", name: "SMS to vote", patch: { badge: "", kicker: "SMS TO VOTE", icon: "message" } },
  { id: "promo", name: "Promo", patch: { badge: "", kicker: "SPECIAL OFFER", icon: "gift" } },
  { id: "win", name: "Competition", patch: { badge: "", kicker: "WIN BIG", icon: "trophy" } },
  { id: "reminder", name: "Reminder", patch: { badge: "", kicker: "DON'T FORGET", icon: "calendar" } },
  { id: "web", name: "Website", patch: { badge: "", kicker: "VISIT US ONLINE", icon: "globe" } },
];

export const POPUP_ICONS = ["users", "mail", "star", "phone", "message", "home", "rss", "cart", "globe", "heart", "info", "calendar", "trophy", "megaphone", "mic", "tv", "music", "gift", "none"] as const;

export interface KitText {
  tag: string;
  kicker: string;
  /** The line on screen now (rotates through `lines`). */
  line: string;
  lines: string[];
  index: number;
  subtitle: string;
  badge: string;
  time: string;
}

export interface KitConfig {
  tag?: string | undefined;
  kicker?: string | undefined;
  title?: string | undefined;
  text?: string | undefined;
  subtitle?: string | undefined;
  badge?: string | undefined;
  time_text?: string | undefined;
  rotate?: number | undefined;
}

/** Fill a kit's text: {clock}, {date} and {day} (day of month) in the channel timezone; lines rotate on the shared clock. */
export function kitTextFor(c: KitConfig, now: number, tz: string, defaults: { kicker: string; line: string }): KitText {
  const raw = (c.title ?? c.text ?? "").trim() ? (c.title ?? c.text) : defaults.line;
  const lines = newsHeadlines(raw).map((l) => fillNewsText(l, now, tz));
  const index = headlineIndex(lines.length, now, c.rotate);
  return {
    tag: fillNewsText(c.tag ?? "LIVE", now, tz),
    kicker: fillNewsText(c.kicker ?? defaults.kicker, now, tz),
    line: lines[index] ?? "",
    lines,
    index,
    subtitle: fillNewsText(c.subtitle, now, tz),
    badge: fillNewsText(c.badge, now, tz),
    time: fillNewsText(c.time_text ?? "{clock}", now, tz),
  };
}

/** One crawl string from the ticker items. */
export function tickerLine(lines: string[], sep = "◆") {
  return lines.join(`   ${sep || "•"}   `);
}
