import { Step } from "@/components/admin/UpNextStudio";
import { timingMode, type OverlayConfig, type OverlayKind, type TimingMode } from "@/lib/graphics";

interface Option { mode: TimingMode; label: string; note?: string }

/** "When it shows" — the same three operator choices for every graphic, plus schedule-based ones where they make sense. */
export function TimingStep({ n, kind, config, set, defaultSeconds = 15 }: { n: number; kind: OverlayKind; config: OverlayConfig; set: (patch: OverlayConfig) => void; defaultSeconds?: number }) {
  const mode = timingMode({ kind, config });
  const options: Option[] = [
    { mode: "always", label: "Stays on screen until I take it off" },
    { mode: "once", label: "Once, for a set time" },
    { mode: "repeat", label: "Again and again, on a timer" },
  ];
  if (kind === "now_showing" || kind === "programme_title") options.push({ mode: "cycle", label: "When each programme starts, then every 10 minutes", note: "Follows the schedule." });
  if (kind === "next_programme") {
    options.push({ mode: "cycle", label: "After a programme starts, then every 10 minutes", note: 'Right after the "Now showing" graphic.' });
    options.push({ mode: "before_next", label: "Before the next programme starts", note: "Like TV: a promo near the end of the current show." });
  }
  const seconds = Number(config.duration) || defaultSeconds;
  const pick = (m: TimingMode) => set(m === "always" ? { show_mode: "always", duration: 0 } : { show_mode: m, duration: m === "before_next" ? Number(config.duration) || 0 : seconds });
  const fromSchedule = mode === "cycle" || mode === "before_next";
  const needsProgramme = kind === "on_air" || kind === "live_indicator" || kind === "now_showing" || kind === "programme_title";

  return (
    <Step n={n} title="When it shows" hint={fromSchedule ? "Follows the published schedule." : "Timing starts when you press Show now (or Publish after changing it)."}>
      <div className="space-y-1.5 text-sm">
        {options.map((o) => (
          <label key={o.mode} className="flex items-start gap-2">
            <input type="radio" name={`timing-${kind}`} className="mt-1 accent-program" checked={mode === o.mode} onChange={() => pick(o.mode)} />
            <span>{o.label}{o.note && <span className="block text-xs text-muted-foreground">{o.note}</span>}</span>
          </label>
        ))}
      </div>
      {mode !== "always" && (
        <div className="grid grid-cols-2 gap-2">
          {mode === "before_next" && <label className="block space-y-1"><span className="label-caps">Start (seconds before)</span><input type="number" min={5} max={3600} className="field" value={config.lead ?? 120} onChange={(e) => set({ lead: Math.max(5, +e.target.value) })} /></label>}
          {mode === "before_next"
            ? <label className="block space-y-1"><span className="label-caps">On screen for (s, 0 = until it starts)</span><input type="number" min={0} max={3600} className="field" value={config.duration ?? 0} onChange={(e) => set({ duration: Math.max(0, +e.target.value) })} /></label>
            : <label className="block space-y-1"><span className="label-caps">On screen for (seconds)</span><input type="number" min={3} max={mode === "cycle" ? 590 : 3600} className="field" value={seconds} onChange={(e) => set({ duration: Math.min(mode === "cycle" ? 590 : 3600, Math.max(3, +e.target.value)) })} /></label>}
          {mode === "repeat" && <label className="block space-y-1"><span className="label-caps">Repeat every (minutes)</span><input type="number" min={1} max={240} className="field" value={config.every ?? 10} onChange={(e) => set({ every: Math.max(1, +e.target.value) })} /></label>}
        </div>
      )}
      {needsProgramme && <p className="text-[0.65rem] text-muted-foreground">Appears only while a programme is playing.</p>}
    </Step>
  );
}
