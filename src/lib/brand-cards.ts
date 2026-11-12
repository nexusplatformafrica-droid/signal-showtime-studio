/**
 * Branded "Up next" cards: the designs, text templates and transitions a designer picks from,
 * plus the pure helpers that fill in the text and decide the animation phase. Shared by the
 * website player, the /output page (OBS → Wowza) and the admin studio preview.
 */

export type CardPhase = "in" | "hold" | "out";

export interface BrandDesign {
  id: string;
  name: string;
  /** Default colours (user can override). */
  c1: string;
  c2: string;
  /** Looks best with a programme picture. */
  photo: boolean;
}

export const BRAND_DESIGNS: BrandDesign[] = [
  { id: "showcase", name: "Showcase panel", c1: "#1d4ed8", c2: "#38bdf8", photo: true },
  { id: "tonight", name: "Tonight bar", c1: "#1e1b4b", c2: "#f59e0b", photo: true },
  { id: "next-tab", name: "Next tab", c1: "#4c1d95", c2: "#f59e0b", photo: false },
  { id: "photo-card", name: "Photo card", c1: "#5b21b6", c2: "#f59e0b", photo: true },
  { id: "poster", name: "Poster strip", c1: "#4c1d95", c2: "#f59e0b", photo: true },
  { id: "promo", name: "Big promo", c1: "#581c87", c2: "#f59e0b", photo: false },
  { id: "glass-ring", name: "Glass ring", c1: "#d946ef", c2: "#22d3ee", photo: false },
  { id: "swoosh", name: "Swoosh", c1: "#ec4899", c2: "#8b5cf6", photo: false },
  { id: "flame", name: "Flame", c1: "#ea580c", c2: "#f97316", photo: false },
  { id: "blob", name: "Blob", c1: "#4f46e5", c2: "#c026d3", photo: false },
  { id: "neon", name: "Neon title", c1: "#d946ef", c2: "#3b82f6", photo: false },
  { id: "split", name: "Split wave", c1: "#f97316", c2: "#fdba74", photo: true },
  { id: "stripes", name: "Stripes", c1: "#ec4899", c2: "#f97316", photo: false },
  { id: "confetti", name: "Confetti", c1: "#1e1b4b", c2: "#facc15", photo: false },
  { id: "bokeh", name: "Bokeh", c1: "#7c3aed", c2: "#f43f5e", photo: false },
  { id: "classic", name: "Classic", c1: "#e5322d", c2: "#111827", photo: false },
];

export const designById = (id?: string) => BRAND_DESIGNS.find((d) => d.id === id) ?? BRAND_DESIGNS[BRAND_DESIGNS.length - 1];

export interface TextTemplate {
  id: string;
  name: string;
  kicker: string;
  subtitle: string;
  time: string;
}

/** {title} = next programme name, {time} = its start time, {day} = TODAY/TONIGHT/TOMORROW/weekday. */
export const TEXT_TEMPLATES: TextTemplate[] = [
  { id: "up-next", name: "Up next", kicker: "UP NEXT", subtitle: "", time: "{time}" },
  { id: "coming-up", name: "Coming up", kicker: "COMING UP", subtitle: "", time: "{time}" },
  { id: "next", name: "Next", kicker: "NEXT", subtitle: "", time: "" },
  { id: "tonight", name: "Tonight", kicker: "{day}", subtitle: "", time: "{time}" },
  { id: "later", name: "Later", kicker: "LATER", subtitle: "", time: "{time}" },
  { id: "this-day", name: "This day", kicker: "THIS {day}", subtitle: "", time: "{time}" },
  { id: "dont-miss", name: "Don't miss", kicker: "DON'T MISS", subtitle: "Only on MOVIE MAX", time: "{time}" },
  { id: "stay-tuned", name: "Stay tuned", kicker: "STAY TUNED", subtitle: "Coming up next", time: "" },
  { id: "recap", name: "Recap", kicker: "RECAP", subtitle: "", time: "" },
  { id: "premiere", name: "Premiere", kicker: "PREMIERE", subtitle: "Brand new episode", time: "{time}" },
];

export interface TransitionDef { id: string; name: string }
export const TRANSITIONS: TransitionDef[] = [
  { id: "slide-left", name: "Slide from left" },
  { id: "slide-right", name: "Slide from right" },
  { id: "slide-up", name: "Rise from bottom" },
  { id: "slide-down", name: "Drop from top" },
  { id: "fade", name: "Fade" },
  { id: "zoom", name: "Zoom" },
  { id: "pop", name: "Pop (bounce)" },
  { id: "wipe", name: "Wipe" },
  { id: "flip", name: "Flip" },
  { id: "blur", name: "Blur" },
  { id: "none", name: "Cut (no animation)" },
];

export interface CardVars { title: string; startsAt: number | null; now: number; timezone: string }

function dayWord(startsAt: number, now: number, tz: string) {
  const ymd = (t: number) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(t);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hourCycle: "h23" }).format(startsAt));
  if (ymd(startsAt) === ymd(now)) return hour >= 18 ? "TONIGHT" : "TODAY";
  if (ymd(startsAt) === ymd(now + 86_400_000)) return "TOMORROW";
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "long" }).format(startsAt).toUpperCase();
}

/** "5:20 PM" in the channel timezone. */
export function cardTime(startsAt: number, tz: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true }).format(startsAt);
}

/** Replace {title}, {time} and {day} in a text template line. */
export function fillCardText(template: string | undefined, v: CardVars): string {
  if (!template) return "";
  return template
    .replace(/\{title\}/gi, v.title)
    .replace(/\{time\}/gi, v.startsAt != null ? cardTime(v.startsAt, v.timezone) : "")
    .replace(/\{day\}/gi, v.startsAt != null ? dayWord(v.startsAt, v.now, v.timezone) : "TODAY")
    .trim();
}

/** Whether the card is entering, holding, or leaving, from how long it has left on screen. */
export function cardPhase(remainingMs: number | null, outMs: number): CardPhase {
  if (remainingMs == null) return "hold";
  return remainingMs <= Math.max(outMs, 1000) ? "out" : "hold";
}

/** CSS animation for a phase. "hold" keeps the enter animation so it never replays. */
export function transitionAnimation(phase: CardPhase, tIn = "slide-left", tOut = "fade", ms = 700): string | undefined {
  if (phase === "out") return tOut === "none" ? "mmx-out-cut 1ms linear forwards" : `mmx-out-${tOut} ${ms}ms cubic-bezier(.55,0,.75,.2) forwards`;
  if (tIn === "none") return undefined;
  const ease = tIn === "pop" ? "cubic-bezier(.34,1.56,.64,1)" : "cubic-bezier(.16,1,.3,1)";
  return `mmx-in-${tIn} ${ms}ms ${ease} both`;
}

export interface CardText { kicker: string; title: string; subtitle: string; time: string }

/** The four lines a card shows, from its config. Empty title/time fall back to the next programme automatically. */
export function cardTextFor(
  c: { kicker?: string; title?: string; subtitle?: string; time_text?: string },
  v: CardVars,
): CardText {
  return {
    kicker: fillCardText(c.kicker ?? "UP NEXT", v),
    title: fillCardText(c.title?.trim() ? c.title : "{title}", v),
    subtitle: fillCardText(c.subtitle, v),
    time: fillCardText(c.time_text ?? "{time}", v),
  };
}
