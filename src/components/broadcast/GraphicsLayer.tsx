import { Wordmark } from "@/components/brand/Wordmark";
import { formatClock } from "@/lib/broadcast";
import { isOverlayVisible, overlayRemainingMs, tickerSeconds, type GraphicsContext, type LiveOverlay } from "@/lib/graphics";
import { cardPhase, cardTextFor, type CardPhase } from "@/lib/brand-cards";
import { BrandCard } from "@/components/broadcast/BrandCard";
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
    .sort((a) => (a.kind === "breaking_news" ? -1 : 1));
  const placed = visible.filter((o) => !bars.includes(o));
  const fs = { fontSize: "clamp(7px, 1.6cqw, 40px)" };

  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden text-foreground", className)} style={{ containerType: "inline-size" }} aria-hidden>
      {groupByPosition(placed).map(([position, items]) => (
        <div key={position} className={cn("absolute flex gap-[0.8cqw]", position.startsWith("top") ? "items-start" : "flex-col-reverse items-start", position.endsWith("right") && "flex-row-reverse", pos(position))}>
      {items.map((o) => {
        const c = o.config;
        const accent = { backgroundColor: c.color ?? "var(--tally-program)" };
        if (o.kind === "next_programme") {
          const rp = replay?.id === o.id ? replay : null;
          const phase = rp ? rp.phase : cardPhase(overlayRemainingMs(o, ctx), Number(c.transition_ms) || 700);
          const text = cardTextFor(c, { title: ctx.nextTitle ?? "", startsAt: ctx.nextStartsAt ?? null, now: ctx.now, timezone });
          return <div key={`${o.id}:${rp?.key ?? ""}`} style={{ opacity: c.opacity ?? 1 }}><BrandCard config={c} text={text} phase={phase} /></div>;
        }
        const style: React.CSSProperties = { opacity: c.opacity ?? 1, width: BARS.has(o.kind) ? "94cqw" : o.kind === "logo" ? `${c.size ?? 8}cqw` : undefined, maxWidth: `${Math.max(c.size ?? 30, 30)}cqw` };
        return (
          <div key={o.id} style={style}>
            {o.kind === "logo" && (c.logo_url ? <img src={c.logo_url} alt="" className="w-full" /> : <Wordmark className="text-[clamp(8px,2.2cqw,48px)]" />)}
            {(o.kind === "on_air" || o.kind === "live_indicator") && <span className="inline-block whitespace-nowrap rounded-sm px-[0.6em] py-[0.2em] font-bold uppercase tracking-widest text-program-foreground" style={{ ...accent, ...fs }}>{c.text || (o.kind === "on_air" ? "On Air" : "Live")}</span>}
            {o.kind === "clock" && <span className="timecode inline-block whitespace-nowrap rounded-sm bg-inset/80 px-[0.5em] py-[0.15em] font-semibold" style={fs}>{formatClock(ctx.now, timezone).slice(0, 5)}</span>}
            {(o.kind === "now_showing" || o.kind === "programme_title") && (
              <div className="animate-in fade-in slide-in-from-left-4 bg-inset/90" style={fs}>
                <div className="px-[0.6em] py-[0.2em] text-[0.7em] font-bold uppercase tracking-widest text-program-foreground" style={accent}>Now showing</div>
                <div className="max-w-[40cqw] truncate px-[0.6em] py-[0.3em] font-semibold">{ctx.title}</div>
              </div>
            )}
            {o.kind === "lower_third" && (
              <div className="animate-in fade-in slide-in-from-left-4" style={fs}>
                <div className="px-[0.6em] py-[0.25em] font-bold text-program-foreground" style={accent}>{c.title || "Name"}</div>
                <div className="bg-inset/90 px-[0.6em] py-[0.2em] text-[0.8em]">{c.subtitle}</div>
              </div>
            )}
            {(o.kind === "ad_banner" || o.kind === "station_id" || o.kind === "countdown") && <span className="inline-block bg-inset/90 px-[0.6em] py-[0.3em] font-semibold" style={fs}>{c.text || o.name}</span>}
            {BARS.has(o.kind) && <Bar o={o} fs={fs} />}
          </div>
        );
      })}
        </div>
      ))}
      {bars.length > 0 && (
        <div className="absolute inset-x-0 bottom-0 flex flex-col">
          {bars.map((o) => <div key={o.id} style={{ opacity: o.config.opacity ?? 1 }}><Bar o={o} fs={fs} /></div>)}
        </div>
      )}
    </div>
  );
}

function Bar({ o, fs }: { o: LiveOverlay; fs: React.CSSProperties }) {
  const c = o.config;
  const accent = { backgroundColor: c.color ?? "var(--tally-program)" };
  if (o.kind === "breaking_news")
    return (
      <div className="flex items-stretch overflow-hidden" style={fs}>
        <span className="shrink-0 bg-foreground px-[0.6em] py-[0.35em] font-black uppercase tracking-wider text-background">Breaking</span>
        <span className="flex-1 truncate px-[0.6em] py-[0.35em] font-bold uppercase text-program-foreground" style={accent}>{c.text || "Breaking news"}</span>
      </div>
    );
  const text = c.text || "";
  return (
    <div className="flex items-stretch overflow-hidden bg-inset/90" style={fs}>
      <span className="relative z-10 shrink-0 px-[0.6em] py-[0.3em] font-bold uppercase text-program-foreground" style={accent}>MOVIE MAX</span>
      <span className="relative flex-1 overflow-hidden whitespace-nowrap py-[0.3em]">
        <span className="animate-crawl inline-block" style={{ ["--ticker-duration" as string]: `${tickerSeconds(text, c.speed)}s` }}>{text}</span>
      </span>
    </div>
  );
}
