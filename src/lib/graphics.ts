/**
 * Which on-screen graphics are visible right now. Shared by the website player, the
 * OBS/Wowza output page and the admin preview so all three show the same thing.
 */

export type OverlayKind =
  | "logo" | "clock" | "ticker" | "breaking_news" | "lower_third" | "now_showing" | "next_programme"
  | "on_air" | "live_indicator" | "ad_banner" | "station_id" | "programme_title" | "countdown";

export interface OverlayConfig {
  position?: string | undefined;
  size?: number | undefined;
  opacity?: number | undefined;
  color?: string | undefined;
  text?: string | undefined;
  title?: string | undefined;
  subtitle?: string | undefined;
  speed?: number | undefined;
  duration?: number | undefined;
  logo_url?: string | undefined;
  /** Branded card design (src/lib/brand-cards.ts) and its content. */
  design?: string | undefined;
  image_url?: string | undefined;
  kicker?: string | undefined;
  time_text?: string | undefined;
  color2?: string | undefined;
  transition_in?: string | undefined;
  transition_out?: string | undefined;
  transition_ms?: number | undefined;
  /** See `timingMode`: "always", "once"/"repeat" (from Show now), "cycle" (each programme start, every 10 min), "before_next". */
  show_mode?: "always" | "cycle" | "before_next" | "once" | "repeat" | undefined;
  lead?: number | undefined;
  /** News lower third: logo-box text, rotate headlines every N s, scroll the description line, repeat every N minutes. */
  badge?: string | undefined;
  rotate?: number | undefined;
  scroll?: boolean | undefined;
  every?: number | undefined;
  /** Ticker / breaking / pop-up kits: small tag, icon name and ticker separator. */
  tag?: string | undefined;
  icon?: string | undefined;
  sep?: string | undefined;
  /** Logo watermark: text under / next to the logo, where it sits and how big (percent of the logo width). */
  caption?: string | undefined;
  caption_pos?: "below" | "right" | "left" | "above" | undefined;
  caption_size?: number | undefined;
  /** Clock: 12-hour format, show seconds, show the date. ON AIR: blink the dot. */
  h12?: boolean | undefined;
  seconds?: boolean | undefined;
  show_date?: boolean | undefined;
  blink?: boolean | undefined;
}

/** Graphics the operator times themselves: stay up (duration 0), once after publishing, or repeat. */
export const OPERATOR_TIMED = new Set<OverlayKind>(["lower_third", "breaking_news", "ticker", "ad_banner"]);

export interface LiveOverlay {
  id: string;
  kind: OverlayKind;
  name: string;
  config: OverlayConfig;
  show_from: string | null;
  show_until: string | null;
  published_at: string | null;
}

export interface GraphicsContext {
  now: number;
  /** Something is actually playing (engine ON AIR or website playout). */
  live: boolean;
  title: string | null;
  nextTitle: string | null;
  /** When the next programme starts (ms), for "up next" times and "before next" timing. */
  nextStartsAt?: number | null;
  /** When the current programme started, for "now showing" timing. */
  programmeStartedAt: number | null;
}

/** Timed graphics reappear on this cycle (seconds) so late joiners still see them. */
export const GRAPHICS_CYCLE_S = 600;

export function asConfig(v: unknown): OverlayConfig {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as OverlayConfig) : {};
}

/**
 * How a graphic is timed. Every graphic can stay up, show once or repeat (timed from Show now /
 * Publish); "cycle" follows each programme start and "before_next" the next programme.
 */
export type TimingMode = "always" | "once" | "repeat" | "cycle" | "before_next";

const PROGRAMME_TIMED = new Set<OverlayKind>(["now_showing", "programme_title", "next_programme"]);

export function timingMode(o: { kind: OverlayKind; config: OverlayConfig }): TimingMode {
  const c = o.config;
  const dur = Math.max(0, Number(c.duration) || 0);
  if (c.show_mode === "before_next" && o.kind === "next_programme") return "before_next";
  if (c.show_mode === "always" || dur === 0) return "always";
  if (c.show_mode === "once" || c.show_mode === "repeat") return c.show_mode;
  if (c.show_mode === "cycle") return "cycle";
  // Saved before every graphic had these options.
  if (o.kind === "ad_banner") return "repeat";
  if (PROGRAMME_TIMED.has(o.kind) || o.kind === "station_id") return "cycle";
  return "once";
}

/** Why a graphic is not on viewers' screens right now (null = it is showing). */
export type HiddenReason = "before_window" | "after_window" | "needs_programme" | "needs_next" | "timer_done" | "waiting";

export function hiddenReason(o: LiveOverlay, ctx: GraphicsContext): HiddenReason | null {
  if (o.show_from && ctx.now < Date.parse(o.show_from)) return "before_window";
  if (o.show_until && ctx.now >= Date.parse(o.show_until)) return "after_window";
  const mode = timingMode(o);
  switch (o.kind) {
    case "on_air":
    case "live_indicator":
      if (!ctx.live) return "needs_programme";
      break;
    case "now_showing":
    case "programme_title":
      if (!ctx.live || !ctx.title) return "needs_programme";
      break;
    case "next_programme":
      if (!ctx.nextTitle && !o.config.title) return "needs_next";
      if (mode === "cycle" && !ctx.live) return "needs_programme";
      break;
  }
  if (timeLeftMs(o, ctx) != null) return null;
  return mode === "once" ? "timer_done" : mode === "cycle" && ctx.programmeStartedAt == null ? "needs_programme" : "waiting";
}

export function isOverlayVisible(o: LiveOverlay, ctx: GraphicsContext): boolean {
  return hiddenReason(o, ctx) === null;
}

/** Milliseconds left in the current on-screen window (Infinity = stays up), or null when outside it. */
function timeLeftMs(o: LiveOverlay, ctx: GraphicsContext): number | null {
  const dur = Math.max(0, Number(o.config.duration) || 0);
  const sincePublish = o.published_at ? (ctx.now - Date.parse(o.published_at)) / 1000 : 0;
  switch (timingMode(o)) {
    case "always":
      return Infinity;
    case "before_next":
      return beforeNextRemaining(o, ctx);
    case "once":
      return sincePublish >= 0 && sincePublish < dur ? (dur - sincePublish) * 1000 : null;
    case "repeat": {
      if (sincePublish < 0) return null;
      const t = sincePublish % repeatPeriod(o);
      return t < dur ? (dur - t) * 1000 : null;
    }
    case "cycle": {
      const since = o.kind === "station_id" ? sincePublish : ctx.programmeStartedAt != null ? (ctx.now - ctx.programmeStartedAt) / 1000 : null;
      if (since == null || since < 0) return null;
      // "Up next" sits right after "now showing" so they never overlap.
      const slot = o.kind === "next_programme" ? 1 : 0;
      const t = since % GRAPHICS_CYCLE_S;
      return t >= slot * dur && t < (slot + 1) * dur ? ((slot + 1) * dur - t) * 1000 : null;
    }
  }
}

/** Seconds between repeats (at least the graphic's own duration). */
function repeatPeriod(o: LiveOverlay): number {
  const dur = Math.max(0, Number(o.config.duration) || 0);
  return Math.max(dur + 1, (Number(o.config.every) || 10) * 60);
}

/** "Before next" window: from `lead` s before the next start, for `duration` s (0 = until it starts). Returns ms left, or null when outside. */
function beforeNextRemaining(o: LiveOverlay, ctx: GraphicsContext): number | null {
  if (ctx.nextStartsAt == null) return null;
  const lead = Math.max(5, Number(o.config.lead) || 120) * 1000;
  const dur = Math.max(0, Number(o.config.duration) || 0) * 1000;
  const from = ctx.nextStartsAt - lead;
  const until = dur > 0 ? Math.min(from + dur, ctx.nextStartsAt) : ctx.nextStartsAt;
  return ctx.now >= from && ctx.now < until ? until - ctx.now : null;
}

/** Milliseconds a visible timed graphic has left on screen (null = stays up), used to play its exit animation in time. */
export function overlayRemainingMs(o: LiveOverlay, ctx: GraphicsContext): number | null {
  const left = timeLeftMs(o, ctx);
  if (left == null) return 0;
  return Number.isFinite(left) ? Math.max(0, left) : null;
}

/** Seconds for one ticker pass at `speed` px/s across a 1920px-wide frame. */
export function tickerSeconds(text: string, speed = 60) {
  const px = 1920 + text.length * 22;
  return Math.max(8, px / Math.max(10, speed));
}

export interface PublishRow { config: unknown; enabled: boolean; published_config: unknown; published_enabled: boolean }

/**
 * Columns to write when publishing one graphic. The on-air timer (`published_at`) only restarts
 * for graphics whose design or on/off state actually changed, so publishing one card never
 * re-shows "once" cards that already played.
 */
export function publishPatch(row: PublishRow, draft: OverlayConfig, enabled: boolean, ts: string) {
  const changed = JSON.stringify(draft) !== JSON.stringify(row.published_config ?? null) || enabled !== row.published_enabled;
  return { config: draft, enabled, published_config: draft, published_enabled: enabled, ...(changed ? { published_at: ts } : {}) };
}

/** "Show now": put one graphic on air immediately, restarting its timer. */
export function showNowPatch(draft: OverlayConfig, ts: string) {
  return { config: draft, enabled: true, published_config: draft, published_enabled: true, published_at: ts };
}

/** "Take off air": remove one graphic from viewers straight away. */
export function takeOffPatch() {
  return { enabled: false, published_enabled: false };
}
