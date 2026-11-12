import { useId, type CSSProperties, type ReactNode } from "react";
import { designById, transitionAnimation, type CardPhase, type CardText } from "@/lib/brand-cards";
import type { OverlayConfig } from "@/lib/graphics";
import { cn } from "@/lib/utils";

/** One line of card text; arrives a moment after the card (staggered by `i`). */
function P({ i = 0, className, style, children }: { i?: number; className?: string; style?: CSSProperties; children: ReactNode }) {
  return <div className={cn("mmx-part", className)} style={{ ["--i" as string]: i, ...style }}>{children}</div>;
}

/** "5:20 PM" → big "5:20" + small "pm", like broadcast promos. */
function Time({ value }: { value: string }) {
  const m = value.match(/^(.*?\d{1,2}:\d{2})\s?(am|pm)$/i);
  if (!m) return <>{value}</>;
  return <>{m[1]}<span className="ml-[0.08em] text-[0.55em] lowercase">{m[2]}</span></>;
}

function Photo({ src, c1, c2, className, contain }: { src?: string | undefined; c1: string; c2: string; className?: string; contain?: boolean }) {
  if (src) return <img src={src} alt="" className={cn("h-full w-full", contain ? "object-contain object-bottom" : "object-cover object-top", className)} />;
  return <div className={cn("grid h-full w-full place-items-center", className)} style={{ background: `linear-gradient(135deg, ${c2}, ${c1})` }}><span className="wordmark text-[0.45em] opacity-80">MOVIE MAX</span></div>;
}

interface DesignProps { t: CardText; img?: string | undefined; c1: string; c2: string; uid: string }

const DESIGNS: Record<string, (p: DesignProps) => ReactNode> = {
  showcase: ({ t, img, c1, c2 }) => (
    <div className="relative" style={{ height: "4.4em" }}>
      <div className="absolute inset-0 overflow-hidden rounded-r-[0.45em]" style={{ background: `linear-gradient(115deg, ${c1}, ${c2})` }}>
        <div className="absolute -inset-y-4 left-[42%] w-[22%] -skew-x-[18deg] bg-graphic-ink/10" />
        <div className="absolute -inset-y-4 right-[6%] w-[12%] -skew-x-[18deg] bg-graphic-ink/10" />
      </div>
      {img && <div className="absolute bottom-0 left-[29%] h-[135%] w-[36%]"><Photo src={img} c1={c1} c2={c2} contain /></div>}
      <div className={cn("absolute inset-y-0 left-0 flex items-center px-[0.5em]", img ? "w-[30%]" : "w-[60%]")}>
        <P className="mmx-italic line-clamp-3 text-[0.68em] uppercase [overflow-wrap:anywhere]">{t.title}</P>
      </div>
      <div className="absolute inset-y-0 right-0 flex w-[36%] flex-col items-center justify-center px-[0.3em] text-center">
        <P i={1} className="text-[1.35em] font-black uppercase leading-none">{t.kicker}</P>
        {t.time && <P i={2} className="mt-[0.15em] text-[0.75em] font-bold"><Time value={t.time} /></P>}
        {t.subtitle && <P i={3} className="mt-[0.1em] text-[0.45em] uppercase tracking-widest opacity-90">{t.subtitle}</P>}
      </div>
    </div>
  ),
  tonight: ({ t, img, c1, c2 }) => (
    <div className="relative flex items-end" style={{ height: "3.4em" }}>
      {img && <div className="relative -mr-[1.4em] h-full w-[34%] overflow-hidden rounded-l-[1.1em]"><Photo src={img} c1={c1} c2={c2} /></div>}
      <div className="relative min-w-0 flex-1">
        <div className="ml-[1.2em] inline-block rounded-t-[0.45em] px-[0.9em] pt-[0.15em]" style={{ background: c1 }}><P className="text-[0.5em] font-bold uppercase tracking-[0.2em]">{t.kicker}</P></div>
        <div className="flex h-[1.9em] items-center justify-between gap-[0.4em] rounded-l-[0.45em] rounded-r-[0.2em] pl-[1.6em] pr-[0.6em]" style={{ background: c2, boxShadow: `inset 0 -0.14em 0 ${c1}` }}>
          <P i={1} className="mmx-italic line-clamp-2 max-w-[58%] text-[0.55em] uppercase text-graphic-night">{t.title}</P>
          {t.time ? <P i={2} className="mmx-italic whitespace-nowrap text-[1.15em]"><Time value={t.time} /></P> : t.subtitle && <P i={2} className="mmx-italic text-[0.55em] uppercase">{t.subtitle}</P>}
        </div>
      </div>
    </div>
  ),
  "next-tab": ({ t, img, c1, c2 }) => (
    <div className="flex h-[1.8em] items-stretch">
      {img && <div className="mr-[-0.6em] w-[2.6em] overflow-hidden rounded-l-full"><Photo src={img} c1={c1} c2={c2} /></div>}
      <div className={cn("flex min-w-0 flex-1 items-center pl-[0.9em] pr-[1.3em]", !img && "rounded-l-full")} style={{ background: c2 }}><P className="mmx-italic line-clamp-2 text-[0.55em] uppercase text-graphic-night">{t.title}</P></div>
      <div className="-ml-[0.7em] flex items-center gap-[0.35em] rounded-r-[0.5em] pl-[1.1em] pr-[0.8em]" style={{ background: c1, clipPath: "polygon(0.7em 0, 100% 0, 100% 100%, 0 100%)" }}>
        <P i={1} className="mmx-italic text-[0.95em] uppercase">{t.kicker}</P>
        {t.time && <P i={2} className="mmx-italic whitespace-nowrap text-[0.6em]" style={{ color: c2 }}><Time value={t.time} /></P>}
      </div>
    </div>
  ),
  "photo-card": ({ t, img, c1, c2 }) => (
    <div className="relative flex items-center" style={{ height: "4em" }}>
      <div className="h-full w-[44%] overflow-hidden rounded-[0.7em] bg-graphic-paper"><Photo src={img} c1={c1} c2={c2} /></div>
      <div className="-ml-[1.4em] flex h-[72%] min-w-0 flex-1 flex-col justify-center rounded-[0.6em] px-[0.8em] shadow-lg" style={{ background: `linear-gradient(90deg, ${c1}, color-mix(in oklab, ${c1} 65%, black))` }}>
        <P className="mmx-italic text-[0.45em] uppercase" style={{ color: c2 }}>{t.kicker}</P>
        <P i={1} className="mmx-italic line-clamp-2 text-[0.72em] uppercase">{t.title}</P>
        {t.time && <P i={2} className="mmx-italic text-[0.8em]" style={{ color: c2 }}><Time value={t.time} /></P>}
      </div>
    </div>
  ),
  poster: ({ t, img, c1, c2 }) => (
    <div className="relative flex" style={{ height: "3.8em" }}>
      {img && <div className="w-[38%] overflow-hidden rounded-tl-[0.55em]"><Photo src={img} c1={c1} c2={c2} /></div>}
      <div className={cn("relative flex min-w-0 flex-1 flex-col justify-center px-[0.6em] pb-[0.9em]", img ? "rounded-tr-[0.55em]" : "rounded-t-[0.55em]")} style={{ background: c1 }}>
        <P className="mmx-italic line-clamp-2 text-[0.95em] uppercase">{t.title}</P>
        {t.subtitle && <P i={1} className="text-[0.4em] uppercase tracking-widest opacity-80">{t.subtitle}</P>}
      </div>
      <div className="absolute -bottom-[0.25em] -right-[0.4em] flex h-[1.1em] w-[64%] items-center gap-[0.5em] rounded-r-[0.45em] px-[0.6em] shadow-md" style={{ background: c2 }}>
        <P i={2} className="mmx-italic text-[0.6em] uppercase">{t.kicker}</P>
        {t.time && <P i={3} className="mmx-italic text-[0.6em]"><Time value={t.time} /></P>}
      </div>
    </div>
  ),
  promo: ({ t, img, c1, c2 }) => (
    <div className="relative flex h-[3.6em] items-center gap-[0.6em] rounded-[0.15em] pl-[0.7em]" style={{ background: `linear-gradient(100deg, ${c1}, color-mix(in oklab, ${c1} 55%, black))` }}>
      {img && <div className="h-[80%] w-[22%] shrink-0 overflow-hidden rounded-[0.3em]"><Photo src={img} c1={c1} c2={c2} /></div>}
      <P className="mmx-italic line-clamp-3 min-w-0 flex-1 text-[0.75em] uppercase" style={{ color: c2 }}>{t.title}</P>
      <div className="flex shrink-0 flex-col items-start">
        <P i={1} className="mmx-italic pr-[0.6em] text-[0.8em] uppercase">{t.kicker}</P>
        {t.time && <div className="-mr-[0.8em] mt-[0.15em] rounded-l-[0.3em] py-[0.05em] pl-[0.5em] pr-[1.4em]" style={{ background: c2 }}><P i={2} className="mmx-italic whitespace-nowrap text-[0.85em]"><Time value={t.time} /></P></div>}
      </div>
    </div>
  ),
  "glass-ring": ({ t, img, c1, c2 }) => (
    <div className="relative flex h-[2.6em] items-center gap-[0.5em] rounded-[0.35em] bg-graphic-paper px-[1em] shadow-[0_0.3em_1em_rgba(0,0,0,.35)]">
      <span className="absolute -left-[0.55em] -top-[0.55em] size-[1.4em] rounded-full" style={{ background: `conic-gradient(${c1}, ${c2}, ${c1})`, maskImage: "radial-gradient(circle, transparent 50%, black 53%)", WebkitMaskImage: "radial-gradient(circle, transparent 50%, black 53%)" }} />
      <span className="absolute -bottom-[0.35em] -right-[0.25em] size-[0.8em] -rotate-[20deg]" style={{ background: c2, clipPath: "polygon(0 0, 100% 50%, 0 100%)" }} />
      {img && <div className="size-[1.9em] shrink-0 overflow-hidden rounded-full" style={{ boxShadow: `0 0 0 0.1em ${c1}` }}><Photo src={img} c1={c1} c2={c2} /></div>}
      <div className="min-w-0">
        <P className="text-[0.4em] font-bold uppercase tracking-[0.3em]" style={{ color: c1 }}>{t.kicker}</P>
        <P i={1} className="truncate text-[0.8em] font-black uppercase leading-tight text-graphic-night">{t.title}</P>
        {(t.subtitle || t.time) && <P i={2} className="text-[0.36em] font-semibold uppercase tracking-[0.3em] text-graphic-night/70">{[t.subtitle, t.time].filter(Boolean).join(" · ")}</P>}
      </div>
    </div>
  ),
  swoosh: ({ t, img, c1, c2, uid }) => (
    <div className="relative flex h-[2.7em] items-center gap-[0.5em] overflow-hidden rounded-[0.3em] bg-graphic-paper px-[0.9em] shadow-[0_0.3em_1em_rgba(0,0,0,.35)]">
      <svg viewBox="0 0 200 60" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <defs><linearGradient id={`sw-${uid}`} x1="0" x2="1"><stop offset="0" stopColor={c1} /><stop offset="1" stopColor={c2} /></linearGradient></defs>
        <path d="M0 60 C 70 38, 120 64, 200 22 L200 60 Z" fill={`url(#sw-${uid})`} />
        <path d="M120 0 C 160 18, 180 6, 200 0 Z" fill={`url(#sw-${uid})`} opacity=".85" />
      </svg>
      {img && <div className="relative size-[1.9em] shrink-0 overflow-hidden rounded-[0.3em]"><Photo src={img} c1={c1} c2={c2} /></div>}
      <div className="relative min-w-0 pb-[0.3em]">
        <P className="text-[0.4em] font-bold uppercase tracking-[0.3em]" style={{ color: c1 }}>{t.kicker}{t.time && ` · ${t.time}`}</P>
        <P i={1} className="truncate text-[0.85em] font-black uppercase leading-tight text-graphic-night">{t.title}</P>
        {t.subtitle && <P i={2} className="text-[0.36em] uppercase tracking-[0.3em] text-graphic-night/70">{t.subtitle}</P>}
      </div>
    </div>
  ),
  flame: ({ t, img, c1, c2 }) => (
    <div className="relative flex h-[2.3em] items-center gap-[0.5em] overflow-hidden rounded-[0.15em] px-[0.8em]" style={{ background: `linear-gradient(90deg, ${c1}, ${c2})` }}>
      <span className="absolute -right-[0.6em] -top-[1em] size-[3em] rounded-full border-[0.35em] border-graphic-ink/20" />
      <span className="absolute -bottom-[1.3em] right-[1.8em] size-[2.2em] rounded-full bg-graphic-ink/15" />
      {img && <div className="relative size-[1.7em] shrink-0 overflow-hidden rounded-full border-[0.08em] border-graphic-ink"><Photo src={img} c1={c1} c2={c2} /></div>}
      <div className="relative min-w-0">
        <P className="text-[0.38em] font-bold uppercase tracking-[0.3em] opacity-90">{t.kicker}</P>
        <P i={1} className="truncate text-[0.8em] font-black uppercase leading-tight">{t.title}</P>
        {(t.subtitle || t.time) && <P i={2} className="text-[0.36em] uppercase tracking-[0.3em] opacity-90">{[t.subtitle, t.time].filter(Boolean).join(" · ")}</P>}
      </div>
    </div>
  ),
  blob: ({ t, img, c1, c2 }) => (
    <div className="relative pl-[0.3em] pt-[0.4em]">
      <span className="absolute left-0 top-0 z-10 size-[1em] rounded-full border-[0.16em]" style={{ borderColor: c2 }} />
      <div className="flex min-h-[3em] items-end gap-[0.5em] rounded-[0.25em] rounded-tr-[2em] px-[0.8em] pb-[0.5em] pt-[0.8em] shadow-lg" style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
        {img && <div className="size-[2em] shrink-0 overflow-hidden rounded-[0.4em]"><Photo src={img} c1={c1} c2={c2} /></div>}
        <div className="min-w-0">
          <P className="line-clamp-2 text-[0.8em] font-black uppercase leading-tight">{t.title}</P>
          <P i={1} className="text-[0.42em] font-bold uppercase tracking-[0.25em]">{t.kicker}</P>
          {(t.subtitle || t.time) && <P i={2} className="text-[0.36em] uppercase tracking-[0.2em] opacity-85">{[t.subtitle, t.time].filter(Boolean).join(" · ")}</P>}
        </div>
      </div>
      <span className="absolute -right-[0.2em] bottom-[0.4em] size-[0.6em]" style={{ background: c2, clipPath: "polygon(0 0, 100% 50%, 0 100%)" }} />
    </div>
  ),
  neon: ({ t, img, c1, c2 }) => (
    <div className="flex items-center gap-[0.4em]">
      {img && <div className="size-[2.2em] shrink-0 overflow-hidden rounded-full" style={{ boxShadow: `0 0 0.5em ${c1}` }}><Photo src={img} c1={c1} c2={c2} /></div>}
      <div className="flex min-w-0 flex-col items-start">
        <P className="line-clamp-2 text-[1.05em] font-black uppercase leading-none" style={{ textShadow: `0 0 0.35em ${c1}, 0 0.05em 0.12em rgba(0,0,0,.7)` }}>{t.title}</P>
        <div className="mt-[0.2em] rounded-[0.25em] px-[0.6em] py-[0.1em]" style={{ background: `linear-gradient(90deg, ${c1}, ${c2})`, boxShadow: `0 0 0.6em ${c1}` }}>
          <P i={1} className="whitespace-nowrap text-[0.48em] font-bold uppercase tracking-[0.2em]">{[t.kicker, t.time, t.subtitle].filter(Boolean).join(" · ")}</P>
        </div>
      </div>
    </div>
  ),
  split: ({ t, img, c1, c2 }) => (
    <div className="flex h-[2.8em] overflow-hidden rounded-[0.15em] shadow-lg">
      <div className="relative z-10 flex w-[60%] min-w-0 flex-col justify-center bg-graphic-paper px-[0.7em]">
        <P className="text-[0.4em] font-bold uppercase tracking-[0.25em]" style={{ color: c1 }}>{t.kicker}</P>
        <P i={1} className="truncate text-[0.8em] font-black leading-tight text-graphic-night">{t.title}</P>
        {(t.subtitle || t.time) && <P i={2} className="text-[0.38em] font-semibold text-graphic-night/70">{[t.subtitle, t.time].filter(Boolean).join(" · ")}</P>}
      </div>
      <div className="relative -ml-[0.8em] flex-1 overflow-hidden" style={{ background: `linear-gradient(135deg, ${c1}, ${c2})`, clipPath: "polygon(0.8em 0, 100% 0, 100% 100%, 0 100%)" }}>
        {img ? <Photo src={img} c1={c1} c2={c2} /> : <>
          <span className="absolute -right-[0.8em] -top-[0.8em] size-[2.6em] rounded-full bg-graphic-ink/20" />
          <span className="absolute -bottom-[1em] left-[20%] size-[2em] rounded-full bg-graphic-ink/15" />
        </>}
      </div>
    </div>
  ),
  stripes: ({ t, img, c1, c2 }) => (
    <div className="relative flex h-[2.6em] items-center gap-[0.5em] overflow-hidden rounded-[0.4em] bg-graphic-night px-[0.8em] shadow-lg">
      <div className="absolute inset-y-0 right-0 w-[45%]" style={{ background: `repeating-linear-gradient(115deg, transparent 0 0.45em, ${c1} 0.45em 0.85em, transparent 0.85em 1.3em, ${c2} 1.3em 1.7em)`, maskImage: "linear-gradient(90deg, transparent, black 70%)", WebkitMaskImage: "linear-gradient(90deg, transparent, black 70%)" }} />
      {img && <div className="relative size-[1.8em] shrink-0 overflow-hidden rounded-[0.3em]"><Photo src={img} c1={c1} c2={c2} /></div>}
      <div className="relative min-w-0">
        <P className="text-[0.4em] font-bold uppercase tracking-[0.3em]" style={{ color: c2 }}>{t.kicker}</P>
        <P i={1} className="truncate text-[0.85em] font-black leading-tight">{t.title}</P>
        {(t.subtitle || t.time) && <P i={2} className="text-[0.36em] uppercase tracking-[0.25em] opacity-75">{[t.subtitle, t.time].filter(Boolean).join(" · ")}</P>}
      </div>
    </div>
  ),
  confetti: ({ t, img, c1, c2 }) => (
    <div className="relative flex h-[2.8em] items-center gap-[0.5em] overflow-hidden rounded-[0.15em] px-[0.9em] shadow-lg" style={{ background: c1 }}>
      {[["8%", "12%", 0], ["88%", "18%", 40], ["70%", "70%", 200], ["22%", "78%", 120], ["95%", "62%", 300]].map(([l, tp, r], i) => (
        <span key={i} className="absolute size-[0.4em]" style={{ left: l as string, top: tp as string, transform: `rotate(${r}deg)`, background: i % 2 ? c2 : "color-mix(in oklab, " + c2 + " 40%, #22d3ee)", clipPath: "polygon(50% 0, 100% 100%, 0 100%)" }} />
      ))}
      <svg viewBox="0 0 40 10" className="absolute right-[18%] top-[10%] w-[1.6em]" fill="none" stroke={c2} strokeWidth="2"><path d="M0 5 Q 5 0 10 5 T 20 5 T 30 5 T 40 5" /></svg>
      {img && <div className="relative size-[1.9em] shrink-0 overflow-hidden rounded-[0.2em]" style={{ boxShadow: `0 0 0 0.08em ${c2}` }}><Photo src={img} c1={c1} c2={c2} /></div>}
      <div className="relative min-w-0">
        <P className="text-[0.4em] font-bold uppercase tracking-[0.3em]">{t.kicker}</P>
        <P i={1} className="truncate text-[0.85em] font-black leading-tight" style={{ color: c2 }}>{t.title}</P>
        {(t.subtitle || t.time) && <P i={2} className="text-[0.36em] uppercase tracking-[0.25em] opacity-80">{[t.subtitle, t.time].filter(Boolean).join(" · ")}</P>}
      </div>
    </div>
  ),
  bokeh: ({ t, img, c1, c2 }) => (
    <div className="relative flex h-[2.8em] items-center justify-center gap-[0.5em] overflow-hidden rounded-[0.3em] px-[0.9em] text-center shadow-lg" style={{ background: `color-mix(in oklab, ${c1} 45%, black)` }}>
      <span className="absolute -left-[0.5em] top-[0.2em] size-[2.2em] rounded-full blur-[0.4em]" style={{ background: c1 }} />
      <span className="absolute right-[10%] -top-[0.8em] size-[2em] rounded-full opacity-90 blur-[0.45em]" style={{ background: c2 }} />
      <span className="absolute -bottom-[1em] left-[45%] size-[1.8em] rounded-full opacity-80 blur-[0.4em]" style={{ background: "color-mix(in oklab, " + c2 + " 50%, #38bdf8)" }} />
      {img && <div className="relative size-[1.9em] shrink-0 overflow-hidden rounded-full"><Photo src={img} c1={c1} c2={c2} /></div>}
      <div className="relative min-w-0">
        <P className="truncate text-[0.85em] font-black leading-tight">{t.title}</P>
        <P i={1} className="text-[0.38em] font-bold uppercase tracking-[0.3em]">{[t.kicker, t.time, t.subtitle].filter(Boolean).join(" · ")}</P>
      </div>
    </div>
  ),
  classic: ({ t, img, c1, c2 }) => (
    <div className="flex items-stretch">
      {img && <div className="w-[2.6em] shrink-0 overflow-hidden"><Photo src={img} c1={c1} c2={c2} /></div>}
      <div className="min-w-0 flex-1 bg-inset/90">
        <P className="px-[0.6em] py-[0.2em] text-[0.7em] font-bold uppercase tracking-widest" style={{ background: c1 }}>{[t.kicker, t.time].filter(Boolean).join(" · ")}</P>
        <P i={1} className="truncate px-[0.6em] py-[0.3em] font-semibold">{t.title}</P>
      </div>
    </div>
  ),
};

/**
 * A branded broadcast card (Up next). Scales with the frame width (container units), so the
 * website, the 1920×1080 output page and every preview look identical.
 */
export function BrandCard({ config, text, phase, size }: { config: OverlayConfig; text: CardText; phase: CardPhase; size?: number | undefined }) {
  const uid = useId().replace(/:/g, "");
  const d = designById(config.design);
  const c1 = config.color ?? d.c1;
  const c2 = config.color2 ?? d.c2;
  const ms = Math.min(3000, Math.max(150, Number(config.transition_ms) || 700));
  const w = size ?? config.size ?? 40;
  const Design = DESIGNS[d.id] ?? DESIGNS["classic"]!;
  return (
    <div
      className="mmx-card relative text-graphic-ink"
      data-phase={phase}
      style={{ width: `${w}cqw`, fontSize: `${w * 0.055}cqw`, animation: transitionAnimation(phase, config.transition_in, config.transition_out, ms), ["--mmx-ms" as string]: `${ms}ms` }}
    >
      <Design t={text} img={config.image_url} c1={c1} c2={c2} uid={uid} />
    </div>
  );
}
