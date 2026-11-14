import { cn } from "@/lib/utils";

export const SITE_NAME = "MOVIE MAX TV";

/**
 * MOVIE MAX TV logo + name. `compact` shows the logo only (collapsed admin sidebar).
 * `neon` paints the name in the public site's blue→purple gradient; `nameClassName` can hide it on small screens.
 */
export function Wordmark({ className, compact, neon, nameClassName }: { className?: string; compact?: boolean; neon?: boolean; nameClassName?: string }) {
  return (
    <span className={cn("wordmark inline-flex items-center gap-2 select-none", neon && "font-[Noto_Sans] [font-stretch:100%]", className)} aria-label={SITE_NAME}>
      <img src="/moviemax-logo.png" alt="" width={102} height={102} className="h-[1.7em] w-[1.7em] shrink-0 object-contain" draggable={false} />
      {!compact && <span className={cn("whitespace-nowrap", neon && "text-logo-gradient", nameClassName)}>{SITE_NAME}</span>}
    </span>
  );
}
