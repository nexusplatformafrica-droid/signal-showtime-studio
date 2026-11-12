import type { ReactNode } from "react";
import { transitionAnimation, type CardPhase } from "@/lib/brand-cards";
import { TICKER_DESIGNS, designIn, tickerLine, type KitText } from "@/lib/card-kits";
import { tickerSeconds, type OverlayConfig } from "@/lib/graphics";
import { BadgeBox, CardIcon, Crawl, P, SPARKLE, dark, light, slantL, slantR } from "@/components/broadcast/card-parts";

interface DP { t: KitText; crawl: (cls?: string) => ReactNode; img?: string | undefined; icon?: string | undefined; c1: string; c2: string }

const Label = ({ children, className, style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) => (
  <div className={`flex shrink-0 items-center whitespace-nowrap px-[0.7em] font-black uppercase ${className ?? ""}`} style={style}><P>{children}</P></div>
);
const Clock = ({ t, className, style }: { t: KitText; className?: string; style?: React.CSSProperties }) =>
  t.time ? <div className={`flex shrink-0 items-center whitespace-nowrap px-[0.7em] font-bold tabular-nums ${className ?? ""}`} style={style}>{t.time}</div> : null;

const DESIGNS: Record<string, (p: DP) => ReactNode> = {
  classic: ({ t, crawl, c1, c2 }) => (
    <div className="flex h-[2.1em] shadow-lg" style={{ background: `color-mix(in oklab, ${c2} 92%, transparent)` }}>
      <Label className="text-[0.85em]" style={{ background: c1 }}>{t.kicker}</Label>
      {crawl("text-[0.8em] font-semibold")}
      <Clock t={t} className="bg-graphic-paper text-[0.8em] text-graphic-night" />
    </div>
  ),
  "blue-white": ({ t, crawl, img, c1, c2 }) => (
    <div className="relative flex h-[2.3em] shadow-lg">
      <div className="relative flex w-[9em] shrink-0 items-center overflow-hidden" style={{ background: `linear-gradient(135deg, ${light(c1, 80)}, ${c1})`, clipPath: slantR }}>
        <BadgeBox text={t.badge || "MOVIE\nMAX"} img={img} className="h-full w-[60%] text-[0.75em]" />
        <span className="absolute -inset-y-2 right-[22%] w-[0.5em] -skew-x-[30deg] bg-graphic-ink/80" />
        <span className="absolute -inset-y-2 right-[8%] w-[0.5em] -skew-x-[30deg] bg-graphic-ink/80" />
      </div>
      <div className="-ml-[0.4em] flex min-w-0 flex-1 flex-col bg-graphic-paper text-graphic-night">
        <div className="flex h-[0.95em] items-center px-[0.8em] text-[0.42em] font-bold uppercase tracking-[0.3em]" style={{ color: c2 }}>{t.kicker}</div>
        {crawl("text-[0.75em] font-bold")}
      </div>
      <Clock t={t} className="text-[0.8em]" style={{ background: `linear-gradient(90deg, ${c1}, ${c2})` }} />
    </div>
  ),
  channel: ({ t, crawl, img, c1, c2 }) => (
    <div className="flex h-[2.2em] items-stretch shadow-lg">
      <div className="flex shrink-0 flex-col items-center justify-center px-[0.8em]" style={{ background: `linear-gradient(135deg, ${light(c1, 75)}, ${dark(c1, 80)})` }}>
        {img ? <img src={img} alt="" className="h-[1.6em] object-contain" /> : <P className="text-[0.8em] font-black uppercase leading-none">{(t.badge || "MOVIE MAX").replace(/\\n|\n/g, " ")}</P>}
        <P i={1} className="text-[0.32em] font-semibold uppercase tracking-[0.2em] opacity-85">{t.kicker}</P>
      </div>
      <div className="flex min-w-0 flex-1 items-stretch rounded-r-full bg-graphic-paper pr-[1em] text-graphic-night">
        {crawl("text-[0.8em] font-bold")}
        <Clock t={t} className="my-[0.45em] rounded-[0.2em] text-[0.6em] text-graphic-ink" style={{ background: c2 }} />
      </div>
    </div>
  ),
  "navy-yellow": ({ t, crawl, c1, c2 }) => (
    <div className="flex h-[2em] shadow-lg" style={{ background: c1 }}>
      <Label className="pr-[1.2em] text-[0.8em] text-graphic-night" style={{ background: c2, clipPath: slantR }}>{t.kicker}</Label>
      {crawl("text-[0.8em] font-bold")}
      <Clock t={t} className="text-[0.8em]" style={{ color: c2, background: dark(c1, 70) }} />
    </div>
  ),
  pill: ({ t, crawl, img, c1, c2 }) => (
    <div className="relative ml-[1.4em] flex h-[2em] items-stretch rounded-full pl-[2.4em] pr-[0.4em] shadow-lg" style={{ background: `linear-gradient(90deg, ${c1}, ${c2})` }}>
      <BadgeBox text={t.badge || "NEWS"} img={img} className="absolute -left-[1.4em] top-1/2 size-[2.9em] -translate-y-1/2 rounded-full bg-graphic-paper text-[0.75em] shadow-md" style={{ color: c1 }} />
      <Label className="text-[0.55em] tracking-[0.2em] opacity-90">{t.kicker}</Label>
      {crawl("text-[0.8em] font-bold")}
      <Clock t={t} className="my-[0.35em] rounded-full bg-graphic-paper text-[0.65em]" style={{ color: c1 }} />
    </div>
  ),
  diamond: ({ t, crawl, img, icon, c1, c2 }) => (
    <div className="relative pl-[1.3em] pt-[0.9em]">
      <div className="absolute left-[2.1em] top-0 z-0 flex h-[1.4em] w-[40%] items-start rounded-tr-[0.8em] px-[1.6em] pt-[0.15em] text-[0.45em] font-bold uppercase tracking-[0.25em]" style={{ background: c1 }}><P>{t.kicker}</P></div>
      <div className="relative flex h-[2em] items-stretch rounded-l-[0.3em] bg-graphic-paper pl-[2em] text-graphic-night shadow-lg" style={{ clipPath: "polygon(0 0, calc(100% - 0.4em) 0, 100% 100%, 0 100%)" }}>
        {crawl("text-[0.8em] font-bold")}
        <Clock t={t} className="pr-[1.2em] text-[0.7em]" style={{ color: c1 }} />
      </div>
      <div className="absolute left-0 top-[0.65em] z-10 grid size-[2.5em] rotate-45 place-items-center rounded-[0.5em] shadow-lg" style={{ background: `linear-gradient(180deg, ${light(c2, 70)}, ${c1})` }}>
        <div className="-rotate-45">{img ? <img src={img} alt="" className="size-[1.4em] object-contain" /> : <CardIcon name={icon ?? "tv"} className="size-[1.1em]" />}</div>
      </div>
    </div>
  ),
  "green-live": ({ t, crawl, c1 }) => (
    <div className="flex h-[2em] shadow-lg">
      <Label className="text-[0.85em]" style={{ background: `linear-gradient(135deg, ${light(c1, 75)}, ${c1})` }}>{t.kicker}</Label>
      {crawl("bg-graphic-paper text-[0.8em] font-bold text-graphic-night")}
      <Clock t={t} className="text-[0.8em]" style={{ background: dark(c1, 75) }} />
    </div>
  ),
  "orange-slant": ({ t, crawl, c1, c2 }) => (
    <div className="flex h-[2em] shadow-lg" style={{ background: `linear-gradient(90deg, ${dark(c2, 80)}, ${c2})` }}>
      <Label className="relative z-10 pr-[1.2em] text-[0.8em]" style={{ background: `linear-gradient(90deg, ${c1}, ${light(c1, 70)})`, clipPath: slantR }}>{t.kicker}</Label>
      {crawl("text-[0.8em] font-bold")}
      <Clock t={t} className="pl-[1.2em] text-[0.8em]" style={{ background: c1, clipPath: slantL }} />
    </div>
  ),
  purple: ({ t, crawl, c1, c2 }) => (
    <div className="relative flex h-[2em] overflow-hidden rounded-r-full shadow-lg" style={{ background: `linear-gradient(90deg, ${dark(c1, 80)}, ${c1} 40%, ${c2})` }}>
      <span className="absolute inset-0" style={SPARKLE} />
      <Label className="relative bg-graphic-paper text-[0.75em] text-graphic-night">{t.kicker}</Label>
      {crawl("relative text-[0.8em] font-bold")}
      <Clock t={t} className="relative bg-graphic-black pr-[1em] text-[0.75em]" />
    </div>
  ),
  glass: ({ t, crawl, c1, c2 }) => (
    <div className="flex h-[2em] overflow-hidden rounded-[0.3em] shadow-lg backdrop-blur-sm" style={{ background: `color-mix(in oklab, ${c2} 78%, transparent)` }}>
      <Label className="text-[0.75em]" style={{ background: c1 }}>{t.kicker}</Label>
      {crawl("text-[0.8em] font-semibold")}
      <Clock t={t} className="border-l border-graphic-ink/20 text-[0.75em]" />
    </div>
  ),
  tab: ({ t, crawl, c1, c2 }) => (
    <div>
      <div className="flex items-end justify-between">
        <Label className="h-[1.2em] rounded-t-[0.3em] text-[0.55em] tracking-[0.15em]" style={{ background: c2 }}>{t.kicker}</Label>
        {t.time && <div className="mr-[1em] rounded-t-[0.3em] px-[0.7em] text-[0.55em] font-bold tabular-nums" style={{ background: dark(c1, 70) }}>{t.time}</div>}
      </div>
      <div className="flex h-[1.8em] shadow-lg" style={{ background: `linear-gradient(90deg, ${c1}, ${light(c1, 80)})` }}>{crawl("px-[0.4em] text-[0.8em] font-bold")}</div>
    </div>
  ),
};

/** Rolling news ticker. Fixed text height across widths so it reads like broadcast tickers. */
export function TickerCard({ config, text, phase, width }: { config: OverlayConfig; text: KitText; phase: CardPhase; width?: number | undefined }) {
  const d = designIn(TICKER_DESIGNS, config.design);
  const c1 = config.color ?? d.c1;
  const c2 = config.color2 ?? d.c2;
  const ms = Math.min(3000, Math.max(150, Number(config.transition_ms) || 700));
  const w = Math.min(100, width ?? config.size ?? 100);
  const line = tickerLine(text.lines, config.sep);
  const seconds = tickerSeconds(line, config.speed);
  const Design = DESIGNS[d.id] ?? DESIGNS["classic"]!;
  return (
    <div
      className="mmx-card relative text-graphic-ink"
      data-phase={phase}
      style={{ width: `${w}cqw`, fontSize: "1.75cqw", animation: transitionAnimation(phase, config.transition_in ?? "slide-up", config.transition_out ?? "slide-down", ms), ["--mmx-ms" as string]: `${ms}ms` }}
    >
      <Design t={text} img={config.image_url} icon={config.icon} c1={c1} c2={c2} crawl={(cls) => <Crawl text={line} seconds={seconds} className={cls} />} />
    </div>
  );
}
