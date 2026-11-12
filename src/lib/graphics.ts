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
  /** "cycle" = after "now showing", every 10 minutes; "before_next" = `lead` seconds before the next programme starts. */
  show_mode?: "cycle" | "before_next" | undefined;
  lead?: number | undefined;
}

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

export function isOverlayVisible(o: LiveOverlay, ctx: GraphicsContext): boolean {
  if (o.show_from && ctx.now < Date.parse(o.show_from)) return false;
  if (o.show_until && ctx.now >= Date.parse(o.show_until)) return false;
  const dur = Math.max(0, Number(o.config.duration) || 0);
  const sinceStart = ctx.programmeStartedAt != null ? (ctx.now - ctx.programmeStartedAt) / 1000 : null;
  const sincePublish = o.published_at ? (ctx.now - Date.parse(o.published_at)) / 1000 : 0;
  const inCycle = (since: number | null, slot = 0) => {
    if (dur === 0) return true;
    if (since == null || since < 0) return false;
    const t = since % GRAPHICS_CYCLE_S;
    return t >= slot * dur && t < (slot + 1) * dur;
  };

  switch (o.kind) {
    case "on_air":
    case "live_indicator":
      return ctx.live;
    case "now_showing":
    case "programme_title":
      return ctx.live && !!ctx.title && inCycle(sinceStart);
    case "next_programme":
      if (!ctx.nextTitle && !o.config.title) return false;
      if (o.config.show_mode === "before_next") return beforeNextRemaining(o, ctx) != null;
      // Shown right after "now showing" so they never overlap.
      return ctx.live && inCycle(sinceStart, 1);
    case "lower_third":
      // Once, for `duration` seconds after it is published (0 = stays up).
      return dur === 0 || (sincePublish >= 0 && sincePublish < dur);
    case "ad_banner":
    case "station_id":
      return inCycle(sincePublish);
    default:
      return true;
  }
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
  const dur = Math.max(0, Number(o.config.duration) || 0);
  if (o.kind === "next_programme" && o.config.show_mode === "before_next") return beforeNextRemaining(o, ctx);
  if (dur === 0) return null;
  const slot = o.kind === "next_programme" ? 1 : 0;
  let since: number | null = null;
  if (o.kind === "next_programme" || o.kind === "now_showing" || o.kind === "programme_title") since = ctx.programmeStartedAt != null ? (ctx.now - ctx.programmeStartedAt) / 1000 : null;
  else if (o.kind === "lower_third") return o.published_at ? Math.max(0, dur * 1000 - (ctx.now - Date.parse(o.published_at))) : null;
  else if (o.kind === "ad_banner" || o.kind === "station_id") since = o.published_at ? (ctx.now - Date.parse(o.published_at)) / 1000 : 0;
  else return null;
  if (since == null) return null;
  const t = since % GRAPHICS_CYCLE_S;
  return Math.max(0, ((slot + 1) * dur - t) * 1000);
}

/** Seconds for one ticker pass at `speed` px/s across a 1920px-wide frame. */
export function tickerSeconds(text: string, speed = 60) {
  const px = 1920 + text.length * 22;
  return Math.max(8, px / Math.max(10, speed));
}
