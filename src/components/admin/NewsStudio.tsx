import { ImagePlus, Play, RotateCcw, Trash2 } from "lucide-react";
import { NewsCard } from "@/components/broadcast/NewsCard";
import { Step } from "@/components/admin/UpNextStudio";
import { TRANSITIONS } from "@/lib/brand-cards";
import { NEWS_DESIGNS, NEWS_TEMPLATES, newsDesignById, newsHeadlines, newsTextFor } from "@/lib/news-cards";
import type { OverlayConfig } from "@/lib/graphics";
import { Button } from "@/components/ui/button";
import { useNow } from "@/hooks/use-station";
import { cn } from "@/lib/utils";
import slate from "@/assets/standby-slate.jpg";

interface Props {
  config: OverlayConfig;
  timezone: string;
  onChange: (patch: OverlayConfig) => void;
  onUpload: (file: File) => void;
  onPlay: () => void;
  enabled: boolean;
  onEnable: () => void;
}

/** Branding studio for the news lower third: design, text, logo, colours, transitions and timing, all previewed live. */
export function NewsStudio({ config, timezone, onChange, onUpload, onPlay, enabled, onEnable }: Props) {
  const now = useNow(1000) ?? 0;
  const d = newsDesignById(config.design);
  const text = newsTextFor(config, now, timezone);
  const headlines = newsHeadlines(config.title);
  const set = (patch: OverlayConfig, replay = false) => { onChange(patch); if (replay) setTimeout(onPlay, 50); };
  const mode = (Number(config.duration) || 0) === 0 ? "always" : config.show_mode === "repeat" ? "repeat" : "once";

  return (
    <section className="panel">
      <div className="panel-header">News · branding studio<span className="normal-case tracking-normal">changes show in the preview above · publish to put them on air</span></div>
      {!enabled && (
        <div className="flex items-center justify-between gap-2 border-b border-border bg-warn/10 px-3 py-2 text-xs">
          <span>The news lower third is switched off, so it isn't in the preview or on air.</span>
          <Button type="button" size="xs" variant="panel" onClick={onEnable}>Switch on</Button>
        </div>
      )}
      <div className="grid gap-3 p-3 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <Step n={1} title="Choose a news design" hint="Each preview uses your own headline, logo and wording. Click one to use it.">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {NEWS_DESIGNS.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => set({ design: x.id, color: undefined, color2: undefined, ...((config.size ?? 30) < 50 ? { size: 62 } : {}) }, true)}
                className={cn("overflow-hidden rounded-sm border text-left transition", d.id === x.id ? "border-program ring-1 ring-program" : "border-border hover:border-ring")}
              >
                <div className="relative aspect-video overflow-hidden bg-inset" style={{ containerType: "inline-size" }}>
                  <img src={slate} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />
                  <div className="absolute bottom-[12%] left-[4%]">
                    <NewsCard config={{ ...config, design: x.id, color: undefined, color2: undefined, transition_in: "none", scroll: false }} text={text} phase="hold" size={92} />
                  </div>
                </div>
                <div className="flex items-center justify-between px-2 py-1 text-xs">
                  <span className="font-medium">{x.name}</span>
                  {x.sub && <span className="text-[0.65rem] text-muted-foreground">with description line</span>}
                </div>
              </button>
            ))}
          </div>
        </Step>

        <div className="space-y-3">
          <Step n={2} title="Text" hint="Pick a ready-made wording, then edit. {clock} shows the live time and {date} today's date.">
            <div className="flex flex-wrap gap-1.5">
              {NEWS_TEMPLATES.map((tpl) => {
                const on = (config.kicker ?? "BREAKING NEWS") === tpl.kicker && (config.badge ?? "") === tpl.badge;
                return (
                  <button key={tpl.id} type="button" onClick={() => set({ kicker: tpl.kicker, badge: tpl.badge, ...(tpl.subtitle && !config.subtitle ? { subtitle: tpl.subtitle } : {}) })} className={cn("rounded-sm border px-2 py-1 text-xs font-semibold", on ? "border-program bg-program/15" : "border-border hover:bg-accent")}>
                    {tpl.name}
                  </button>
                );
              })}
            </div>
            <label className="block space-y-1"><span className="label-caps">Label</span><input className="field" value={config.kicker ?? "BREAKING NEWS"} maxLength={40} onChange={(e) => set({ kicker: e.target.value })} /></label>
            <label className="block space-y-1">
              <span className="label-caps">Headlines · one per line{headlines.length > 1 && ` · ${headlines.length} take turns`}</span>
              <textarea className="field" rows={3} value={config.title ?? ""} maxLength={1200} placeholder="Your headline here" onChange={(e) => set({ title: e.target.value })} />
            </label>
            {headlines.length > 1 && <label className="block space-y-1"><span className="label-caps">Change headline every · {config.rotate ?? 8} s</span><input type="range" min={3} max={30} value={config.rotate ?? 8} onChange={(e) => set({ rotate: +e.target.value })} className="w-full accent-program" /></label>}
            <label className="block space-y-1"><span className="label-caps">Description line</span><input className="field" value={config.subtitle ?? ""} maxLength={300} placeholder="e.g. Reporter name, place, or the story in one line" onChange={(e) => set({ subtitle: e.target.value })} /></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-program" checked={!!config.scroll} onChange={(e) => set({ scroll: e.target.checked })} />Scroll the description line like a ticker</label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1"><span className="label-caps">Logo box text</span><textarea className="field" rows={2} value={config.badge ?? ""} maxLength={30} placeholder={"MOVIE\nMAX"} onChange={(e) => set({ badge: e.target.value })} /></label>
              <label className="block space-y-1"><span className="label-caps">Time</span><input className="field" value={config.time_text ?? "{clock}"} maxLength={30} onChange={(e) => set({ time_text: e.target.value })} /><span className="block text-[0.65rem] text-muted-foreground">Shows on designs with a clock box. Clear it to hide.</span></label>
            </div>
          </Step>

          <Step n={3} title="Logo or picture" hint="Goes in the logo box. A PNG with a see-through background looks best.">
            <div className="flex items-center gap-2">
              {config.image_url ? <img src={config.image_url} alt="News logo" className="h-14 w-24 rounded-sm border border-border bg-inset object-contain" /> : <div className="grid h-14 w-24 place-items-center rounded-sm border border-dashed border-border text-[0.65rem] text-muted-foreground">Text only</div>}
              <label className="flex h-8 flex-1 cursor-pointer items-center justify-center gap-2 rounded-sm border border-dashed border-border text-xs hover:bg-accent">
                <ImagePlus className="size-3.5" />{config.image_url ? "Change logo" : "Upload logo"}
                <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }} />
              </label>
              {config.image_url && <Button type="button" size="xs" variant="panel" onClick={() => set({ image_url: undefined })} aria-label="Remove logo"><Trash2 className="size-3.5" /></Button>}
            </div>
          </Step>

          <Step n={4} title="Colours">
            <div className="flex items-end gap-2">
              <label className="flex-1 space-y-1"><span className="label-caps">Main</span><input type="color" className="h-8 w-full rounded-sm border border-input bg-inset" value={config.color ?? d.c1} onChange={(e) => set({ color: e.target.value })} /></label>
              <label className="flex-1 space-y-1"><span className="label-caps">Accent</span><input type="color" className="h-8 w-full rounded-sm border border-input bg-inset" value={config.color2 ?? d.c2} onChange={(e) => set({ color2: e.target.value })} /></label>
              <Button type="button" size="xs" variant="panel" onClick={() => set({ color: undefined, color2: undefined })}><RotateCcw className="size-3.5" />Design colours</Button>
            </div>
          </Step>

          <Step n={5} title="Transition" hint="How the lower third appears and disappears. Changing one plays it in the preview.">
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1"><span className="label-caps">Appear</span><select className="field" value={config.transition_in ?? "slide-left"} onChange={(e) => set({ transition_in: e.target.value }, true)}>{TRANSITIONS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
              <label className="block space-y-1"><span className="label-caps">Disappear</span><select className="field" value={config.transition_out ?? "fade"} onChange={(e) => set({ transition_out: e.target.value }, true)}>{TRANSITIONS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
            </div>
            <label className="block space-y-1"><span className="label-caps">Speed · {((config.transition_ms ?? 700) / 1000).toFixed(1)} s</span><input type="range" min={200} max={2500} step={100} value={config.transition_ms ?? 700} onChange={(e) => set({ transition_ms: +e.target.value })} onPointerUp={onPlay} className="w-full accent-program" /></label>
            <Button type="button" size="xs" variant="brand" onClick={onPlay}><Play className="size-3.5" />Play transition in preview</Button>
          </Step>

          <Step n={6} title="When it shows" hint="Timing starts when you press Publish.">
            <div className="space-y-1.5 text-sm">
              <label className="flex items-center gap-2"><input type="radio" className="accent-program" checked={mode === "always"} onChange={() => set({ duration: 0, show_mode: "once" })} />Stays on screen until I switch it off</label>
              <label className="flex items-center gap-2"><input type="radio" className="accent-program" checked={mode === "once"} onChange={() => set({ duration: config.duration || 20, show_mode: "once" })} />Once, right after I publish</label>
              <label className="flex items-center gap-2"><input type="radio" className="accent-program" checked={mode === "repeat"} onChange={() => set({ duration: config.duration || 20, show_mode: "repeat" })} />Again and again, on a timer</label>
            </div>
            {mode !== "always" && (
              <div className="grid grid-cols-2 gap-2">
                <label className="block space-y-1"><span className="label-caps">On screen for (seconds)</span><input type="number" min={3} max={3600} className="field" value={config.duration ?? 20} onChange={(e) => set({ duration: Math.max(3, +e.target.value) })} /></label>
                {mode === "repeat" && <label className="block space-y-1"><span className="label-caps">Repeat every (minutes)</span><input type="number" min={1} max={240} className="field" value={config.every ?? 10} onChange={(e) => set({ every: Math.max(1, +e.target.value) })} /></label>}
              </div>
            )}
          </Step>
        </div>
      </div>
    </section>
  );
}
