import type { CSSProperties, ReactNode } from "react";
import { Calendar, Gift, Globe, Heart, Home, Info, Mail, Megaphone, MessageSquare, Mic, Music, Phone, Rss, ShoppingCart, Star, Trophy, Tv, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** One piece of card text that arrives just after the card (staggered by `i`). */
export function P({ i = 0, className, style, children }: { i?: number; className?: string | undefined; style?: CSSProperties | undefined; children: ReactNode }) {
  return <div className={cn("mmx-part", className)} style={{ ["--i" as string]: i, ...style }}>{children}</div>;
}

export const dark = (c: string, pct = 60) => `color-mix(in oklab, ${c} ${pct}%, black)`;
export const light = (c: string, pct = 55) => `color-mix(in oklab, ${c} ${pct}%, white)`;
export const slantBoth = "polygon(0.55em 0, 100% 0, calc(100% - 0.55em) 100%, 0 100%)";
export const slantR = "polygon(0 0, 100% 0, calc(100% - 0.55em) 100%, 0 100%)";
export const slantL = "polygon(0.55em 0, 100% 0, 100% 100%, 0 100%)";

export const SPARKLE: CSSProperties = {
  backgroundImage: [
    "radial-gradient(circle at 12% 35%, var(--graphic-ink) 0 0.05em, transparent 0.09em)",
    "radial-gradient(circle at 31% 72%, var(--graphic-ink) 0 0.04em, transparent 0.08em)",
    "radial-gradient(circle at 58% 22%, var(--graphic-ink) 0 0.05em, transparent 0.09em)",
    "radial-gradient(circle at 77% 64%, var(--graphic-ink) 0 0.04em, transparent 0.08em)",
    "radial-gradient(circle at 92% 30%, var(--graphic-ink) 0 0.05em, transparent 0.1em)",
  ].join(","),
  opacity: 0.55,
};

/** Split "TV\nNEWS" (typed or real line breaks) into lines. */
export const badgeLines = (s: string) => s.split(/\\n|\n/).map((l) => l.trim()).filter(Boolean);

/** Logo box: an uploaded image, or one/two lines of text with the first line larger. */
export function BadgeBox({ text, img, className, style, firstClass = "text-[1.3em]", restClass = "text-[0.62em]" }: { text: string; img?: string | undefined; className?: string; style?: CSSProperties; firstClass?: string; restClass?: string }) {
  const lines = badgeLines(text);
  return (
    <div className={cn("flex shrink-0 flex-col items-center justify-center overflow-hidden text-center font-black uppercase leading-[0.95]", className)} style={style}>
      {img ? <img src={img} alt="" className="max-h-[82%] max-w-[86%] object-contain" /> : lines.map((l, i) => (
        <P key={i} i={i} className={lines.length > 1 ? (i === 0 ? firstClass : restClass) : ""}>{l}</P>
      ))}
    </div>
  );
}

/** Long one-line text shrinks to fit. */
export function fitScale(len: number) {
  return len <= 26 ? 1 : len <= 34 ? 0.86 : len <= 44 ? 0.74 : len <= 56 ? 0.63 : 0.55;
}

export function FitLine({ text, k, i = 1, className, style }: { text: string; k?: number; i?: number; className?: string; style?: CSSProperties }) {
  return (
    <div className={cn("min-w-0 max-w-full", className)} style={style}>
      <P key={k ?? 0} i={i} className="truncate" style={{ fontSize: `${fitScale(text.length)}em` }}>{text}</P>
    </div>
  );
}

/** Right-to-left crawl for rolling text. */
export function Crawl({ text, seconds, className, style }: { text: string; seconds: number; className?: string; style?: CSSProperties }) {
  return (
    <div className={cn("relative min-w-0 flex-1 self-stretch overflow-hidden whitespace-nowrap", className)} style={style}>
      <div className="absolute inset-0 flex items-center">
        <span className="animate-crawl inline-block" style={{ ["--ticker-duration" as string]: `${seconds}s` }}>{text}</span>
      </div>
    </div>
  );
}

export const ICONS: Record<string, LucideIcon> = {
  users: Users, mail: Mail, star: Star, phone: Phone, message: MessageSquare, home: Home, rss: Rss, cart: ShoppingCart,
  globe: Globe, heart: Heart, info: Info, calendar: Calendar, trophy: Trophy, megaphone: Megaphone, mic: Mic, tv: Tv, music: Music, gift: Gift,
};

export function CardIcon({ name, className, style }: { name?: string | undefined; className?: string; style?: CSSProperties }) {
  const I = name ? ICONS[name] : undefined;
  return I ? <I className={className} style={style} strokeWidth={2.2} /> : null;
}
