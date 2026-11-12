import { cn } from "@/lib/utils";

export function Tally({ tone, pulse, className }: { tone: "program" | "preview" | "warn" | "off" | "info"; pulse?: boolean; className?: string }) {
  const color = { program: "bg-program", preview: "bg-preview", warn: "bg-warn", off: "bg-muted-foreground/40", info: "bg-info" }[tone];
  return <span className={cn("inline-block size-2 shrink-0 rounded-full", color, pulse && "animate-tally", className)} aria-hidden />;
}

/** ON AIR = the playout engine confirms it is broadcasting. LIVE = the website is playing the schedule itself. */
export function OnAirBadge({ onAir, engineOnline, webLive = false, size = "sm" }: { onAir: boolean; engineOnline: boolean; webLive?: boolean; size?: "sm" | "lg" }) {
  const base = size === "lg" ? "h-7 px-3 text-xs" : "h-5 px-2 text-[10px]";
  if (onAir || webLive)
    return (
      <span className={cn("inline-flex items-center gap-1.5 rounded-sm bg-program font-bold uppercase tracking-[0.14em] text-program-foreground", base)}>
        <span className="size-1.5 rounded-full bg-program-foreground animate-tally" /> {onAir ? "On Air" : "Live"}
      </span>
    );
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-sm border border-border bg-inset font-bold uppercase tracking-[0.14em] text-muted-foreground", base)}>
      <span className="size-1.5 rounded-full bg-muted-foreground/50" /> {engineOnline ? "Off Air" : "No Signal"}
    </span>
  );
}

export function StatusChip({ tone, children, className }: { tone: "program" | "preview" | "warn" | "off" | "info"; children: React.ReactNode; className?: string }) {
  const map = {
    program: "border-program/40 text-program bg-program/10",
    preview: "border-preview/40 text-preview bg-preview/10",
    warn: "border-warn/40 text-warn bg-warn/10",
    info: "border-info/40 text-info bg-info/10",
    off: "border-border text-muted-foreground bg-inset",
  }[tone];
  return <span className={cn("inline-flex h-5 items-center gap-1 rounded-sm border px-1.5 text-[10px] font-semibold uppercase tracking-wider", map, className)}>{children}</span>;
}

export function Metric({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode | undefined; tone?: "program" | "preview" | "warn" | undefined }) {
  return (
    <div className="min-w-0 px-3 py-2">
      <div className="label-caps truncate">{label}</div>
      <div className={cn("timecode mt-0.5 truncate text-[15px] font-semibold", tone === "program" && "text-program", tone === "preview" && "text-preview", tone === "warn" && "text-warn")}>{value}</div>
      {sub && <div className="truncate text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
