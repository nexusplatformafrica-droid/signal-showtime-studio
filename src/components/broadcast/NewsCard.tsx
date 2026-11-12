import type { CSSProperties, ReactNode } from "react";
import { transitionAnimation, type CardPhase } from "@/lib/brand-cards";
import { newsDesignById, type NewsText } from "@/lib/news-cards";
import { tickerSeconds, type OverlayConfig } from "@/lib/graphics";
import { cn } from "@/lib/utils";

/** One piece of text that arrives just after the bar (staggered by `i`). */
function P({ i = 0, className, style, children }: { i?: number; className?: string; style?: CSSProperties; children: ReactNode }) {
  return <div className={cn("mmx-part", className)} style={{ ["--i" as string]: i, ...style }}>{children}</div>;
}

const dark = (c: string, pct = 60) => `color-mix(in oklab, ${c} ${pct}%, black)`;
const light = (c: string, pct = 55) => `color-mix(in oklab, ${c} ${pct}%, white)`;
const SPARKLE: CSSProperties = {
  backgroundImage: [
    "radial-gradient(circle at 12% 35%, var(--graphic-ink) 0 0.05em, transparent 0.09em)",
    "radial-gradient(circle at 31% 72%, var(--graphic-ink) 0 0.04em, transparent 0.08em)",
    "radial-gradient(circle at 58% 22%, var(--graphic-ink) 0 0.05em, transparent 0.09em)",
    "radial-gradient(circle at 77% 64%, var(--graphic-ink) 0 0.04em, transparent 0.08em)",
    "radial-gradient(circle at 92% 30%, var(--graphic-ink) 0 0.05em, transparent 0.1em)",
  ].join(","),
  opacity: 0.55,
};

/** Logo box: uploaded logo/picture, or one/two lines of text ("TV\nNEWS"), defaulting to the channel name. */
function Badge({ t, img, className, style }: { t: NewsText; img?: string | undefined; className?: string; style?: CSSProperties }) {
  const lines = (t.badge || "MOVIE\nMAX").split(/\\n|\n/).filter(Boolean);
  return (
    <div className={cn("flex shrink-0 flex-col items-center justify-center overflow-hidden text-center font-black uppercase leading-[0.95]", className)} style={style}>
      {img ? <img src={img} alt="" className="max-h-[82%] max-w-[86%] object-contain" /> : lines.map((l, i) => (
        <P key={i} i={i} className={lines.length > 1 && i > 0 ? "text-[0.7em]" : ""}>{l}</P>
      ))}
    </div>
  );
}

function Headline({ t, className, style }: { t: NewsText; className?: string; style?: CSSProperties }) {
  return <P key={t.index} i={1} className={cn("min-w-0 truncate font-black uppercase leading-tight", className)} style={style}>{t.headline}</P>;
}

/** Description line; can scroll like a ticker for long text. */
function Sub({ t, scroll, className, style }: { t: NewsText; scroll?: boolean | undefined; className?: string; style?: CSSProperties }) {
  if (!t.subtitle) return null;
  return (
    <div className={cn("relative overflow-hidden whitespace-nowrap", className)} style={style}>
      {scroll
        ? <span className="animate-crawl inline-block" style={{ ["--ticker-duration" as string]: `${tickerSeconds(t.subtitle, 70)}s` }}>{t.subtitle}</span>
        : <P i={2} className="truncate">{t.subtitle}</P>}
    </div>
  );
}

function Tag({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return <div className={cn("whitespace-nowrap font-bold uppercase", className)} style={style}><P>{children}</P></div>;
}

interface DP { t: NewsText; img?: string | undefined; c1: string; c2: string; scroll?: boolean | undefined }
const slantR = "polygon(0 0, 100% 0, calc(100% - 0.55em) 100%, 0 100%)";
const slantBoth = "polygon(0.55em 0, 100% 0, calc(100% - 0.55em) 100%, 0 100%)";

function Rule({ c1, c2, flip }: { c1: string; c2: string; flip?: boolean }) {
  const bar = (bg: string, w: string) => <span className="h-[0.16em] rounded-full" style={{ background: bg, width: w }} />;
  const dots = <span className="flex gap-[0.08em]">{[c2, c2, c1, c1].map((c, i) => <span key={i} className="size-[0.2em] rounded-full" style={{ background: c }} />)}</span>;
  return (
    <div className={cn("flex items-center gap-[0.2em]", flip && "flex-row-reverse")}>
      {bar(c1, "18%")}{dots}{bar(c2, "48%")}{dots}{bar(c1, "16%")}
    </div>
  );
}

const DESIGNS: Record<string, (p: DP) => ReactNode> = {
  angled: ({ t, img, c1, c2 }) => (
    <div className="relative space-y-[0.25em] pt-[0.3em]">
      {t.time && <Tag className="absolute -top-[0.35em] right-0 z-10 rounded-[0.15em] px-[0.5em] py-[0.05em] text-[0.55em]" style={{ background: c2 }}>{t.time}</Tag>}
      <Rule c1={c2} c2={c1} />
      <div className="flex h-[2.3em] gap-[0.3em]">
        <Badge t={t} img={img} className="w-[19%] text-[0.62em]" style={{ background: `linear-gradient(160deg, ${light(c1, 80)}, ${dark(c1, 80)})`, clipPath: slantBoth }} />
        <div className="flex min-w-0 flex-1 flex-col items-center justify-center px-[1em]" style={{ background: `linear-gradient(90deg, ${dark(c1, 85)}, ${light(c1, 75)} 55%, ${dark(c1, 85)})`, clipPath: slantBoth }}>
          <P className="text-[0.4em] font-bold uppercase tracking-[0.3em] opacity-85">{t.kicker}</P>
          <Headline t={t} className="max-w-full text-[0.95em] [text-shadow:0_0.06em_0.12em_rgb(0_0_0/0.45)]" />
        </div>
      </div>
      <Rule c1={c2} c2={c1} flip />
    </div>
  ),
  gradient: ({ t, img, c1, c2, scroll }) => (
    <div className="relative pt-[0.75em]">
      {t.time && <Tag className="absolute right-[7%] top-0 rounded-t-[0.2em] px-[0.5em] py-[0.08em] text-[0.55em]" style={{ background: c2 }}>{t.time}</Tag>}
      <div className="flex h-[2.2em]">
        <Badge t={t} img={img} className="w-[18%] text-[0.6em]" style={{ background: c1, clipPath: slantBoth }} />
        <div className="-ml-[0.2em] flex min-w-0 flex-1 flex-col justify-center rounded-r-full pl-[1em] pr-[1.2em]" style={{ background: `linear-gradient(90deg, ${c1}, ${c2})`, clipPath: "polygon(0.55em 0, 100% 0, 100% 100%, 0 100%)" }}>
          <P className="text-[0.4em] font-bold uppercase tracking-[0.3em] opacity-85">{t.kicker}</P>
          <Headline t={t} className="text-[0.92em]" />
        </div>
      </div>
      <Sub t={t} scroll={scroll} className="ml-[30%] w-[48%] rounded-b-[0.35em] px-[0.6em] py-[0.12em] text-center text-[0.5em]" style={{ background: `linear-gradient(90deg, ${c2}, ${c1})` }} />
    </div>
  ),
  "red-lines": ({ t, img, c1, c2, scroll }) => (
    <div>
      <Tag className="w-[44%] px-[0.6em] py-[0.12em] text-[0.48em]" style={{ background: dark(c1, 70) }}>{t.kicker}{t.time && ` · ${t.time}`}</Tag>
      <div className="relative flex h-[2.3em] items-center overflow-hidden rounded-r-[0.7em] shadow-lg" style={{ background: c1 }}>
        <Badge t={t} img={img} className="h-full w-[17%] text-[0.6em]" />
        <span className="absolute inset-y-[15%] left-[17%] w-[0.18em] bg-graphic-ink" />
        {["62%", "38%", "50%"].map((w, i) => <span key={i} className="absolute left-[17.5%] h-[0.12em] rounded-full bg-graphic-ink" style={{ top: `${30 + i * 20}%`, width: `calc(${w} * 0.12)` }} />)}
        <div className="min-w-0 flex-1 pl-[1.4em] pr-[0.8em]"><Headline t={t} className="text-[0.95em] [text-shadow:0_0.06em_0.12em_rgb(0_0_0/0.35)]" /></div>
        <span className="absolute bottom-[0.22em] right-[0.5em] h-[0.1em] w-[28%] rounded-full bg-graphic-ink" />
      </div>
      <Sub t={t} scroll={scroll} className="ml-[38%] w-[44%] px-[0.6em] py-[0.12em] text-[0.48em]" style={{ background: c2 }} />
    </div>
  ),
  "tag-left": (p) => <WhiteRed {...p} variant="left" />,
  "tag-right": (p) => <WhiteRed {...p} variant="right" />,
  "tag-inset": (p) => <WhiteRed {...p} variant="inset" />,
  "purple-clock": ({ t, img, c1, c2, scroll }) => (
    <div className="drop-shadow-lg">
      <div className="flex items-end gap-[0.2em]">
        <div className="flex w-[17%] items-center justify-center rounded-t-[0.3em] bg-graphic-black py-[0.08em]">
          {img ? <img src={img} alt="" className="h-[1em] object-contain" /> : <P className="text-[0.7em] font-black tabular-nums">{t.time || t.badge || "LIVE"}</P>}
        </div>
        <Tag className="w-[50%] rounded-t-[0.3em] bg-graphic-paper py-[0.08em] text-center text-[0.42em] tracking-[0.3em] text-graphic-night">{t.kicker}</Tag>
      </div>
      <div className="relative flex h-[1.45em] items-center justify-center overflow-hidden px-[1em]" style={{ background: `linear-gradient(90deg, ${dark(c1, 85)}, ${c1} 40%, ${c2})` }}>
        <span className="absolute inset-0" style={SPARKLE} />
        <Headline t={t} className="relative text-[0.85em]" />
      </div>
      <Sub t={t} scroll={scroll} className="rounded-b-[0.3em] bg-graphic-black px-[0.8em] py-[0.12em] text-[0.45em]" />
    </div>
  ),
  "purple-arrow": ({ t, img, c1, c2, scroll }) => (
    <div className="drop-shadow-lg">
      <div className="flex h-[1.7em] items-stretch">
        <Badge t={t.badge ? t : { ...t, badge: "TV\nNEWS" }} img={img} className="w-[16%] rounded-tl-[0.25em] bg-graphic-paper text-[0.7em] text-graphic-night" />
        <div className="relative flex min-w-0 flex-1 items-center justify-center overflow-hidden px-[1.2em]" style={{ background: `linear-gradient(90deg, ${dark(c1, 80)}, ${c1} 45%, ${c2})`, clipPath: "polygon(0 0, calc(100% - 0.8em) 0, 100% 50%, calc(100% - 0.8em) 100%, 0 100%)" }}>
          <span className="absolute inset-0" style={SPARKLE} />
          <Headline t={t} className="relative text-[0.85em]" />
        </div>
      </div>
      <Sub t={t} scroll={scroll} className="w-[56%] bg-graphic-black py-[0.14em] pl-[0.6em] pr-[1em] text-[0.45em]" style={{ clipPath: "polygon(0 0, calc(100% - 0.6em) 0, 100% 50%, calc(100% - 0.6em) 100%, 0 100%)" }} />
    </div>
  ),
  "purple-pill": ({ t, c1, c2, scroll }) => (
    <div className="drop-shadow-lg">
      <Tag className="w-[42%] rounded-t-[0.3em] bg-graphic-black px-[0.8em] py-[0.1em] text-[0.42em] tracking-[0.25em]">{t.kicker}{t.time && ` · ${t.time}`}</Tag>
      <div className="relative flex h-[1.45em] items-center justify-center overflow-hidden rounded-r-full px-[1em]" style={{ background: `linear-gradient(90deg, ${dark(c1, 80)}, ${c1} 35%, ${c2})` }}>
        <span className="absolute inset-0" style={SPARKLE} />
        <Headline t={t} className="relative text-[0.85em]" />
      </div>
      <Sub t={t} scroll={scroll} className="w-[72%] rounded-b-[0.3em] bg-graphic-paper px-[0.8em] py-[0.12em] text-[0.45em] text-graphic-night" />
    </div>
  ),
  "blue-curve": ({ t, img, c1, c2 }) => (
    <div className="relative flex h-[2em] items-center overflow-hidden rounded-r-[1.2em] rounded-tr-[2.4em] shadow-lg" style={{ background: `linear-gradient(100deg, ${dark(c1, 75)}, ${c1} 40%, ${c2})` }}>
      <span className="absolute left-[12%] top-1/2 size-[3.2em] -translate-y-1/2 rounded-full bg-graphic-ink/25" />
      <Badge t={t.badge ? t : { ...t, badge: "TV\nCHANNEL" }} img={img} className="relative z-10 h-full w-[19%] rounded-r-[1.1em] bg-graphic-paper text-[0.7em]" style={{ color: c1 }} />
      <div className="min-w-0 flex-1 px-[1em] text-center">
        <P className="text-[0.38em] font-bold uppercase tracking-[0.3em] opacity-85">{t.kicker}</P>
        <Headline t={t} className="text-[0.85em]" />
      </div>
    </div>
  ),
  "blue-circle": ({ t, img, c1, c2 }) => (
    <div className="relative ml-[1.2em] flex h-[1.9em] items-center overflow-hidden rounded-full pl-[2em] pr-[1em] shadow-lg" style={{ background: `linear-gradient(90deg, ${c1}, ${c2})` }}>
      {[3.4, 4.6, 5.8].map((s) => <span key={s} className="absolute left-[0.2em] top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-[0.18em] border-graphic-ink/15" style={{ width: `${s}em`, height: `${s}em` }} />)}
      <div className="min-w-0 flex-1 text-center">
        <P className="text-[0.38em] font-bold uppercase tracking-[0.3em] opacity-85">{t.kicker}</P>
        <Headline t={t} className="text-[0.85em]" />
      </div>
      <span className="sr-only" />
      <BadgeCircle t={t} img={img} c1={c1} />
    </div>
  ),
  "blue-live": ({ t, img, c1, c2 }) => (
    <div className="flex h-[1.9em] shadow-lg">
      <Badge t={t.badge ? t : { ...t, badge: "LIVE" }} img={img} className="w-[17%] bg-graphic-paper text-[0.8em]" style={{ color: c1 }} />
      <div className="relative flex min-w-0 flex-1 flex-col items-center justify-center overflow-hidden px-[1em]" style={{ background: c1 }}>
        <span className="absolute inset-0" style={{ background: c2, clipPath: "polygon(0 0, 22% 50%, 0 100%)", opacity: 0.7 }} />
        <span className="absolute inset-0" style={{ background: c2, clipPath: "polygon(100% 0, 70% 100%, 100% 100%)", opacity: 0.55 }} />
        <span className="absolute inset-0" style={{ background: dark(c1, 80), clipPath: "polygon(35% 0, 60% 0, 48% 100%)", opacity: 0.35 }} />
        <P className="relative text-[0.38em] font-bold uppercase tracking-[0.3em] opacity-85">{t.kicker}</P>
        <Headline t={t} className="relative text-[0.85em]" />
      </div>
    </div>
  ),
  "blue-tab": ({ t, c1, c2, scroll }) => (
    <div className="drop-shadow-lg">
      <div className="flex h-[1.7em] items-center overflow-hidden rounded-l-[0.3em] rounded-r-full" style={{ background: `linear-gradient(90deg, ${c1}, ${light(c1, 70)})` }}>
        <div className="flex h-full w-[26%] items-center px-[0.6em]" style={{ background: light(c1, 80), clipPath: slantR }}>
          <P className="mmx-italic whitespace-nowrap text-[0.75em] uppercase">{t.badge.replace(/\\n|\n/g, " ") || t.kicker}</P>
        </div>
        <div className="min-w-0 flex-1 px-[0.8em] text-center"><Headline t={t} className="text-[0.82em]" /></div>
      </div>
      <Sub t={t} scroll={scroll} className="ml-[2%] w-[88%] rounded-b-[0.6em] px-[0.8em] py-[0.12em] text-[0.42em] font-semibold text-graphic-night" style={{ background: c2 }} />
    </div>
  ),
  "blue-center": ({ t, c1, c2, scroll }) => (
    <div className="drop-shadow-lg">
      <Tag className="mx-auto w-[46%] py-[0.08em] text-center text-[0.42em] tracking-[0.15em] text-graphic-night" style={{ background: c2, clipPath: "polygon(0.6em 0, calc(100% - 0.6em) 0, 100% 100%, 0 100%)" }}>{t.kicker}{t.time && ` · ${t.time}`}</Tag>
      <div className="relative flex h-[1.5em] items-center justify-center overflow-hidden rounded-[0.3em] rounded-r-[0.8em] px-[1em]" style={{ background: `linear-gradient(90deg, ${dark(c1, 80)}, ${c1} 50%, ${dark(c1, 80)})` }}>
        <span className="absolute inset-0" style={SPARKLE} />
        <Headline t={t} className="relative text-[0.85em]" />
      </div>
      <Sub t={t} scroll={scroll} className="mx-auto w-[68%] px-[1em] py-[0.12em] text-center text-[0.4em] font-semibold text-graphic-night" style={{ background: c2, clipPath: "polygon(0 0, 100% 0, calc(100% - 0.6em) 100%, 0.6em 100%)" }} />
    </div>
  ),
  "blue-tv": ({ t, img, c1, c2, scroll }) => (
    <div className="drop-shadow-lg">
      <div className="flex items-end">
        <Badge t={t.badge ? t : { ...t, badge: "TV\nNEWS" }} img={img} className="h-[2.1em] w-[16%] rounded-t-[0.35em] text-[0.7em]" style={{ background: `linear-gradient(180deg, ${light(c1, 75)}, ${c1})` }} />
        <div className="relative flex h-[1.5em] min-w-0 flex-1 items-center overflow-hidden px-[0.9em]" style={{ background: `linear-gradient(90deg, ${dark(c1, 70)}, ${c1})`, clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)" }}>
          <span className="absolute -top-[0.2em] left-[3%] h-[0.5em] w-[30%] rounded-b-[0.3em]" style={{ background: light(c1, 70) }} />
          <Headline t={t} className="relative text-[0.85em]" />
        </div>
      </div>
      <Sub t={t} scroll={scroll} className="px-[0.8em] py-[0.12em] text-[0.42em] font-semibold text-graphic-night" style={{ background: `linear-gradient(90deg, ${c2}, ${light(c2, 50)})` }} />
    </div>
  ),
};

function BadgeCircle({ t, img, c1 }: { t: NewsText; img?: string | undefined; c1: string }) {
  return (
    <Badge
      t={t.badge ? t : { ...t, badge: "NEWS" }}
      img={img}
      className="absolute left-[-1.05em] top-1/2 size-[2.3em] -translate-y-1/2 rounded-full bg-graphic-paper text-[0.62em] shadow-md"
      style={{ color: c1 }}
    />
  );
}

function WhiteRed({ t, img, c1, c2, scroll, variant }: DP & { variant: "left" | "right" | "inset" }) {
  const tag = (
    <Tag className={cn("relative z-10 w-fit px-[1em] py-[0.12em] text-[0.45em]", variant === "right" ? "ml-auto mr-[3%]" : variant === "inset" ? "ml-[20%]" : "ml-[0.3em]")} style={{ background: c2, clipPath: "polygon(0.5em 0, 100% 0, calc(100% - 0.5em) 100%, 0 100%)" }}>
      {t.kicker}{t.time && ` · ${t.time}`}
    </Tag>
  );
  return (
    <div className="drop-shadow-lg">
      {tag}
      <div className="flex h-[2.2em]">
        <Badge t={t} img={img} className="relative z-10 w-[18%] rounded-l-[0.25em] rounded-br-[0.9em] text-[0.62em]" style={{ background: c1, boxShadow: "0.18em 0 0 var(--graphic-paper), 0.32em 0 0 color-mix(in oklab, var(--graphic-paper) 70%, black)" }} />
        <div className="-ml-[0.5em] flex min-w-0 flex-1 items-center justify-center rounded-tr-[0.9em] bg-graphic-paper pl-[1.4em] pr-[0.8em]">
          <Headline t={t} className="text-[0.92em] text-graphic-night" />
        </div>
      </div>
      <Sub t={t} scroll={scroll} className={cn("mt-[0.2em] rounded-[0.15em] px-[0.8em] py-[0.15em] text-[0.42em] font-semibold", variant === "inset" && "-mt-[0.6em] ml-[22%] relative z-10")} style={{ background: c2 }} />
    </div>
  );
}

/** A branded news lower third. Scales with the frame width, like `BrandCard`. */
export function NewsCard({ config, text, phase, size }: { config: OverlayConfig; text: NewsText; phase: CardPhase; size?: number | undefined }) {
  const d = newsDesignById(config.design);
  const c1 = config.color ?? d.c1;
  const c2 = config.color2 ?? d.c2;
  const ms = Math.min(3000, Math.max(150, Number(config.transition_ms) || 700));
  const w = size ?? config.size ?? 62;
  const Design = DESIGNS[d.id] ?? DESIGNS["angled"]!;
  return (
    <div
      className="mmx-card relative text-graphic-ink"
      data-phase={phase}
      style={{ width: `${w}cqw`, fontSize: `${w * 0.042}cqw`, animation: transitionAnimation(phase, config.transition_in, config.transition_out, ms), ["--mmx-ms" as string]: `${ms}ms` }}
    >
      <Design t={text} img={config.image_url} c1={c1} c2={c2} scroll={config.scroll} />
    </div>
  );
}
