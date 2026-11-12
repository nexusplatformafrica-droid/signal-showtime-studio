import type { ReactNode } from "react";
import { transitionAnimation, type CardPhase } from "@/lib/brand-cards";
import { POPUP_DESIGNS, designIn, type KitText } from "@/lib/card-kits";
import type { OverlayConfig } from "@/lib/graphics";
import { BadgeBox, CardIcon, P, dark, light } from "@/components/broadcast/card-parts";
import { cn } from "@/lib/utils";

interface DP { t: KitText; img?: string | undefined; icon?: string | undefined; c1: string; c2: string }

const Body = ({ t, className, color }: { t: KitText; className?: string; color?: string }) => (
  <div className={cn("min-w-0", className)}>
    <P className="text-[0.55em] font-black uppercase tracking-wide" style={color ? { color } : undefined}>{t.kicker}</P>
    <P key={t.index} i={1} className="line-clamp-2 text-[0.5em] font-medium leading-snug opacity-80">{t.line}</P>
    {t.subtitle && <P i={2} className="text-[0.4em] font-bold uppercase tracking-[0.2em] opacity-70">{t.subtitle}</P>}
  </div>
);

const Pic = ({ img, icon, className, style }: { img?: string | undefined; icon?: string | undefined; className?: string; style?: React.CSSProperties }) =>
  img ? <img src={img} alt="" className={cn("object-contain", className)} style={style} /> : <CardIcon name={icon} className={className} style={style} />;

function Diamond({ t, img, icon, c1, c2, pop }: DP & { pop?: boolean }) {
  return (
    <div className="relative h-[3.2em] pl-[1.4em]">
      {pop && [["8%", "-4%", "#facc15"], ["40%", "-10%", "#facc15"], ["86%", "8%", c1], ["12%", "92%", light(c2, 40)], ["70%", "96%", "#facc15"]].map(([l, tp, col], i) => (
        <span key={i} className="absolute size-[0.35em]" style={{ left: l, top: tp, background: col, clipPath: i % 2 ? "circle(50%)" : "polygon(50% 0, 100% 100%, 0 100%)" }} />
      ))}
      <div className="absolute left-[2.4em] top-[0.15em] flex h-[0.95em] w-[50%] items-center rounded-tr-full pl-[1.4em] pr-[0.6em]" style={{ background: pop ? c1 : dark(c2, 85), clipPath: pop ? "polygon(0 0, calc(100% - 0.4em) 0, 100% 50%, calc(100% - 0.4em) 100%, 0 100%)" : undefined }}>
        <P className="truncate text-[0.45em] font-black uppercase tracking-[0.15em]">{t.kicker}</P>
      </div>
      <div className={cn("absolute bottom-[0.25em] left-[1.6em] right-0 flex h-[1.85em] items-center pl-[1.8em] pr-[1.2em] shadow-lg", pop ? "rounded-r-full" : "rounded-[0.3em]")} style={{ background: pop ? c2 : "var(--graphic-paper)", clipPath: pop ? undefined : "polygon(0 0, calc(100% - 0.6em) 0, 100% 100%, 0 100%)" }}>
        <P key={t.index} i={1} className="line-clamp-2 text-[0.6em] font-bold leading-tight text-graphic-night">{t.line}</P>
      </div>
      {pop && t.subtitle && <div className="absolute -bottom-[0.55em] left-[3em] flex h-[0.8em] items-center rounded-b-[0.3em] px-[1em]" style={{ background: c1 }}><P i={2} className="text-[0.38em] font-bold uppercase tracking-[0.2em]">{t.subtitle}</P></div>}
      <div className="absolute left-0 top-1/2 z-10 grid size-[2.5em] -translate-y-1/2 rotate-45 place-items-center rounded-[0.55em] shadow-lg" style={{ background: pop ? c1 : `linear-gradient(180deg, ${light(c1, 75)}, ${dark(c1, 80)})` }}>
        <div className="-rotate-45">{t.badge && !img ? <BadgeBox text={t.badge} className="text-[0.55em]" /> : <Pic img={img} icon={icon} className="size-[1.2em]" />}</div>
      </div>
    </div>
  );
}

function Step3D({ t, img, icon, c1, c2, right }: DP & { right?: boolean }) {
  return (
    <div className="relative h-[3.4em]">
      <div className={cn("absolute bottom-0 flex h-[2.5em] w-[64%] items-center rounded-[0.5em] px-[0.6em]", right ? "right-0 justify-end" : "left-0")} style={{ background: c1, boxShadow: `inset 0 -0.35em 0 ${c2}, 0 0.3em 0.8em rgb(0 0 0 / 0.35)` }}>
        <BadgeBox text={t.badge || "01\nSTEP"} img={img} firstClass="text-[1.9em]" restClass="text-[0.55em]" className="w-[30%] text-[0.8em]" />
      </div>
      <div className={cn("absolute top-0 flex h-[2.35em] w-[72%] items-center gap-[0.5em] rounded-[0.5em] bg-graphic-paper px-[0.7em] text-graphic-night shadow-lg", right ? "left-0" : "right-0")} style={{ clipPath: right ? "polygon(0 0, 100% 0, calc(100% - 1em) 100%, 0 100%)" : "polygon(1em 0, 100% 0, 100% 100%, 0 100%)" }}>
        <div className={cn("flex h-[80%] w-full items-center gap-[0.5em] rounded-[0.35em] border-[0.06em] border-dashed border-graphic-night/30 px-[0.6em]", right && "flex-row-reverse pl-[0.3em]", !right && "pl-[1em]")}>
          <CardIcon name={icon} className="size-[0.9em] shrink-0" style={{ color: c1 }} />
          <span className="h-[70%] w-[0.05em] shrink-0 bg-graphic-night/25" />
          <Body t={t} color={c1} className="flex-1" />
        </div>
      </div>
    </div>
  );
}

const DESIGNS: Record<string, (p: DP) => ReactNode> = {
  "step-left": ({ t, img, icon, c1 }) => (
    <div className="relative flex h-[2.8em] items-stretch overflow-hidden rounded-[0.7em] bg-graphic-paper text-graphic-night shadow-lg">
      <div className="absolute inset-y-0 left-0 w-[34%]" style={{ background: c1, clipPath: "polygon(0 0, 72% 0, 100% 82%, 100% 100%, 0 100%)" }} />
      <span className="absolute bottom-0 left-0 right-[2%] h-[0.16em]" style={{ background: c1 }} />
      <BadgeBox text={t.badge || "STEP\n01"} img={img} firstClass="text-[0.6em]" restClass="text-[1.6em]" className="relative w-[24%] text-[0.9em] text-graphic-ink" />
      <div className="relative ml-[10%] flex min-w-0 flex-1 items-center gap-[0.6em] pr-[0.8em]">
        <CardIcon name={icon} className="size-[1.1em] shrink-0 opacity-70" />
        <Body t={t} className="flex-1" />
      </div>
    </div>
  ),
  "step-3d": (p) => <Step3D {...p} />,
  "step-3d-right": (p) => <Step3D {...p} right />,
  "diamond-dark": (p) => <Diamond {...p} />,
  "diamond-blue": (p) => <Diamond {...p} />,
  "diamond-pop": (p) => <Diamond {...p} pop />,
  "pill-icon": ({ t, img, icon, c1, c2 }) => (
    <div className="flex h-[2.4em] items-center gap-[0.6em] rounded-full bg-graphic-paper pl-[0.3em] pr-[1.2em] text-graphic-night shadow-lg">
      <div className="grid size-[1.9em] shrink-0 place-items-center rounded-full text-graphic-ink" style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}><Pic img={img} icon={icon} className="size-[1em]" /></div>
      <Body t={t} color={c1} className="flex-1" />
      <span className="h-[1.4em] w-[0.18em] shrink-0 rounded-full" style={{ background: c2 }} />
    </div>
  ),
  promo: ({ t, img, icon, c1, c2 }) => (
    <div className="relative pt-[0.6em]">
      <div className="absolute left-[0.6em] top-0 z-10 -rotate-3 rounded-[0.2em] px-[0.7em] py-[0.08em] text-graphic-night shadow-md" style={{ background: c2 }}><P className="text-[0.5em] font-black uppercase">{t.kicker}</P></div>
      <div className="flex min-h-[2.4em] items-center gap-[0.6em] rounded-[0.5em] px-[0.8em] pt-[0.4em] shadow-lg" style={{ background: `linear-gradient(120deg, ${c1}, ${dark(c1, 70)})` }}>
        <Pic img={img} icon={icon} className="size-[1.3em] shrink-0" style={{ color: c2 }} />
        <div className="min-w-0 py-[0.3em]">
          <P key={t.index} i={1} className="mmx-italic line-clamp-2 text-[0.85em] uppercase">{t.line}</P>
          {t.subtitle && <P i={2} className="text-[0.42em] font-bold uppercase tracking-[0.2em]" style={{ color: c2 }}>{t.subtitle}</P>}
        </div>
      </div>
    </div>
  ),
  social: ({ t, img, icon, c1, c2 }) => (
    <div className="flex h-[2.3em] items-center gap-[0.6em] rounded-[0.5em] bg-graphic-black/80 px-[0.5em] pr-[1em] shadow-lg backdrop-blur-sm">
      <div className="grid size-[1.7em] shrink-0 place-items-center rounded-[0.45em]" style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}><Pic img={img} icon={icon} className="size-[0.95em]" /></div>
      <div className="min-w-0">
        <P className="text-[0.4em] font-bold uppercase tracking-[0.3em] opacity-75">{t.kicker}</P>
        <P key={t.index} i={1} className="truncate text-[0.75em] font-black">{t.line}</P>
        {t.subtitle && <P i={2} className="text-[0.38em] opacity-75">{t.subtitle}</P>}
      </div>
    </div>
  ),
  call: ({ t, img, icon, c1, c2 }) => (
    <div className="flex h-[2.5em] items-center gap-[0.6em] rounded-[0.4em] px-[0.6em] pr-[1em] shadow-lg" style={{ background: `linear-gradient(120deg, ${dark(c1, 80)}, ${c1})` }}>
      <div className="grid size-[1.8em] shrink-0 place-items-center rounded-full text-graphic-night" style={{ background: c2 }}><Pic img={img} icon={icon} className="size-[1em]" /></div>
      <div className="min-w-0">
        <P className="text-[0.45em] font-black uppercase tracking-[0.2em]" style={{ color: c2 }}>{t.kicker}</P>
        <P key={t.index} i={1} className="truncate text-[0.9em] font-black tabular-nums">{t.line}</P>
        {t.subtitle && <P i={2} className="text-[0.38em] uppercase tracking-[0.2em] opacity-85">{t.subtitle}</P>}
      </div>
    </div>
  ),
};

/** Pop-up card the operator can put on air at any moment ("Show now"). */
export function PopupCard({ config, text, phase, size }: { config: OverlayConfig; text: KitText; phase: CardPhase; size?: number | undefined }) {
  const d = designIn(POPUP_DESIGNS, config.design);
  const c1 = config.color ?? d.c1;
  const c2 = config.color2 ?? d.c2;
  const ms = Math.min(3000, Math.max(150, Number(config.transition_ms) || 700));
  const w = size ?? config.size ?? 44;
  const Design = DESIGNS[d.id] ?? DESIGNS["step-left"]!;
  return (
    <div
      className="mmx-card relative text-graphic-ink"
      data-phase={phase}
      style={{ width: `${w}cqw`, fontSize: `${w * 0.06}cqw`, animation: transitionAnimation(phase, config.transition_in ?? "pop", config.transition_out ?? "zoom", ms), ["--mmx-ms" as string]: `${ms}ms` }}
    >
      <Design t={text} img={config.image_url} icon={config.icon === "none" ? undefined : (config.icon ?? "users")} c1={c1} c2={c2} />
    </div>
  );
}
