/**
 * Branded news lower thirds: designs, text templates and the pure helpers that fill the
 * text (live clock, date, rotating headlines). Drawn by `NewsCard` on the website, the
 * /output page (OBS → Wowza) and the admin studio, using the same transitions as Up next.
 */

export interface NewsDesign {
  id: string;
  name: string;
  c1: string;
  c2: string;
  /** Has a second (description) line. */
  sub: boolean;
}

export const NEWS_DESIGNS: NewsDesign[] = [
  { id: "angled", name: "Angled blue", c1: "#1d3fd6", c2: "#e11d2a", sub: false },
  { id: "gradient", name: "Gradient pill", c1: "#1e2fb8", c2: "#e0102a", sub: true },
  { id: "red-lines", name: "Red speed lines", c1: "#e50914", c2: "#111111", sub: true },
  { id: "tag-left", name: "White · tag left", c1: "#e11d2a", c2: "#1f1f23", sub: true },
  { id: "tag-right", name: "White · tag right", c1: "#e11d2a", c2: "#1f1f23", sub: true },
  { id: "tag-inset", name: "White · inset line", c1: "#e11d2a", c2: "#1f1f23", sub: true },
  { id: "purple-clock", name: "Purple clock", c1: "#6d28d9", c2: "#c026d3", sub: true },
  { id: "purple-arrow", name: "Purple arrow", c1: "#5b21b6", c2: "#d946ef", sub: true },
  { id: "purple-pill", name: "Purple pill", c1: "#4c1d95", c2: "#c026d3", sub: true },
  { id: "blue-curve", name: "Blue curve", c1: "#1d6fe0", c2: "#0ea5e9", sub: false },
  { id: "blue-circle", name: "Blue circle", c1: "#0b84e8", c2: "#38bdf8", sub: false },
  { id: "blue-live", name: "Blue live box", c1: "#0b6fe0", c2: "#3b9bff", sub: false },
  { id: "blue-tab", name: "Blue news tab", c1: "#1e40af", c2: "#7dd3fc", sub: true },
  { id: "blue-center", name: "Blue centre", c1: "#1e3a8a", c2: "#7dd3fc", sub: true },
  { id: "blue-tv", name: "Blue TV box", c1: "#1d4ed8", c2: "#bfdbfe", sub: true },
];

export const newsDesignById = (id?: string): NewsDesign => NEWS_DESIGNS.find((d) => d.id === id) ?? NEWS_DESIGNS[0]!;

export interface NewsTemplate {
  id: string;
  name: string;
  /** Small tag over the bar. */
  kicker: string;
  /** Text in the logo box (two lines with "\n"); empty = channel name. */
  badge: string;
  subtitle: string;
}

/** {clock} = current time, {date} = today's date — both in the channel timezone. */
export const NEWS_TEMPLATES: NewsTemplate[] = [
  { id: "breaking", name: "Breaking news", kicker: "BREAKING NEWS", badge: "", subtitle: "" },
  { id: "live", name: "Live", kicker: "LIVE", badge: "LIVE", subtitle: "" },
  { id: "news", name: "News", kicker: "NEWS", badge: "TV\nNEWS", subtitle: "" },
  { id: "latest", name: "Latest", kicker: "LATEST NEWS", badge: "", subtitle: "" },
  { id: "update", name: "News update", kicker: "NEWS UPDATE", badge: "", subtitle: "{date}" },
  { id: "just-in", name: "Just in", kicker: "JUST IN", badge: "", subtitle: "" },
  { id: "developing", name: "Developing story", kicker: "DEVELOPING STORY", badge: "", subtitle: "" },
  { id: "exclusive", name: "Exclusive", kicker: "EXCLUSIVE", badge: "", subtitle: "" },
  { id: "reporter", name: "Reporter", kicker: "REPORTING", badge: "", subtitle: "MOVIE MAX News, Kampala" },
  { id: "sports", name: "Sports", kicker: "SPORTS", badge: "SPORTS", subtitle: "" },
  { id: "business", name: "Business", kicker: "BUSINESS", badge: "", subtitle: "" },
  { id: "weather", name: "Weather", kicker: "WEATHER", badge: "", subtitle: "{date}" },
];

export interface NewsText {
  kicker: string;
  badge: string;
  headline: string;
  /** Which headline is showing (changes re-animate the text). */
  index: number;
  subtitle: string;
  time: string;
}

/** Headlines, one per line; blank lines dropped. */
export function newsHeadlines(title: string | undefined): string[] {
  const list = (title ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
  return list.length ? list : ["Your headline here"];
}

/** The headline on screen at `now`: rotates every `rotate` seconds from the clock, so every viewer sees the same one. */
export function headlineIndex(count: number, now: number, rotate = 8): number {
  if (count <= 1) return 0;
  return Math.floor(now / 1000 / Math.max(3, rotate)) % count;
}

export function newsClock(now: number, tz: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true }).format(now);
}

export function fillNewsText(s: string | undefined, now: number, tz: string): string {
  if (!s) return "";
  return s
    .replace(/\{clock\}/gi, newsClock(now, tz))
    .replace(/\{date\}/gi, new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short" }).format(now).toUpperCase())
    .trim();
}

export function newsTextFor(
  c: { kicker?: string | undefined; badge?: string | undefined; title?: string | undefined; subtitle?: string | undefined; time_text?: string | undefined; rotate?: number | undefined },
  now: number,
  tz: string,
): NewsText {
  const list = newsHeadlines(c.title);
  const index = headlineIndex(list.length, now, c.rotate);
  return {
    kicker: fillNewsText(c.kicker ?? "BREAKING NEWS", now, tz),
    badge: fillNewsText(c.badge, now, tz),
    headline: fillNewsText(list[index], now, tz),
    index,
    subtitle: fillNewsText(c.subtitle, now, tz),
    time: fillNewsText(c.time_text ?? "{clock}", now, tz),
  };
}
