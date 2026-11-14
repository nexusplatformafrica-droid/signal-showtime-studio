import { cn } from "@/lib/utils";

/** MOVIE MAX logo + name. `compact` shows the logo only (collapsed admin sidebar). */
export function Wordmark({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("wordmark inline-flex items-center gap-2 select-none", className)} aria-label="MOVIE MAX">
      <img src="/moviemax-logo.png" alt="" width={102} height={102} className="h-[1.7em] w-[1.7em] shrink-0 object-contain" draggable={false} />
      {!compact && <span className="whitespace-nowrap">MOVIE MAX</span>}
    </span>
  );
}
