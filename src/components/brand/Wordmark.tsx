import { cn } from "@/lib/utils";

export function Wordmark({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("wordmark inline-flex items-center gap-1.5 select-none", className)} aria-label="MOVIE MAX">
      <span className="inline-flex h-[1.15em] items-center rounded-[2px] bg-brand px-[0.28em] text-brand-foreground">{compact ? "M" : "MOVIE"}</span>
      {!compact && <span>MAX</span>}
    </span>
  );
}
