import type { CSSProperties, ReactNode } from "react";
import { Clock, Film, Play, Radio, Ticket, Tv } from "lucide-react";
import { Wordmark } from "@/components/brand/Wordmark";
import { transitionAnimation, type CardPhase } from "@/lib/brand-cards";
import { designIn } from "@/lib/card-kits";
import { CAPTION_DESIGNS, CLOCK_DESIGNS, NOW_DESIGNS, ONAIR_DESIGNS, type ClockParts, type NowText } from "@/lib/badge-kits";
import type { OverlayConfig } from "@/lib/graphics";
import { BadgeBox, P, dark, light, slantBoth, slantR } from "@/components/broadcast/card-parts";
import { cn } from "@/lib/utils";

/** Shared wrapper: font size from the graphic's size, plus its appear/disappear animation. */
function Shell({ config, phase, fontCqw, tIn, tOut, children, className }: { config: OverlayConfig; phase: CardPhase; fontCqw: number; tIn: string; tOut: string; children: ReactNode; className?: string }) {
  const ms = Math.min(3000, Math.max(150, Number(config.transition_ms) || 700));
  return (
    <div
      className={cn("mmx-card relative w-max text-graphic-ink", className)}
      data-phase={phase}
      style={{ fontSize: `${fontCqw}cqw`, animation: transitionAnimation(phase, config.transition_in ?? tIn, config.transition_out ?? tOut, ms), ["--mmx-ms" as string]: `${ms}ms` }}
    >
      {children}
    </div>
  );
}

const colours = (config: OverlayConfig, d: { c1: string; c2: string }) => ({ c1: config.color ?? d.c1, c2: config.color2 ?? d.c2 });
const glow = (c: string) => `0 0 0.25em ${c}, 0 0 0.7em ${c}`;

// ───────────────────────────── Now showing ─────────────────────────────

interface NP { t: NowText; c1: string; c2: string; img?: string | undefined }

const NowLines = ({ t, kickerColor, titleClass, dim }: { t: NowText; kickerColor?: string; titleClass?: string; dim?: boolean }) => (
  <div className="min-w-0">
    <P className="text-[0.55em] font-black uppercase tracking-[0.22em]" style={kickerColor ? { color: kickerColor } : undefined}>{t.kicker}</P>
    <P i={1} className={cn("max-w-[22em] truncate font-black leading-tight", titleClass)}>{t.title}</P>
    {t.subtitle && <P i={2} className={cn("text-[0.5em] font-semibold uppercase tracking-[0.15em]", dim !== false && "opacity-75")}>{t.subtitle}</P>}
  </div>
);

const NOW: Record<string, (p: NP) => ReactNode> = {
  tab: ({ t, c1, c2 }) => (
    <div className="shadow-lg">
      <div className="inline-block px-[0.6em] py-[0.18em]" style={{ background: c1 }}><P className="text-[0.55em] font-black uppercase tracking-[0.22em]">{t.kicker}</P></div>
      <div className="px-[0.6em] py-[0.3em]" style={{ background: `color-mix(in oklab, ${c2} 88%, transparent)` }}>
        <P i={1} className="max-w-[22em] truncate font-bold">{t.title}</P>
        {t.subtitle && <P i={2} className="text-[0.5em] uppercase tracking-[0.15em] opacity-75">{t.subtitle}</P>}
      </div>
    </div>
  ),
  pill: ({ t, c1, c2 }) => (
    <div className="flex items-center gap-[0.5em] rounded-full bg-graphic-paper py-[0.25em] pl-[0.25em] pr-[1.1em] text-graphic-night shadow-lg">
      <div className="grid size-[2em] shrink-0 place-items-center rounded-full text-graphic-ink" style={{ background: `linear-gradient(135deg, ${c1}, ${dark(c1, 75)})` }}><Play className="ml-[0.1em] size-[0.9em] fill-current" /></div>
      <NowLines t={t} kickerColor={c1} />
      <span className="ml-[0.3em] h-[1.5em] w-[0.18em] shrink-0 rounded-full" style={{ background: c2 }} />
    </div>
  ),
  glass: ({ t, c1 }) => (
    <div className="rounded-[0.4em] border border-graphic-ink/20 bg-graphic-black/50 px-[0.8em] py-[0.4em] shadow-lg backdrop-blur-md" style={{ borderLeft: `0.22em solid ${c1}` }}>
      <NowLines t={t} kickerColor={c1} />
    </div>
  ),
  split: ({ t, c1, c2 }) => (
    <div className="relative flex items-stretch shadow-lg">
      <div className="flex items-center py-[0.4em] pl-[0.6em] pr-[1.1em]" style={{ background: c1, clipPath: slantR }}><P className="text-[0.6em] font-black uppercase leading-tight tracking-[0.15em]">{t.kicker.split(" ").map((w, i) => <span key={i} className="block">{w}</span>)}</P></div>
      <div className="-ml-[0.55em] flex min-w-0 flex-col justify-center bg-graphic-paper py-[0.3em] pl-[1em] pr-[1em] text-graphic-night" style={{ clipPath: slantBoth }}>
        <P i={1} className="max-w-[22em] truncate font-black">{t.title}</P>
        {t.subtitle && <P i={2} className="text-[0.5em] font-bold uppercase tracking-[0.15em] opacity-70">{t.subtitle}</P>}
      </div>
      <span className="absolute -bottom-[0.18em] left-[0.4em] right-[0.6em] h-[0.18em]" style={{ background: c2 }} />
    </div>
  ),
  neon: ({ t, c1, c2 }) => (
    <div className="rounded-[0.5em] bg-graphic-black/70 px-[0.8em] py-[0.4em]" style={{ border: `0.08em solid ${c1}`, boxShadow: `${glow(c1)}, inset 0 0 0.6em ${c1}` }}>
      <P className="text-[0.55em] font-black uppercase tracking-[0.3em]" style={{ color: c2, textShadow: glow(c2) }}>{t.kicker}</P>
      <P i={1} className="max-w-[22em] truncate font-black" style={{ textShadow: glow(c1) }}>{t.title}</P>
      {t.subtitle && <P i={2} className="text-[0.5em] uppercase tracking-[0.2em] opacity-80">{t.subtitle}</P>}
    </div>
  ),
  ribbon: ({ t, c1, c2 }) => (
    <div className="flex items-stretch shadow-lg">
      <div className="flex items-center px-[0.6em]" style={{ background: c2 }}><P className="text-[0.55em] font-black uppercase tracking-[0.2em]">{t.kicker}</P></div>
      <div className="flex min-w-0 flex-col justify-center py-[0.3em] pl-[0.7em] pr-[1.4em]" style={{ background: `linear-gradient(90deg, ${c1}, ${dark(c1, 80)})`, clipPath: "polygon(0 0, calc(100% - 0.8em) 0, 100% 50%, calc(100% - 0.8em) 100%, 0 100%)" }}>
        <P i={1} className="max-w-[22em] truncate font-black uppercase">{t.title}</P>
        {t.subtitle && <P i={2} className="text-[0.5em] uppercase tracking-[0.15em] opacity-85">{t.subtitle}</P>}
      </div>
    </div>
  ),
  film: ({ t, c1, c2 }) => {
    const holes: CSSProperties = { backgroundImage: `repeating-linear-gradient(90deg, ${light(c2, 30)} 0 0.35em, transparent 0.35em 0.7em)` };
    return (
      <div className="shadow-lg" style={{ background: c2 }}>
        <div className="mx-[0.3em] h-[0.22em] translate-y-[0.12em]" style={holes} />
        <div className="flex items-center gap-[0.55em] px-[0.7em] py-[0.35em]">
          <Film className="size-[1.4em] shrink-0" style={{ color: c1 }} />
          <NowLines t={t} kickerColor={c1} />
        </div>
        <div className="mx-[0.3em] h-[0.22em] -translate-y-[0.12em]" style={holes} />
      </div>
    );
  },
  bar: ({ t, c1, c2 }) => (
    <div className="flex items-stretch gap-[0.5em] py-[0.2em] pr-[2em]" style={{ background: `linear-gradient(90deg, color-mix(in oklab, ${c2} 85%, transparent) 60%, transparent)` }}>
      <span className="w-[0.3em] shrink-0" style={{ background: c1 }} />
      <div className="py-[0.15em]"><NowLines t={t} kickerColor={c1} titleClass="text-[1.15em]" /></div>
    </div>
  ),
  "logo-box": ({ t, c1, c2, img }) => (
    <div className="flex items-stretch shadow-lg">
      <BadgeBox text={t.badge || "MOVIE\nMAX"} img={img} className="w-[3.2em] text-[0.8em]" style={{ background: `linear-gradient(160deg, ${c1}, ${dark(c1, 70)})` }} firstClass="text-[0.78em]" restClass="text-[0.78em]" />
      <div className="flex min-w-0 flex-col justify-center bg-graphic-paper px-[0.8em] py-[0.3em] text-graphic-night" style={{ borderBottom: `0.16em solid ${c2}` }}>
        <NowLines t={t} kickerColor={c1} />
      </div>
    </div>
  ),
  gradient: ({ t, c1, c2 }) => (
    <div className="rounded-[0.6em] px-[0.9em] py-[0.4em] shadow-lg" style={{ background: `linear-gradient(110deg, ${c1}, ${c2})` }}>
      <P className="text-[0.5em] font-black uppercase tracking-[0.3em] opacity-90">{t.kicker}</P>
      <P i={1} className="mmx-italic max-w-[22em] truncate text-[1.1em] uppercase">{t.title}</P>
      {t.subtitle && <P i={2} className="text-[0.5em] font-bold uppercase tracking-[0.15em] opacity-85">{t.subtitle}</P>}
    </div>
  ),
  minimal: ({ t, c1, c2 }) => (
    <div style={{ textShadow: "0 0.06em 0.3em rgb(0 0 0 / 0.75)" }}>
      <div className="flex items-center gap-[0.4em]"><span className="h-[0.12em] w-[1.2em]" style={{ background: c1 }} /><P className="text-[0.55em] font-black uppercase tracking-[0.3em]" style={{ color: c1 }}>{t.kicker}</P></div>
      <P i={1} className="max-w-[22em] truncate text-[1.25em] font-black" style={{ color: c2 }}>{t.title}</P>
      {t.subtitle && <P i={2} className="text-[0.5em] uppercase tracking-[0.2em] opacity-85">{t.subtitle}</P>}
    </div>
  ),
  ticket: ({ t, c1, c2 }) => {
    const notch = "radial-gradient(circle at 0 50%, transparent 0.42em, #000 0.44em) left / 51% 100% no-repeat, radial-gradient(circle at 100% 50%, transparent 0.42em, #000 0.44em) right / 51% 100% no-repeat";
    return (
      <div className="flex items-stretch shadow-lg" style={{ background: `linear-gradient(120deg, ${c1}, ${dark(c1, 72)})`, mask: notch, WebkitMask: notch }}>
        <div className="flex flex-col items-center justify-center gap-[0.1em] py-[0.35em] pl-[0.9em] pr-[0.6em]" style={{ color: c2 }}>
          <Ticket className="size-[1.1em]" />
          <P className="text-[0.4em] font-black uppercase tracking-[0.2em]">{t.kicker}</P>
        </div>
        <span className="my-[0.3em] border-l-[0.08em] border-dashed border-graphic-ink/60" />
        <div className="flex min-w-0 flex-col justify-center py-[0.35em] pl-[0.6em] pr-[1.2em]">
          <P i={1} className="max-w-[22em] truncate font-black uppercase">{t.title}</P>
          {t.subtitle && <P i={2} className="text-[0.5em] font-bold uppercase tracking-[0.15em]" style={{ color: c2 }}>{t.subtitle}</P>}
        </div>
      </div>
    );
  },
};

export function NowShowingCard({ config, text, phase }: { config: OverlayConfig; text: NowText; phase: CardPhase }) {
  const d = designIn(NOW_DESIGNS, config.design);
  const Design = NOW[d.id] ?? NOW["tab"]!;
  return (
    <Shell config={config} phase={phase} fontCqw={(config.size ?? 30) * 0.06} tIn="slide-left" tOut="fade">
      <Design t={text} {...colours(config, d)} img={config.image_url} />
    </Shell>
  );
}

// ───────────────────────────── Local time ─────────────────────────────

interface CP { p: ClockParts; label: string; c1: string; c2: string; showDate: boolean }

const Time = ({ p, className, style }: { p: ClockParts; className?: string; style?: CSSProperties }) => (
  <span className={cn("whitespace-nowrap font-black tabular-nums leading-none", className)} style={style}>
    {p.time}{p.ampm && <span className="ml-[0.2em] text-[0.45em] font-bold">{p.ampm}</span>}
  </span>
);
const DateLine = ({ p, show, className, style }: { p: ClockParts; show: boolean; className?: string; style?: CSSProperties }) =>
  show ? <span className={cn("block whitespace-nowrap text-[0.4em] font-bold uppercase tracking-[0.15em]", className)} style={style}>{p.date}</span> : null;
const Label = ({ label, className, style }: { label: string; className?: string; style?: CSSProperties }) =>
  label ? <span className={cn("block whitespace-nowrap text-[0.38em] font-black uppercase tracking-[0.3em]", className)} style={style}>{label}</span> : null;

function Face({ p, c1, c2 }: { p: ClockParts; c1: string; c2: string }) {
  const hA = ((p.hours % 12) + p.minutes / 60) * 30;
  const mA = p.minutes * 6;
  return (
    <svg viewBox="0 0 40 40" className="size-[1.6em] shrink-0">
      <circle cx="20" cy="20" r="18" fill="var(--graphic-paper)" stroke={c1} strokeWidth="3" />
      {Array.from({ length: 12 }, (_, i) => <line key={i} x1="20" y1="4.5" x2="20" y2={i % 3 ? "6.5" : "8"} stroke={c2} strokeWidth="1.4" transform={`rotate(${i * 30} 20 20)`} />)}
      <line x1="20" y1="20" x2="20" y2="11" stroke={c2} strokeWidth="2.6" strokeLinecap="round" transform={`rotate(${hA} 20 20)`} />
      <line x1="20" y1="20" x2="20" y2="7.5" stroke={c2} strokeWidth="1.6" strokeLinecap="round" transform={`rotate(${mA} 20 20)`} />
      <circle cx="20" cy="20" r="1.8" fill={c1} />
    </svg>
  );
}

const CLOCK: Record<string, (p: CP) => ReactNode> = {
  plain: ({ p, label, c1, c2, showDate }) => (
    <div className="rounded-[0.15em] px-[0.45em] py-[0.25em]" style={{ background: `color-mix(in oklab, ${c1} 82%, transparent)`, borderBottom: `0.08em solid ${c2}` }}>
      <Label label={label} className="mb-[0.15em] opacity-75" /><Time p={p} /><DateLine p={p} show={showDate} className="mt-[0.15em] opacity-80" />
    </div>
  ),
  pill: ({ p, label, c1, c2, showDate }) => (
    <div className="flex items-center gap-[0.35em] rounded-full bg-graphic-paper px-[0.55em] py-[0.25em] text-graphic-night shadow-lg">
      <span className="size-[0.35em] rounded-full animate-tally" style={{ background: c1 }} />
      <div><Label label={label} style={{ color: c1 }} /><Time p={p} style={{ color: c2 }} /><DateLine p={p} show={showDate} className="opacity-70" /></div>
    </div>
  ),
  "date-block": ({ p, label, c1, c2 }) => (
    <div className="flex items-stretch shadow-lg">
      <div className="flex flex-col items-center justify-center px-[0.35em] py-[0.15em] leading-none" style={{ background: c1 }}>
        <span className="text-[0.32em] font-bold tracking-[0.2em]">{p.weekday}</span>
        <span className="text-[0.8em] font-black">{p.day}</span>
        <span className="text-[0.32em] font-bold tracking-[0.2em]">{p.month}</span>
      </div>
      <div className="flex flex-col justify-center px-[0.45em]" style={{ background: c2 }}><Label label={label} className="opacity-70" /><Time p={p} /></div>
    </div>
  ),
  digital: ({ p, label, c1, c2, showDate }) => (
    <div className="rounded-[0.2em] px-[0.5em] py-[0.25em] font-mono" style={{ background: c2, border: `0.05em solid ${dark(c1, 45)}`, color: c1 }}>
      <Label label={label} className="opacity-80" />
      <Time p={p} className="font-mono tracking-[0.08em]" style={{ textShadow: glow(c1) }} />
      <DateLine p={p} show={showDate} className="opacity-80" />
    </div>
  ),
  city: ({ p, label, c1, c2, showDate }) => (
    <div className="px-[0.5em] pb-[0.2em] pt-[0.25em] shadow-lg" style={{ background: `color-mix(in oklab, ${c2} 88%, transparent)`, borderBottom: `0.1em solid ${c1}` }}>
      <Label label={label || "KAMPALA"} className="mb-[0.15em]" style={{ color: c1 }} /><Time p={p} /><DateLine p={p} show={showDate} className="mt-[0.15em] opacity-75" />
    </div>
  ),
  tab: ({ p, label, c1, c2, showDate }) => (
    <div className="shadow-lg">
      {label && <div className="inline-block px-[0.4em] py-[0.12em]" style={{ background: c1 }}><Label label={label} /></div>}
      <div className="px-[0.45em] py-[0.2em]" style={{ background: c2 }}><Time p={p} /><DateLine p={p} show={showDate} className="opacity-75" /></div>
    </div>
  ),
  glass: ({ p, label, c1, showDate }) => (
    <div className="flex items-center gap-[0.35em] rounded-[0.3em] border border-graphic-ink/25 bg-graphic-black/40 px-[0.5em] py-[0.25em] backdrop-blur-md">
      <Clock className="size-[0.75em] shrink-0" style={{ color: c1 }} />
      <div><Label label={label} className="opacity-75" /><Time p={p} /><DateLine p={p} show={showDate} className="opacity-75" /></div>
    </div>
  ),
  analog: ({ p, label, c1, c2, showDate }) => (
    <div className="flex items-center gap-[0.35em] rounded-[0.3em] px-[0.35em] py-[0.2em] shadow-lg" style={{ background: c2 }}>
      <Face p={p} c1={c1} c2={c2} />
      <div><Label label={label} className="opacity-75" /><Time p={p} /><DateLine p={p} show={showDate} className="opacity-75" /></div>
    </div>
  ),
  circle: ({ p, label, c1, c2 }) => (
    <div className="grid size-[2.8em] place-items-center rounded-full text-center shadow-lg" style={{ background: c2, border: `0.12em solid ${c1}` }}>
      <div className="leading-none"><Label label={label} className="mb-[0.2em] text-[0.26em] tracking-[0.2em]" style={{ color: c1 }} /><Time p={p} className="text-[0.75em]" /></div>
    </div>
  ),
  slant: ({ p, label, c1, c2 }) => (
    <div className="flex items-stretch shadow-lg">
      <div className="flex flex-col justify-center py-[0.2em] pl-[0.4em] pr-[0.8em]" style={{ background: c1, clipPath: slantR }}><Label label={label} className="opacity-85" /><Time p={p} /></div>
      <div className="-ml-[0.4em] flex items-center py-[0.2em] pl-[0.8em] pr-[0.6em]" style={{ background: c2, clipPath: slantBoth }}><span className="whitespace-nowrap text-[0.45em] font-black uppercase leading-tight tracking-[0.12em]">{p.weekday}<br />{p.day} {p.month}</span></div>
    </div>
  ),
  neon: ({ p, label, c1, c2, showDate }) => (
    <div className="px-[0.2em]" style={{ color: c1 }}>
      <Label label={label} style={{ textShadow: glow(c2) }} />
      <Time p={p} style={{ textShadow: glow(c2) }} />
      <DateLine p={p} show={showDate} style={{ textShadow: glow(c2) }} />
    </div>
  ),
  calendar: ({ p, label, c1, c2 }) => (
    <div className="flex items-stretch overflow-hidden rounded-[0.25em] shadow-lg">
      <div className="flex flex-col bg-graphic-paper text-center text-graphic-night">
        <span className="px-[0.5em] text-[0.32em] font-black tracking-[0.2em] text-graphic-ink" style={{ background: c1 }}>{p.month}</span>
        <span className="px-[0.25em] text-[0.85em] font-black leading-[1.1]">{p.day}</span>
      </div>
      <div className="flex flex-col justify-center px-[0.45em]" style={{ background: c2 }}><Label label={label || p.weekday} className="opacity-75" /><Time p={p} /></div>
    </div>
  ),
};

export function ClockCard({ config, parts, label, phase = "hold" }: { config: OverlayConfig; parts: ClockParts; label: string; phase?: CardPhase | undefined }) {
  const d = designIn(CLOCK_DESIGNS, config.design);
  const Design = CLOCK[d.id] ?? CLOCK["plain"]!;
  return (
    <Shell config={config} phase={phase} fontCqw={(config.size ?? 8) * 0.2} tIn="fade" tOut="fade">
      <Design p={parts} label={label} {...colours(config, d)} showDate={!!config.show_date} />
    </Shell>
  );
}

// ───────────────────────────── ON AIR ─────────────────────────────

interface AP { text: string; tag: string; c1: string; c2: string; blink: boolean }

const Dot = ({ c, blink, className }: { c: string; blink: boolean; className?: string }) => <span className={cn("size-[0.45em] shrink-0 rounded-full", blink && "animate-tally", className)} style={{ background: c }} />;
const Word = ({ text, className, style }: { text: string; className?: string; style?: CSSProperties }) => <span className={cn("whitespace-nowrap font-black uppercase leading-none tracking-[0.18em]", className)} style={style}>{text}</span>;

const ONAIR: Record<string, (p: AP) => ReactNode> = {
  tally: ({ text, c1, c2, blink }) => (
    <div className="flex items-center gap-[0.4em] rounded-[0.12em] px-[0.55em] py-[0.3em] shadow-lg" style={{ background: c1 }}><Dot c={c2} blink={blink} /><Word text={text} /></div>
  ),
  pill: ({ text, c1, c2, blink }) => (
    <div className="flex items-center gap-[0.4em] rounded-full px-[0.6em] py-[0.3em] shadow-lg" style={{ background: `color-mix(in oklab, ${c2} 80%, transparent)` }}><Dot c={c1} blink={blink} /><Word text={text} /></div>
  ),
  outline: ({ text, c1, c2, blink }) => (
    <div className="flex items-center gap-[0.4em] rounded-[0.15em] px-[0.5em] py-[0.25em]" style={{ border: `0.12em solid ${c1}`, color: c1, background: `color-mix(in oklab, ${c2} 45%, transparent)` }}><Dot c={c1} blink={blink} /><Word text={text} /></div>
  ),
  neon: ({ text, c1, c2, blink }) => (
    <div className={cn("rounded-[0.3em] px-[0.6em] py-[0.3em]", blink && "animate-tally")} style={{ border: `0.08em solid ${c1}`, boxShadow: `${glow(c1)}, inset 0 0 0.5em ${c1}`, background: "color-mix(in oklab, black 55%, transparent)" }}>
      <Word text={text} style={{ color: light(c1, 70), textShadow: `${glow(c1)}, 0 0 1.2em ${c2}` }} />
    </div>
  ),
  rec: ({ text, c1, c2, blink }) => (
    <div className="relative flex items-center gap-[0.4em] px-[0.6em] py-[0.35em]" style={{ background: `color-mix(in oklab, ${c2} 70%, transparent)` }}>
      {["left-0 top-0 border-l border-t", "right-0 top-0 border-r border-t", "left-0 bottom-0 border-l border-b", "right-0 bottom-0 border-r border-b"].map((k) => <span key={k} className={cn("absolute size-[0.4em] border-graphic-ink", k)} style={{ borderWidth: "0.08em" }} />)}
      <Dot c={c1} blink={blink} className="size-[0.55em]" /><Word text={text} className="font-mono" />
    </div>
  ),
  split: ({ text, tag, c1, c2, blink }) => (
    <div className="flex items-stretch shadow-lg">
      <div className="flex items-center gap-[0.35em] px-[0.5em] py-[0.3em]" style={{ background: c1 }}><Dot c="var(--graphic-ink)" blink={blink} /><Word text={text} /></div>
      <div className="flex items-center px-[0.5em]" style={{ background: c2 }}><Word text={tag || "TV"} className="text-[0.8em]" /></div>
    </div>
  ),
  waves: ({ text, c1, c2, blink }) => (
    <div className="flex items-center gap-[0.4em] rounded-[0.2em] px-[0.5em] py-[0.25em] shadow-lg" style={{ background: c2 }}>
      <Radio className={cn("size-[1em] shrink-0", blink && "animate-tally")} style={{ color: c1 }} /><Word text={text} />
    </div>
  ),
  glass: ({ text, c1, blink }) => (
    <div className="flex items-center gap-[0.4em] rounded-[0.35em] border border-graphic-ink/25 bg-graphic-black/40 px-[0.6em] py-[0.3em] backdrop-blur-md"><Dot c={c1} blink={blink} /><Word text={text} /></div>
  ),
  slant: ({ text, c1, c2, blink }) => (
    <div className="relative">
      <div className="flex items-center gap-[0.4em] py-[0.3em] pl-[0.8em] pr-[0.9em] shadow-lg" style={{ background: c1, clipPath: slantBoth }}><Dot c="var(--graphic-ink)" blink={blink} /><Word text={text} className="italic" /></div>
      <span className="absolute -bottom-[0.2em] left-[0.5em] right-[0.3em] h-[0.14em]" style={{ background: c2 }} />
    </div>
  ),
  circle: ({ text, c1, c2, blink }) => (
    <div className={cn("grid size-[2.6em] place-items-center rounded-full text-center shadow-lg", blink && "animate-tally")} style={{ background: c1, border: `0.12em solid ${c2}` }}>
      <Word text={text} className="max-w-[4.4em] whitespace-normal text-center text-[0.42em] leading-[1.05] tracking-[0.06em]" />
    </div>
  ),
  tv: ({ text, tag, c1, c2, blink }) => (
    <div className="flex items-stretch overflow-hidden rounded-[0.2em] shadow-lg">
      <div className="grid place-items-center px-[0.4em]" style={{ background: c1 }}><Tv className="size-[0.95em]" /></div>
      <div className="flex items-center gap-[0.4em] px-[0.5em] py-[0.25em]" style={{ background: c2 }}>
        <Dot c={c1} blink={blink} /><Word text={text} />{tag && <span className="text-[0.6em] font-bold uppercase tracking-[0.15em] opacity-75">{tag}</span>}
      </div>
    </div>
  ),
  pulse: ({ text, c1, blink }) => (
    <div className="flex items-center gap-[0.5em] rounded-full bg-graphic-black/60 py-[0.3em] pl-[0.5em] pr-[0.7em]">
      <span className="relative grid size-[0.6em] place-items-center">
        {blink && <span className="absolute inset-0 animate-ping rounded-full" style={{ background: c1 }} />}
        <span className="size-[0.6em] rounded-full" style={{ background: c1 }} />
      </span>
      <Word text={text} />
    </div>
  ),
};

export function OnAirCard({ config, phase = "hold" }: { config: OverlayConfig; phase?: CardPhase | undefined }) {
  const d = designIn(ONAIR_DESIGNS, config.design);
  const Design = ONAIR[d.id] ?? ONAIR["tally"]!;
  return (
    <Shell config={config} phase={phase} fontCqw={(config.size ?? 6) * 0.22} tIn="fade" tOut="fade">
      <Design text={config.text || "ON AIR"} tag={config.tag ?? ""} {...colours(config, d)} blink={config.blink !== false} />
    </Shell>
  );
}

// ───────────────────────────── Logo + text ─────────────────────────────

const CAPTION: Record<string, (p: { text: string; c1: string; c2: string }) => ReactNode> = {
  plain: ({ text, c1 }) => <Word text={text} className="tracking-[0.12em]" style={{ color: c1, textShadow: "0 0.05em 0.25em rgb(0 0 0 / 0.6)" }} />,
  spaced: ({ text, c1, c2 }) => (
    <div className="text-center"><Word text={text} className="font-bold tracking-[0.55em]" style={{ color: c1, textShadow: "0 0.05em 0.25em rgb(0 0 0 / 0.6)" }} /><span className="mx-auto mt-[0.15em] block h-[0.1em] w-[60%]" style={{ background: c2 }} /></div>
  ),
  pill: ({ text, c1, c2 }) => <div className="rounded-full px-[0.6em] py-[0.15em]" style={{ background: c1, color: c2 }}><Word text={text} className="tracking-[0.15em]" /></div>,
  box: ({ text, c1, c2 }) => <div className="rounded-[0.12em] px-[0.4em] py-[0.12em]" style={{ background: c1, color: c2 }}><Word text={text} className="tracking-[0.12em]" /></div>,
  outline: ({ text, c1, c2 }) => <div className="rounded-[0.12em] px-[0.4em] py-[0.08em]" style={{ border: `0.1em solid ${c2}`, color: c1 }}><Word text={text} className="tracking-[0.15em]" /></div>,
  gradient: ({ text, c1, c2 }) => <Word text={text} className="tracking-[0.1em]" style={{ backgroundImage: `linear-gradient(90deg, ${c1}, ${c2})`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", filter: "drop-shadow(0 0.04em 0.12em rgb(0 0 0 / 0.5))" }} />,
  glow: ({ text, c1, c2 }) => <Word text={text} className="tracking-[0.15em]" style={{ color: c1, textShadow: `0 0 0.15em ${c1}, 0 0 0.45em ${c2}, 0 0 0.9em ${c2}` }} />,
  lines: ({ text, c1, c2 }) => (
    <div className="flex items-center gap-[0.3em]"><span className="h-[0.1em] w-[0.9em]" style={{ background: c2 }} /><Word text={text} style={{ color: c1, textShadow: "0 0.05em 0.25em rgb(0 0 0 / 0.6)" }} /><span className="h-[0.1em] w-[0.9em]" style={{ background: c2 }} /></div>
  ),
  slant: ({ text, c1, c2 }) => <div className="px-[0.7em] py-[0.12em]" style={{ background: c1, color: c2, clipPath: slantBoth }}><Word text={text} className="italic tracking-[0.12em]" /></div>,
  glass: ({ text, c1, c2 }) => <div className="rounded-[0.3em] border border-graphic-ink/25 bg-graphic-black/40 px-[0.5em] py-[0.12em] backdrop-blur-md" style={{ color: c1, borderBottomColor: c2 }}><Word text={text} className="tracking-[0.15em]" /></div>,
  stamp: ({ text, c1, c2 }) => <div className="-rotate-6 rounded-[0.2em] px-[0.45em] py-[0.1em] shadow-lg" style={{ background: c1, color: c2, outline: `0.06em dashed ${c2}`, outlineOffset: "-0.2em" }}><Word text={text} className="tracking-[0.1em]" /></div>,
  gold: ({ text, c1, c2 }) => <Word text={text} className="italic tracking-[0.12em]" style={{ backgroundImage: `linear-gradient(180deg, ${c1} 15%, ${c2} 55%, ${c1} 90%)`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", filter: "drop-shadow(0 0.05em 0.1em rgb(0 0 0 / 0.6))" }} />,
  split: ({ text, c1, c2 }) => <div className="rounded-[0.12em] px-[0.45em] py-[0.12em]" style={{ background: `linear-gradient(90deg, ${c1} 50%, ${c2} 50%)` }}><Word text={text} className="tracking-[0.15em]" /></div>,
  dots: ({ text, c1, c2 }) => (
    <div className="flex items-center gap-[0.3em]" style={{ textShadow: "0 0.05em 0.25em rgb(0 0 0 / 0.6)" }}><span className="size-[0.25em] rounded-full" style={{ background: c2 }} /><Word text={text} style={{ color: c1 }} /><span className="size-[0.25em] rounded-full" style={{ background: c2 }} /></div>
  ),
};

/** Channel logo (uploaded picture or the wordmark) with optional styled text under or next to it. */
export function LogoMark({ config, phase = "hold" }: { config: OverlayConfig; phase?: CardPhase | undefined }) {
  const d = designIn(CAPTION_DESIGNS, config.design);
  const Design = CAPTION[d.id] ?? CAPTION["plain"]!;
  const size = config.size ?? 12;
  const caption = (config.caption ?? "").trim();
  const place = config.caption_pos ?? "below";
  const ms = Math.min(3000, Math.max(150, Number(config.transition_ms) || 700));
  const flex = place === "below" ? "flex-col items-center" : place === "above" ? "flex-col-reverse items-center" : place === "right" ? "flex-row items-center" : "flex-row-reverse items-center";
  return (
    <div
      className={cn("mmx-card flex w-max gap-[0.3cqw] text-graphic-ink", flex)}
      data-phase={phase}
      style={{ animation: transitionAnimation(phase, config.transition_in ?? "fade", config.transition_out ?? "fade", ms), ["--mmx-ms" as string]: `${ms}ms` }}
    >
      <div style={{ width: config.logo_url ? `${size}cqw` : undefined, fontSize: `${size * 0.18}cqw` }}>
        {config.logo_url ? <img src={config.logo_url} alt="" className="w-full" /> : <Wordmark className="whitespace-nowrap" />}
      </div>
      {caption && (
        <div style={{ fontSize: `${(size * (config.caption_size ?? 18)) / 100}cqw` }}>
          <P i={1}><Design text={caption} {...colours(config, d)} /></P>
        </div>
      )}
    </div>
  );
}
