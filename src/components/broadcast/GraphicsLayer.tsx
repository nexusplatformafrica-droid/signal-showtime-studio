import { isOverlayVisible, overlayRemainingMs, type GraphicsContext, type LiveOverlay } from "@/lib/graphics";
import { cardPhase, cardTextFor, type CardPhase } from "@/lib/brand-cards";
import { BrandCard } from "@/components/broadcast/BrandCard";
import { NewsCard } from "@/components/broadcast/NewsCard";
import { TickerCard } from "@/components/broadcast/TickerCard";
import { BreakingCard } from "@/components/broadcast/BreakingCard";
import { PopupCard } from "@/components/broadcast/PopupCard";
import { newsTextFor } from "@/lib/news-cards";
import { KIT_DEFAULTS, kitTextFor, type KitKind } from "@/lib/card-kits";
import { ClockCard, LogoMark, NowShowingCard, OnAirCard } from "@/components/broadcast/BadgeCards";
import { BADGE_DEFAULTS, clockParts, nowShowingText } from "@/lib/badge-kits";
import { cn } from "@/lib/utils";

const pos = (p?: string) => {
  switch (p) {
    case "top-left": return "left-[3%] top-[4%]";
    case "top-center": return "left-1/2 top-[4%] -translate-x-1/2";
    case "top-right": return "right-[3%] top-[4%]";
    case "bottom-left": return "bottom-[12%] left-[3%]";
    case "bottom-center": return "bottom-[12%] left-1/2 -translate-x-1/2";
    case "bottom-right": return "bottom-[12%] right-[3%]";
    default: return "inset-x-0 bottom-0";
  }
};
const BARS = new Set(["ticker", "breaking_news"]);

function groupByPosition(list: LiveOverlay[]): [string, LiveOverlay[]][] {
  const m = new Map<string, LiveOverlay[]>();
  for (const o of list) {
    const p = o.config.position ?? "top-right";
    m.set(p, [...(m.get(p) ?? []), o]);
  }
  return [...m.entries()];
}

/**
 * Broadcast graphics drawn over the picture. Sizes scale with the player width (container
 * units), so the website, the 1920×1080 output page and the admin preview match.
 */
export interface GraphicsReplay { id: string; key: number; phase: CardPhase }

export function GraphicsLayer({ overlays, ctx, timezone, className, replay }: { overlays: LiveOverlay[]; ctx: GraphicsContext; timezone: string; className?: string; replay?: GraphicsReplay | null }) {
  const visible = overlays.filter((o) => isOverlayVisible(o, ctx));
  const bars = visible.filter((o) => BARS.has(o.kind) && (o.config.position ?? "bottom") === "bottom")
    .sort((a, b) => (a.kind === "breaking_news" ? 0 : 1) - (b.kind === "breaking_news" ? 0 : 1));
  const placed = visible.filter((o) => !bars.includes(o));
  const fs = { fontSize: "clamp(7px, 1.6cqw, 40px)" };

  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden text-foreground", className)} style={{ containerType: "inline-size" }} aria-hidden>
      {groupByPosition(placed).map(([position, items]) => (
        <div key={position} className={cn("absolute flex gap-[0.8cqw]", position.startsWith("top") ? "items-start" : "flex-col-reverse items-start", position.endsWith("right") && "flex-row-reverse", pos(position))}>
      {items.map((o) => {
        const c = o.config;
        if (o.kind === "next_programme") {
          const rp = replay?.id === o.id ? replay : null;
          const phase = rp ? rp.phase : cardPhase(overlayRemainingMs(o, ctx), Number(c.transition_ms) || 700);
          const text = cardTextFor(c, { title: ctx.nextTitle ?? "", startsAt: ctx.nextStartsAt ?? null, now: ctx.now, timezone });
          return <div key={`${o.id}:${rp?.key ?? ""}`} style={{ opacity: c.opacity ?? 1 }}><BrandCard config={c} text={text} phase={phase} /></div>;
        }
        if (KIT_KINDS.has(o.kind)) return <Kit key={`${o.id}:${replay?.id === o.id ? replay.key : ""}`} o={o} ctx={ctx} timezone={timezone} replay={replay} />;
        if (o.kind === "lower_third") {
          const rp = replay?.id === o.id ? replay : null;
          const phase = rp ? rp.phase : cardPhase(overlayRemainingMs(o, ctx), Number(c.transition_ms) || 700);
          return <div key={`${o.id}:${rp?.key ?? ""}`} style={{ opacity: c.opacity ?? 1 }}><NewsCard config={c} text={newsTextFor(c, ctx.now, timezone)} phase={phase} /></div>;
        }
        const rp = replay?.id === o.id ? replay : null;
        const key = `${o.id}:${rp?.key ?? ""}`;
        const style = { opacity: c.opacity ?? 1 };
        const phase = rp ? rp.phase : cardPhase(overlayRemainingMs(o, ctx), Number(c.transition_ms) || 700);
        if (o.kind === "now_showing" || o.kind === "programme_title") {
          return <div key={key} style={style}><NowShowingCard config={c} text={nowShowingText(c, ctx.title, ctx.now, timezone)} phase={phase} /></div>;
        }
        if (o.kind === "clock") return <div key={key} style={style}><ClockCard config={c} parts={clockParts(ctx.now, timezone, { h12: c.h12, seconds: c.seconds })} label={c.kicker ?? BADGE_DEFAULTS.clock.kicker} phase={phase} /></div>;
        if (o.kind === "on_air" || o.kind === "live_indicator") return <div key={key} style={style}><OnAirCard config={o.kind === "live_indicator" && !c.text ? { ...c, text: "LIVE" } : c} phase={phase} /></div>;
        if (o.kind === "logo") return <div key={key} style={style}><LogoMark config={c} phase={phase} /></div>;
        return (
          <div key={o.id} style={{ ...style, maxWidth: `${Math.max(c.size ?? 30, 30)}cqw` }}>
            {(o.kind === "station_id" || o.kind === "countdown") && <span className="inline-block bg-inset/90 px-[0.6em] py-[0.3em] font-semibold" style={fs}>{c.text || o.name}</span>}
          </div>
        );
      })}
        </div>
      ))}
      {bars.length > 0 && (
        <div className="absolute inset-x-0 bottom-0 flex flex-col">
          {bars.map((o) => <Kit key={`${o.id}:${replay?.id === o.id ? replay.key : ""}`} o={o} ctx={ctx} timezone={timezone} replay={replay} bar />)}
        </div>
      )}
    </div>
  );
}

const KIT_KINDS = new Set(["ticker", "breaking_news", "ad_banner"]);

/** Rolling ticker, breaking news banner or pop-up card, with its appear/disappear timing. */
function Kit({ o, ctx, timezone, replay, bar }: { o: LiveOverlay; ctx: GraphicsContext; timezone: string; replay?: GraphicsReplay | null | undefined; bar?: boolean }) {
  const c = o.config;
  const kind = o.kind as KitKind;
  const rp = replay?.id === o.id ? replay : null;
  const phase = rp ? rp.phase : cardPhase(overlayRemainingMs(o, ctx), Number(c.transition_ms) || 700);
  const text = kitTextFor(c, ctx.now, timezone, KIT_DEFAULTS[kind]);
  const style = { opacity: c.opacity ?? 1 };
  if (kind === "ticker") return <div style={style} className={bar ? "" : "w-full"}><TickerCard config={c} text={text} phase={phase} width={bar ? 100 : undefined} /></div>;
  if (kind === "breaking_news") return <div style={style} className={bar ? "pb-[1.2cqw] pl-[3cqw]" : ""}><BreakingCard config={c} text={text} phase={phase} /></div>;
  return <div style={style}><PopupCard config={c} text={text} phase={phase} /></div>;
}
