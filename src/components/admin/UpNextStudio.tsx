import { ImagePlus, Play, RotateCcw, Trash2 } from "lucide-react";
import { BrandCard } from "@/components/broadcast/BrandCard";
import { BRAND_DESIGNS, TEXT_TEMPLATES, TRANSITIONS, cardTextFor, designById, type CardVars } from "@/lib/brand-cards";
import type { OverlayConfig } from "@/lib/graphics";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import slate from "@/assets/standby-slate.jpg";

interface Props {
  config: OverlayConfig;
  vars: CardVars;
  onChange: (patch: OverlayConfig) => void;
  onUpload: (file: File) => void;
  onPlay: () => void;
}

function Step({ n, title, hint, children, className }: { n: number; title: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-2 rounded-sm border border-border bg-inset/40 p-3", className)}>
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold"><span className="grid size-5 place-items-center rounded-full bg-program text-[0.65rem] text-program-foreground">{n}</span>{title}</div>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

/** Branding studio for the "Up next" card: design, text, picture, colours, transitions and timing — all previewed live. */
export function UpNextStudio({ config, vars, onChange, onUpload, onPlay }: Props) {
  const d = designById(config.design);
  const text = cardTextFor(config, vars);
  const set = (patch: OverlayConfig, replay = false) => { onChange(patch); if (replay) setTimeout(onPlay, 50); };

  return (
    <section className="panel">
      <div className="panel-header">Up next · branding studio<span className="normal-case tracking-normal">changes show in the preview above · publish to put them on air</span></div>
      <div className="grid gap-3 p-3 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <Step n={1} title="Choose a design" hint="Each preview uses your own picture and text. Click one to use it.">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
            {BRAND_DESIGNS.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => set({ design: x.id, color: undefined, color2: undefined }, true)}
                className={cn("group overflow-hidden rounded-sm border text-left transition", d.id === x.id ? "border-program ring-1 ring-program" : "border-border hover:border-ring")}
              >
                <div className="relative aspect-video overflow-hidden bg-inset" style={{ containerType: "inline-size" }}>
                  <img src={slate} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />
                  <div className="absolute bottom-[10%] left-[5%]">
                    <BrandCard config={{ ...config, design: x.id, color: undefined, color2: undefined, transition_in: "none" }} text={text} phase="hold" size={72} />
                  </div>
                </div>
                <div className="flex items-center justify-between px-2 py-1 text-xs">
                  <span className="font-medium">{x.name}</span>
                  {x.photo && <span className="text-[0.65rem] text-muted-foreground">best with picture</span>}
                </div>
              </button>
            ))}
          </div>
        </Step>

        <div className="space-y-3">
          <Step n={2} title="Text" hint="Pick a ready-made wording, then edit. {title}, {time} and {day} fill in by themselves from the schedule.">
            <div className="flex flex-wrap gap-1.5">
              {TEXT_TEMPLATES.map((tpl) => {
                const sample = cardTextFor({ ...config, kicker: tpl.kicker, subtitle: tpl.subtitle, time_text: tpl.time }, vars);
                const on = (config.kicker ?? "UP NEXT") === tpl.kicker && (config.subtitle ?? "") === tpl.subtitle && (config.time_text ?? "{time}") === tpl.time;
                return (
                  <button key={tpl.id} type="button" onClick={() => set({ kicker: tpl.kicker, subtitle: tpl.subtitle, time_text: tpl.time })} className={cn("rounded-sm border px-2 py-1 text-left text-xs", on ? "border-program bg-program/15" : "border-border hover:bg-accent")}>
                    <div className="font-semibold">{sample.kicker || tpl.name}</div>
                    <div className="text-[0.65rem] text-muted-foreground">{[sample.time, sample.subtitle].filter(Boolean).join(" · ") || "name only"}</div>
                  </button>
                );
              })}
            </div>
            <label className="block space-y-1"><span className="label-caps">Label</span><input className="field" value={config.kicker ?? "UP NEXT"} maxLength={40} onChange={(e) => set({ kicker: e.target.value })} /></label>
            <label className="block space-y-1"><span className="label-caps">Programme name</span><input className="field" value={config.title ?? ""} maxLength={80} placeholder={`Automatic: ${vars.title || "next programme"}`} onChange={(e) => set({ title: e.target.value })} /></label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1"><span className="label-caps">Time</span><input className="field" value={config.time_text ?? "{time}"} maxLength={30} onChange={(e) => set({ time_text: e.target.value })} /></label>
              <label className="block space-y-1"><span className="label-caps">Extra line</span><input className="field" value={config.subtitle ?? ""} maxLength={60} placeholder="e.g. Episode 5" onChange={(e) => set({ subtitle: e.target.value })} /></label>
            </div>
          </Step>

          <Step n={3} title="Picture" hint="A programme photo or cast cut-out. A PNG with a see-through background looks best on Showcase.">
            <div className="flex items-center gap-2">
              {config.image_url ? <img src={config.image_url} alt="Programme picture" className="h-14 w-24 rounded-sm border border-border object-cover" /> : <div className="grid h-14 w-24 place-items-center rounded-sm border border-dashed border-border text-[0.65rem] text-muted-foreground">No picture</div>}
              <label className="flex h-8 flex-1 cursor-pointer items-center justify-center gap-2 rounded-sm border border-dashed border-border text-xs hover:bg-accent">
                <ImagePlus className="size-3.5" />{config.image_url ? "Change picture" : "Upload picture"}
                <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }} />
              </label>
              {config.image_url && <Button type="button" size="xs" variant="panel" onClick={() => set({ image_url: undefined })} aria-label="Remove picture"><Trash2 className="size-3.5" /></Button>}
            </div>
          </Step>

          <Step n={4} title="Colours">
            <div className="flex items-end gap-2">
              <label className="flex-1 space-y-1"><span className="label-caps">Main</span><input type="color" className="h-8 w-full rounded-sm border border-input bg-inset" value={config.color ?? d.c1} onChange={(e) => set({ color: e.target.value })} /></label>
              <label className="flex-1 space-y-1"><span className="label-caps">Highlight</span><input type="color" className="h-8 w-full rounded-sm border border-input bg-inset" value={config.color2 ?? d.c2} onChange={(e) => set({ color2: e.target.value })} /></label>
              <Button type="button" size="xs" variant="panel" onClick={() => set({ color: undefined, color2: undefined })}><RotateCcw className="size-3.5" />Design colours</Button>
            </div>
          </Step>

          <Step n={5} title="Transition" hint="How the card appears and disappears. Changing one plays it in the preview.">
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1"><span className="label-caps">Appear</span><select className="field" value={config.transition_in ?? "slide-left"} onChange={(e) => set({ transition_in: e.target.value }, true)}>{TRANSITIONS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
              <label className="block space-y-1"><span className="label-caps">Disappear</span><select className="field" value={config.transition_out ?? "fade"} onChange={(e) => set({ transition_out: e.target.value }, true)}>{TRANSITIONS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
            </div>
            <label className="block space-y-1"><span className="label-caps">Speed · {((config.transition_ms ?? 700) / 1000).toFixed(1)} s</span><input type="range" min={200} max={2500} step={100} value={config.transition_ms ?? 700} onChange={(e) => set({ transition_ms: +e.target.value })} onPointerUp={onPlay} className="w-full accent-program" /></label>
            <Button type="button" size="xs" variant="brand" onClick={onPlay}><Play className="size-3.5" />Play transition in preview</Button>
          </Step>

          <Step n={6} title="When it shows">
            <div className="space-y-1.5 text-sm">
              <label className="flex items-start gap-2"><input type="radio" className="mt-1 accent-program" checked={(config.show_mode ?? "cycle") === "cycle"} onChange={() => set({ show_mode: "cycle" })} /><span>After a programme starts, then every 10 minutes <span className="block text-xs text-muted-foreground">Right after the "Now showing" graphic.</span></span></label>
              <label className="flex items-start gap-2"><input type="radio" className="mt-1 accent-program" checked={config.show_mode === "before_next"} onChange={() => set({ show_mode: "before_next" })} /><span>Before the next programme starts <span className="block text-xs text-muted-foreground">Like TV: a promo near the end of the current show.</span></span></label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {config.show_mode === "before_next" && <label className="block space-y-1"><span className="label-caps">Start (seconds before)</span><input type="number" min={5} max={3600} className="field" value={config.lead ?? 120} onChange={(e) => set({ lead: Math.max(5, +e.target.value) })} /></label>}
              <label className="block space-y-1"><span className="label-caps">On screen for (s, 0 = until next)</span><input type="number" min={0} max={3600} className="field" value={config.duration ?? 10} onChange={(e) => set({ duration: Math.max(0, +e.target.value) })} /></label>
            </div>
          </Step>
        </div>
      </div>
    </section>
  );
}
