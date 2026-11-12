import type { CSSProperties, ReactNode } from "react";
import { transitionAnimation, type CardPhase } from "@/lib/brand-cards";
import { BREAKING_DESIGNS, designIn, type KitText } from "@/lib/card-kits";
import type { OverlayConfig } from "@/lib/graphics";
import { BadgeBox, FitLine, P, dark, light, slantBoth, slantR } from "@/components/broadcast/card-parts";
import { cn } from "@/lib/utils";

interface DP { t: KitText; img?: string | undefined; c1: string; c2: string }

const Tag = ({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) => (
  <div className={cn("w-fit whitespace-nowrap px-[0.8em] py-[0.08em] font-black uppercase", className)} style={style}><P>{children}</P></div>
);
/** The big "BREAKING NEWS" words. */
const Big = ({ t, className, style }: { t: KitText; className?: string; style?: CSSProperties }) => <FitLine text={t.kicker} i={0} className={cn("font-black uppercase leading-tight", className)} style={style} />;
/** The rotating headline line. */
const Line = ({ t, className, style }: { t: KitText; className?: string; style?: CSSProperties }) => <FitLine text={t.line} k={t.index} i={2} className={cn("font-bold uppercase", className)} style={style} />;
const withTime = (t: KitText, s: string) => [t.time, s].filter(Boolean).join("  |  ");

type Shape = "square" | "circle" | "tab";
interface DayOpts { shape: Shape; end: "flat" | "round" | "slant"; tagTop?: boolean; timeUnderBadge?: boolean; badgeWhite?: boolean; strip2?: boolean }

/** White headline bar with a coloured date/news box — the "22 NEWS" family. */
function DayBar({ t, img, c1, c2, o }: DP & { o: DayOpts }) {
  const badge = t.badge || (o.shape === "tab" ? "NEWS" : `${t.day}\nNEWS`);
  const endClip = o.end === "slant" ? slantR : undefined;
  const badgeStyle: CSSProperties = o.badgeWhite ? { color: c1, boxShadow: `inset 0 0 0 0.12em ${c1}` } : { background: `linear-gradient(160deg, ${light(c1, 80)}, ${c1})` };
  return (
    <div className="relative drop-shadow-lg">
      {o.tagTop && <Tag className="mb-[0.1em] rounded-t-[0.2em] text-[0.38em] tracking-[0.25em]" style={{ background: c1 }}>{t.tag}</Tag>}
      <div className="flex items-stretch">
        <div className="relative z-10 flex shrink-0 flex-col">
          <BadgeBox
            text={badge}
            img={img}
            firstClass="text-[1.45em]"
            className={cn("text-[0.75em]", o.shape === "circle" ? "size-[3.1em] rounded-full" : o.shape === "tab" ? "h-[1.7em] w-[4.2em] rounded-tl-[0.3em]" : "h-[3.1em] w-[3.4em] rounded-l-[0.25em]", o.badgeWhite && "bg-graphic-paper")}
            style={badgeStyle}
          />
          {o.timeUnderBadge && t.time && <div className="flex h-[1.1em] items-center justify-center rounded-bl-[0.25em] bg-graphic-paper px-[0.3em] text-[0.6em] font-black tabular-nums text-graphic-night">{t.time}</div>}
        </div>
        <div className={cn("flex min-w-0 flex-1 flex-col justify-center", o.shape === "circle" && "-ml-[1.2em]")}>
          <div className={cn("flex h-[1.45em] items-center bg-graphic-paper px-[0.8em] text-graphic-night", o.shape === "circle" && "pl-[1.8em]", o.end === "round" && "rounded-r-full")} style={{ clipPath: endClip }}>
            <Big t={t} className="text-[0.9em]" />
          </div>
          <div className={cn("flex h-[1em] items-center gap-[0.5em] pl-[0.8em]", o.shape === "circle" && "pl-[1.8em]", o.end === "round" && "mr-[6%] rounded-br-[0.6em]")} style={{ background: o.strip2 ? `linear-gradient(90deg, ${c2}, ${c1})` : `linear-gradient(90deg, ${dark(c1, 85)}, ${c1})` }}>
            <Line t={t} className="flex-1 text-[0.45em] normal-case" />
            {!o.timeUnderBadge && t.time && <div className="flex h-full shrink-0 items-center bg-graphic-black px-[0.6em] text-[0.55em] font-black tabular-nums">{t.time}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

const DESIGNS: Record<string, (p: DP) => ReactNode> = {
  "by-top-tag": ({ t, c1, c2 }) => (
    <div className="flex flex-col items-center drop-shadow-lg">
      <Tag className="rounded-t-[0.2em] text-[0.42em] text-graphic-night" style={{ background: c2 }}>{t.tag}</Tag>
      <div className="flex h-[1.9em] w-full items-center justify-center px-[1.2em]" style={{ background: `linear-gradient(90deg, ${c1}, ${light(c1, 80)}, ${c1})`, clipPath: slantBoth }}><Big t={t} className="text-[1.05em]" /></div>
      <div className="flex h-[1em] w-[62%] items-center justify-center px-[0.8em] text-graphic-night" style={{ background: c2, clipPath: "polygon(0 0, 100% 0, calc(100% - 0.4em) 100%, 0.4em 100%)" }}><Line t={t} className="text-[0.45em]" /></div>
    </div>
  ),
  "by-hd-box": ({ t, img, c1, c2 }) => (
    <div className="flex items-stretch drop-shadow-lg">
      <BadgeBox text={t.badge || "HD\nLIVE TV"} img={img} firstClass="text-[1.6em]" className="w-[18%] rounded-[0.15em] text-[0.7em] text-graphic-night" style={{ background: c2 }} />
      <div className="ml-[0.2em] flex min-w-0 flex-1 flex-col">
        <div className="flex h-[0.9em] items-center px-[0.6em] text-[0.42em] font-bold uppercase" style={{ color: light(c1, 70) }}>{withTime(t, t.line)}</div>
        <div className="flex h-[1.6em] items-center rounded-r-full px-[0.6em]" style={{ background: c1 }}><Big t={t} className="text-[0.95em]" /></div>
        <Tag className="mt-[0.1em] rounded-br-[0.4em] text-[0.42em]" style={{ background: dark(c1, 60), color: c2 }}>{t.tag}</Tag>
      </div>
    </div>
  ),
  "by-tag-right": ({ t, c1, c2 }) => (
    <div className="drop-shadow-lg">
      <Tag className="ml-auto mr-[6%] rounded-t-[0.2em] text-[0.42em] text-graphic-night" style={{ background: c2 }}>{t.tag}</Tag>
      <div className="flex h-[1.8em] items-center px-[0.8em]" style={{ background: `linear-gradient(90deg, ${c1}, ${light(c1, 75)})`, clipPath: slantR }}><Big t={t} className="text-[1em]" /></div>
      <div className="ml-auto flex h-[1em] w-[66%] items-center px-[0.8em]" style={{ background: dark(c1, 60) }}><Line t={t} className="text-[0.45em]" style={{ color: c2 }} /></div>
    </div>
  ),
  "by-hd-circle": ({ t, img, c1, c2 }) => (
    <div className="relative pl-[1.5em] drop-shadow-lg">
      <div className="ml-[1.4em]">
        <Tag className="rounded-t-[0.2em] text-[0.4em] text-graphic-night" style={{ background: c2 }}>{t.tag}</Tag>
        <div className="flex h-[1.6em] items-center pl-[1.4em] pr-[0.8em]" style={{ background: `linear-gradient(90deg, ${light(c1, 70)}, ${light(c1, 85)})`, clipPath: slantR }}><Big t={t} className="text-[0.95em]" /></div>
        <div className="flex h-[0.95em] w-[78%] items-center pl-[1.4em]" style={{ background: light(c1, 25) }}><Line t={t} className="text-[0.42em]" style={{ color: c1 }} /></div>
      </div>
      <BadgeBox text={t.badge || "HD\nLIVE TV"} img={img} firstClass="text-[1.5em]" className="absolute left-0 top-1/2 size-[3.6em] -translate-y-1/2 rounded-full text-[0.7em] shadow-lg" style={{ background: c1, boxShadow: `0 0 0 0.15em ${light(c1, 30)}` }} />
    </div>
  ),
  "by-reporter": ({ t, c1, c2 }) => (
    <div className="relative pt-[0.4em] drop-shadow-lg">
      {t.time && <Tag className="absolute right-[3%] top-0 z-10 rounded-[0.15em] text-[0.4em] text-graphic-night" style={{ background: c2 }}>{withTime(t, t.tag)}</Tag>}
      <div className="flex h-[2.1em] flex-col justify-center px-[0.8em]" style={{ background: `linear-gradient(90deg, ${c1}, ${light(c1, 80)})`, clipPath: slantR }}>
        <Line t={t} className="text-[0.4em] opacity-90" />
        <Big t={t} className="text-[1.05em]" />
      </div>
      <Tag className="text-[0.45em]" style={{ background: light(c1, 75), color: c2 }}>{t.tag}</Tag>
    </div>
  ),
  "by-notched": ({ t, c1, c2 }) => (
    <div className="drop-shadow-lg">
      <div className="flex h-[1.8em] items-center px-[0.9em]" style={{ background: `linear-gradient(90deg, ${dark(c1, 70)}, ${c1})`, clipPath: "polygon(0.6em 0, 100% 0, calc(100% - 0.6em) 100%, 0 100%)" }}><Big t={t} className="text-[1.05em]" /></div>
      <div className="ml-[0.4em] flex h-[1em] w-[70%] items-stretch" style={{ background: c2 }}>
        <div className="flex min-w-0 flex-1 items-center px-[0.7em] text-graphic-night"><Line t={t} className="text-[0.45em]" /></div>
        <Tag className="flex items-center text-[0.42em]" style={{ background: c1 }}>{t.tag}</Tag>
      </div>
    </div>
  ),
  "by-speech": ({ t, img, c1, c2 }) => (
    <div className="drop-shadow-lg">
      <div className="flex items-stretch">
        <div className="flex h-[2em] min-w-0 flex-1 flex-col justify-center px-[0.8em]" style={{ background: `linear-gradient(90deg, ${c1}, ${light(c1, 75)})` }}>
          <P className="text-[0.4em] font-bold uppercase" style={{ color: c2 }}>{t.tag}</P>
          <Big t={t} className="text-[0.95em]" />
        </div>
        <div className="relative flex w-[27%] items-center justify-center" style={{ background: dark(c1, 55) }}>
          {img ? <img src={img} alt="" className="max-h-[80%] max-w-[85%] object-contain" /> : <P i={1} className="mmx-italic text-[1em] uppercase" style={{ color: c2 }}>{(t.badge || "NEWS").replace(/\\n|\n/g, " ")}</P>}
          <span className="absolute -bottom-[0.55em] right-[18%] size-[0.6em]" style={{ background: dark(c1, 55), clipPath: "polygon(0 0, 100% 0, 100% 100%)" }} />
        </div>
      </div>
      <div className="ml-[6%] flex h-[0.95em] w-[62%] items-center px-[0.7em] text-graphic-night" style={{ background: c2 }}><Line t={t} className="text-[0.42em]" /></div>
    </div>
  ),
  "by-rounded": ({ t, c1, c2 }) => (
    <div className="drop-shadow-lg">
      <Tag className="ml-auto mr-[8%] rounded-t-[0.2em] text-[0.42em] text-graphic-night" style={{ background: c2 }}>{t.tag}</Tag>
      <div className="flex h-[1.8em] items-center rounded-full px-[1em]" style={{ background: `linear-gradient(90deg, ${c1}, ${light(c1, 70)})` }}><Big t={t} className="text-[1em]" /></div>
      <div className="ml-[7%] flex h-[0.95em] w-[56%] items-center rounded-b-[0.4em] px-[0.8em]" style={{ background: light(c1, 70) }}><Line t={t} className="text-[0.42em]" style={{ color: c2 }} /></div>
    </div>
  ),
  "day-blue": (p) => <DayBar {...p} o={{ shape: "square", end: "flat" }} />,
  "day-green": (p) => <DayBar {...p} o={{ shape: "square", end: "flat", tagTop: true, badgeWhite: true }} />,
  "day-red": (p) => <DayBar {...p} o={{ shape: "square", end: "slant" }} />,
  "day-orange": (p) => <DayBar {...p} o={{ shape: "circle", end: "round", badgeWhite: true, strip2: true }} />,
  "day-teal": (p) => <DayBar {...p} o={{ shape: "tab", end: "flat", timeUnderBadge: true, strip2: true }} />,
  "day-purple": (p) => <DayBar {...p} o={{ shape: "tab", end: "slant", tagTop: true, timeUnderBadge: true }} />,
  "day-slant": (p) => <DayBar {...p} o={{ shape: "tab", end: "slant", strip2: true }} />,
  "day-circle": (p) => <DayBar {...p} o={{ shape: "circle", end: "round" }} />,
};

/** Breaking news banner. Scales with the frame width, like the other branded cards. */
export function BreakingCard({ config, text, phase, size }: { config: OverlayConfig; text: KitText; phase: CardPhase; size?: number | undefined }) {
  const d = designIn(BREAKING_DESIGNS, config.design);
  const c1 = config.color ?? d.c1;
  const c2 = config.color2 ?? d.c2;
  const ms = Math.min(3000, Math.max(150, Number(config.transition_ms) || 700));
  const w = size ?? Math.min(90, config.size ?? 58);
  const Design = DESIGNS[d.id] ?? DESIGNS["by-top-tag"]!;
  return (
    <div
      className="mmx-card relative text-graphic-ink"
      data-phase={phase}
      style={{ width: `${w}cqw`, fontSize: `${w * 0.045}cqw`, animation: transitionAnimation(phase, config.transition_in ?? "wipe", config.transition_out, ms), ["--mmx-ms" as string]: `${ms}ms` }}
    >
      <Design t={text} img={config.image_url} c1={c1} c2={c2} />
    </div>
  );
}
