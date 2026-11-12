/**
 * Which on-screen graphics are visible right now. Shared by the website player, the
 * OBS/Wowza output page and the admin preview so all three show the same thing.
 */

export type OverlayKind =
  | "logo" | "clock" | "ticker" | "breaking_news" | "lower_third" | "now_showing" | "next_programme"
  | "on_air" | "live_indicator" | "ad_banner" | "station_id" | "programme_title" | "countdown";

export interface OverlayConfig {
  position?: string;
  size?: number;
  opacity?: number;
  color?: string;
  text?: string;
  title?: string;
  subtitle?: string;
  speed?: number;
  duration?: number;
  logo_url?: string;
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
      // Shown right after "now showing" so they never overlap.
      return ctx.live && !!ctx.nextTitle && inCycle(sinceStart, 1);
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

/** Seconds for one ticker pass at `speed` px/s across a 1920px-wide frame. */
export function tickerSeconds(text: string, speed = 60) {
  const px = 1920 + text.length * 22;
  return Math.max(8, px / Math.max(10, speed));
}
