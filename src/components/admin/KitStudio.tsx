import { ImagePlus, Play, RotateCcw, Trash2 } from "lucide-react";
import { Step } from "@/components/admin/UpNextStudio";
import { TickerCard } from "@/components/broadcast/TickerCard";
import { BreakingCard } from "@/components/broadcast/BreakingCard";
import { PopupCard } from "@/components/broadcast/PopupCard";
import { TRANSITIONS, type CardPhase } from "@/lib/brand-cards";
import { KIT_DEFAULTS, POPUP_ICONS, designIn, kitDesigns, kitTemplates, kitTextFor, type KitKind, type KitText } from "@/lib/card-kits";
import { newsHeadlines } from "@/lib/news-cards";
import type { OverlayConfig } from "@/lib/graphics";
import { Button } from "@/components/ui/button";
import { useNow } from "@/hooks/use-station";
import { cn } from "@/lib/utils";
import slate from "@/assets/standby-slate.jpg";

interface Props {
  kind: KitKind;
  config: OverlayConfig;
  timezone: string;
  onChange: (patch: OverlayConfig) => void;
  onUpload: (file: File) => void;
  onPlay: () => void;
  enabled: boolean;
  onEnable: () => void;
}

const COPY: Record<KitKind, { title: string; what: string; label: string; lines: string; linesHint: string; inDefault: string; outDefault: string }> = {
  ticker: { title: "Rolling ticker", what: "The rolling ticker", label: "Label on the left", lines: "Ticker items · one per line", linesHint: "All items roll across one after another.", inDefault: "slide-up", outDefault: "slide-down" },
  breaking_news: { title: "Breaking news", what: "The breaking news banner", label: "Big words", lines: "Headlines · one per line", linesHint: "", inDefault: "wipe", outDefault: "fade" },
  ad_banner: { title: "Pop-up card", what: "The pop-up card", label: "Heading", lines: "Message · one per line", linesHint: "", inDefault: "pop", outDefault: "zoom" },
};

/** Draw one kit card (used by the design list and nowhere else — on air uses GraphicsLayer). */
export function KitPreviewCard({ kind, config, text, phase, size }: { kind: KitKind; config: OverlayConfig; text: KitText; phase: CardPhase; size?: number }) {
  if (kind === "ticker") return <TickerCard config={config} text={text} phase={phase} width={size ?? 100} />;
  if (kind === "breaking_news") return <BreakingCard config={config} text={text} phase={phase} size={size} />;
  return <PopupCard config={config} text={text} phase={phase} size={size} />;
}

/** Branding studio for the rolling ticker, breaking news banner and pop-up card. */
export function KitStudio({ kind, config, timezone, onChange, onUpload, onPlay, enabled, onEnable }: Props) {
  const now = useNow(1000) ?? 0;
  const copy = COPY[kind];
  const designs = kitDesigns(kind);
  const templates = kitTemplates(kind);
  const d = designIn(designs, config.design);
  const text = kitTextFor(config, now, timezone, KIT_DEFAULTS[kind]);
  const lines = config.title ?? config.text ?? "";
  const items = newsHeadlines(lines);
  const set = (patch: OverlayConfig, replay = false) => { onChange(patch); if (replay) setTimeout(onPlay, 50); };
  const mode = (Number(config.duration) || 0) === 0 ? "always" : config.show_mode === "repeat" ? "repeat" : "once";
  const previewSize = kind === "ticker" ? 100 : kind === "breaking_news" ? 88 : 70;

  return (
    <section className="panel">
      <div className="panel-header">{copy.title} · branding studio<span className="normal-case tracking-normal">changes show in the preview above · publish or “Show now” to put them on air</span></div>
      {!enabled && (
        <div className="flex items-center justify-between gap-2 border-b border-border bg-warn/10 px-3 py-2 text-xs">
          <span>{copy.what} is switched off, so it isn't in the preview or on air.</span>
          <Button type="button" size="xs" variant="panel" onClick={onEnable}>Switch on</Button>
        </div>
      )}
      <div className="grid gap-3 p-3 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <Step n={1} title={`Choose a ${copy.title.toLowerCase()} design`} hint={`${designs.length} designs, each previewed with your own wording and logo. Click one to use it.`}>
          <div className={cn("grid grid-cols-1 gap-2 md:grid-cols-2", kind === "ticker" ? "xl:grid-cols-2" : "xl:grid-cols-3")}>
            {designs.map((x) => (
              <button
                key={x.id}
                type="button"
                aria-label={`Use the ${x.name} design`}
                onClick={() => set({ design: x.id, color: undefined, color2: undefined }, true)}
                className={cn("overflow-hidden rounded-sm border text-left transition", d.id === x.id ? "border-program ring-1 ring-program" : "border-border hover:border-ring")}
              >
                <div className="relative aspect-video overflow-hidden bg-inset" style={{ containerType: "inline-size" }}>
                  <img src={slate} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />
                  <div className={cn("absolute", kind === "ticker" ? "inset-x-0 bottom-[6%]" : "bottom-[10%] left-[5%]")}>
                    <KitPreviewCard kind={kind} config={{ ...config, design: x.id, color: undefined, color2: undefined, transition_in: "none" }} text={text} phase="hold" size={previewSize} />
                  </div>
                </div>
                <div className="flex items-center justify-between px-2 py-1 text-xs">
                  <span className="font-medium">{x.name}</span>
                  {x.note && <span className="text-[0.65rem] text-muted-foreground">{x.note}</span>}
                </div>
              </button>
            ))}
          </div>
        </Step>

        <div className="space-y-3">
          <Step n={2} title="Text" hint="Pick a ready-made wording, then edit. {clock} shows the live time and {date} today's date.">
            <div className="flex flex-wrap gap-1.5">
              {templates.map((tpl) => {
                const on = Object.entries(tpl.patch).every(([k, v]) => ((config as Record<string, unknown>)[k] ?? "") === v);
                return (
                  <button key={tpl.id} type="button" onClick={() => set(tpl.patch as OverlayConfig)} className={cn("rounded-sm border px-2 py-1 text-xs font-semibold", on ? "border-program bg-program/15" : "border-border hover:bg-accent")}>
                    {tpl.name}
                  </button>
                );
              })}
            </div>
            <label className="block space-y-1"><span className="label-caps">{copy.label}</span><input className="field" value={config.kicker ?? KIT_DEFAULTS[kind].kicker} maxLength={40} onChange={(e) => set({ kicker: e.target.value })} /></label>
            {kind === "breaking_news" && <label className="block space-y-1"><span className="label-caps">Small tag</span><input className="field" value={config.tag ?? "LIVE"} maxLength={24} onChange={(e) => set({ tag: e.target.value })} /></label>}
            <label className="block space-y-1">
              <span className="label-caps">{copy.lines}{kind !== "ticker" && items.length > 1 && ` · ${items.length} take turns`}</span>
              <textarea className="field" rows={kind === "ticker" ? 4 : 3} value={lines} maxLength={2000} placeholder={KIT_DEFAULTS[kind].line} onChange={(e) => set({ title: e.target.value, text: undefined })} />
              {copy.linesHint && <span className="block text-[0.65rem] text-muted-foreground">{copy.linesHint}</span>}
            </label>
            {kind !== "ticker" && items.length > 1 && <label className="block space-y-1"><span className="label-caps">Change every · {config.rotate ?? 8} s</span><input type="range" min={3} max={30} value={config.rotate ?? 8} onChange={(e) => set({ rotate: +e.target.value })} className="w-full accent-program" /></label>}
            {kind === "ad_banner" && <label className="block space-y-1"><span className="label-caps">Small line under the message</span><input className="field" value={config.subtitle ?? ""} maxLength={120} placeholder="e.g. 0700 000 000 · www.moviemax.tv" onChange={(e) => set({ subtitle: e.target.value })} /></label>}
            {kind === "ticker" && (
              <div className="grid grid-cols-2 gap-2">
                <label className="block space-y-1"><span className="label-caps">Speed · {config.speed ?? 60}</span><input type="range" min={20} max={200} value={config.speed ?? 60} onChange={(e) => set({ speed: +e.target.value })} className="w-full accent-program" /></label>
                <label className="block space-y-1"><span className="label-caps">Between items</span><select className="field" value={config.sep ?? "◆"} onChange={(e) => set({ sep: e.target.value })}>{["◆", "•", "|", "★", "▶", "—"].map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1"><span className="label-caps">Logo box text</span><textarea className="field" rows={2} value={config.badge ?? ""} maxLength={30} placeholder={"MOVIE\nMAX"} onChange={(e) => set({ badge: e.target.value })} /></label>
              {kind !== "ad_banner" && <label className="block space-y-1"><span className="label-caps">Time</span><input className="field" value={config.time_text ?? "{clock}"} maxLength={30} onChange={(e) => set({ time_text: e.target.value })} /><span className="block text-[0.65rem] text-muted-foreground">Clear it to hide the clock.</span></label>}
              {kind !== "breaking_news" && (
                <label className="block space-y-1"><span className="label-caps">Icon</span><select className="field" value={config.icon ?? (kind === "ticker" ? "tv" : "users")} onChange={(e) => set({ icon: e.target.value })}>{POPUP_ICONS.map((i) => <option key={i} value={i}>{i === "none" ? "No icon" : i}</option>)}</select></label>
              )}
            </div>
          </Step>

          <Step n={3} title={kind === "ad_banner" ? "Picture or logo" : "Logo"} hint={kind === "ad_banner" ? "Replaces the icon. A PNG with a see-through background looks best." : "Goes in the logo box on designs that have one."}>
            <div className="flex items-center gap-2">
              {config.image_url ? <img src={config.image_url} alt="Card picture" className="h-14 w-24 rounded-sm border border-border bg-inset object-contain" /> : <div className="grid h-14 w-24 place-items-center rounded-sm border border-dashed border-border text-[0.65rem] text-muted-foreground">Text only</div>}
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
              <label className="flex-1 space-y-1"><span className="label-caps">Accent</span><input type="color" className="h-8 w-full rounded-sm border border-input bg-inset" value={config.color2 ?? d.c2} onChange={(e) => set({ color2: e.target.value })} /></label>
              <Button type="button" size="xs" variant="panel" onClick={() => set({ color: undefined, color2: undefined })}><RotateCcw className="size-3.5" />Design colours</Button>
            </div>
          </Step>

          <Step n={5} title="Transition" hint="How it appears and disappears. Changing one plays it in the preview.">
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1"><span className="label-caps">Appear</span><select className="field" value={config.transition_in ?? copy.inDefault} onChange={(e) => set({ transition_in: e.target.value }, true)}>{TRANSITIONS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
              <label className="block space-y-1"><span className="label-caps">Disappear</span><select className="field" value={config.transition_out ?? copy.outDefault} onChange={(e) => set({ transition_out: e.target.value }, true)}>{TRANSITIONS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
            </div>
            <label className="block space-y-1"><span className="label-caps">Speed · {((config.transition_ms ?? 700) / 1000).toFixed(1)} s</span><input type="range" min={200} max={2500} step={100} value={config.transition_ms ?? 700} onChange={(e) => set({ transition_ms: +e.target.value })} onPointerUp={onPlay} className="w-full accent-program" /></label>
            <Button type="button" size="xs" variant="brand" onClick={onPlay}><Play className="size-3.5" />Play transition in preview</Button>
          </Step>

          <Step n={6} title="When it shows" hint="Timing starts when you press Show now (or Publish after changing it).">
            <div className="space-y-1.5 text-sm">
              <label className="flex items-center gap-2"><input type="radio" className="accent-program" checked={mode === "always"} onChange={() => set({ duration: 0, show_mode: "once" })} />Stays on screen until I take it off</label>
              <label className="flex items-center gap-2"><input type="radio" className="accent-program" checked={mode === "once"} onChange={() => set({ duration: config.duration || 15, show_mode: "once" })} />Once, for a set time</label>
              <label className="flex items-center gap-2"><input type="radio" className="accent-program" checked={mode === "repeat"} onChange={() => set({ duration: config.duration || 15, show_mode: "repeat" })} />Again and again, on a timer</label>
            </div>
            {mode !== "always" && (
              <div className="grid grid-cols-2 gap-2">
                <label className="block space-y-1"><span className="label-caps">On screen for (seconds)</span><input type="number" min={3} max={3600} className="field" value={config.duration ?? 15} onChange={(e) => set({ duration: Math.max(3, +e.target.value) })} /></label>
                {mode === "repeat" && <label className="block space-y-1"><span className="label-caps">Repeat every (minutes)</span><input type="number" min={1} max={240} className="field" value={config.every ?? 10} onChange={(e) => set({ every: Math.max(1, +e.target.value) })} /></label>}
              </div>
            )}
          </Step>
        </div>
      </div>
    </section>
  );
}
