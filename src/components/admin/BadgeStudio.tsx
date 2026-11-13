import { ImagePlus, Play, RotateCcw, Trash2 } from "lucide-react";
import { Step } from "@/components/admin/UpNextStudio";
import { TimingStep } from "@/components/admin/TimingStep";
import { ClockCard, LogoMark, NowShowingCard, OnAirCard } from "@/components/broadcast/BadgeCards";
import { TRANSITIONS, type CardPhase } from "@/lib/brand-cards";
import { designIn } from "@/lib/card-kits";
import { BADGE_DEFAULTS, CAPTION_PLACES, badgeDesigns, badgeTemplates, clockParts, nowShowingText, type BadgeKind } from "@/lib/badge-kits";
import type { OverlayConfig } from "@/lib/graphics";
import { Button } from "@/components/ui/button";
import { useNow } from "@/hooks/use-station";
import { cn } from "@/lib/utils";
import slate from "@/assets/standby-slate.jpg";

interface Props {
  kind: BadgeKind;
  config: OverlayConfig;
  timezone: string;
  /** Programme title used in the "Now showing" previews. */
  programme: string | null;
  onChange: (patch: OverlayConfig) => void;
  onUpload: (file: File, field: "logo_url" | "image_url") => void;
  onPlay: () => void;
  enabled: boolean;
  onEnable: () => void;
}

const COPY: Record<BadgeKind, { title: string; what: string; designs: string; thumb: number; inDefault: string; outDefault: string }> = {
  now_showing: { title: "Now showing", what: "The Now showing card", designs: "Now showing design", thumb: 62, inDefault: "slide-left", outDefault: "fade" },
  clock: { title: "Local time", what: "The clock", designs: "clock design", thumb: 26, inDefault: "fade", outDefault: "fade" },
  on_air: { title: "ON AIR tag", what: "The ON AIR tag", designs: "ON AIR design", thumb: 20, inDefault: "fade", outDefault: "fade" },
  logo: { title: "Logo watermark", what: "The logo watermark", designs: "style for the text under the logo", thumb: 26, inDefault: "fade", outDefault: "fade" },
};

/** Draw one badge graphic (design list thumbnails). */
export function BadgePreview({ kind, config, timezone, programme, now, phase = "hold" }: { kind: BadgeKind; config: OverlayConfig; timezone: string; programme: string | null; now: number; phase?: CardPhase }) {
  if (kind === "now_showing") return <NowShowingCard config={config} text={nowShowingText(config, programme, now, timezone)} phase={phase} />;
  if (kind === "clock") return <ClockCard config={config} parts={clockParts(now, timezone, { h12: config.h12, seconds: config.seconds })} label={config.kicker ?? BADGE_DEFAULTS.clock.kicker} phase={phase} />;
  if (kind === "on_air") return <OnAirCard config={config} phase={phase} />;
  return <LogoMark config={config} phase={phase} />;
}

/** Branding studio for Now showing, the local-time clock, the ON AIR tag and the logo watermark text. */
export function BadgeStudio({ kind, config, timezone, programme, onChange, onUpload, onPlay, enabled, onEnable }: Props) {
  const now = useNow(1000) ?? 0;
  const copy = COPY[kind];
  const designs = badgeDesigns(kind);
  const templates = badgeTemplates(kind);
  const d = designIn(designs, config.design);
  const set = (patch: OverlayConfig, replay = false) => { onChange(patch); if (replay) setTimeout(onPlay, 50); };
  const thumbCfg = (id: string): OverlayConfig => ({
    ...config, design: id, color: undefined, color2: undefined, transition_in: "none", size: copy.thumb,
    ...(kind === "logo" ? { caption: config.caption ?? BADGE_DEFAULTS.logo.caption, caption_size: Math.max(config.caption_size ?? 18, 22) } : {}),
  });
  // Unset fields count as their on-screen default, so the right wording button lights up.
  const fallback: Partial<Record<keyof OverlayConfig, string>> = { kicker: kind === "clock" ? BADGE_DEFAULTS.clock.kicker : "NOW SHOWING", text: BADGE_DEFAULTS.on_air.text, tag: "", caption: "" };
  const field = (k: keyof OverlayConfig) => ((config as Record<string, unknown>)[k] ?? fallback[k] ?? "") as string;

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
        <Step n={1} title={`Choose a ${copy.designs}`} hint={`${designs.length} designs, each previewed with your own wording. Click one to use it.`}>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
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
                  <div className={cn("absolute", kind === "now_showing" ? "bottom-[10%] left-[5%]" : "left-[8%] top-[10%]")}>
                    <BadgePreview kind={kind} config={thumbCfg(x.id)} timezone={timezone} programme={programme} now={now} />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-1 px-2 py-1 text-xs">
                  <span className="truncate font-medium">{x.name}</span>
                  {x.note && <span className="truncate text-[0.65rem] text-muted-foreground">{x.note}</span>}
                </div>
              </button>
            ))}
          </div>
        </Step>

        <div className="space-y-3">
          <Step n={2} title="Text" hint={kind === "logo" ? "The words under or next to your logo, e.g. TV." : "Pick a ready-made wording, then edit."}>
            <div className="flex flex-wrap gap-1.5">
              {templates.map((tpl) => {
                const on = Object.entries(tpl.patch).every(([k, v]) => field(k as keyof OverlayConfig) === v);
                return <button key={tpl.id} type="button" onClick={() => set(tpl.patch as OverlayConfig)} className={cn("rounded-sm border px-2 py-1 text-xs font-semibold", on ? "border-program bg-program/15" : "border-border hover:bg-accent")}>{tpl.name}</button>;
              })}
            </div>

            {kind === "now_showing" && (
              <>
                <label className="block space-y-1"><span className="label-caps">Small heading</span><input className="field" value={config.kicker ?? "NOW SHOWING"} maxLength={40} onChange={(e) => set({ kicker: e.target.value })} /></label>
                <label className="block space-y-1"><span className="label-caps">Title</span><input className="field" value={config.title ?? ""} maxLength={80} placeholder="Leave empty to show the programme's own name" onChange={(e) => set({ title: e.target.value })} /></label>
                <label className="block space-y-1"><span className="label-caps">Small line under the title</span><input className="field" value={config.subtitle ?? ""} maxLength={80} placeholder="e.g. Drama · {date}" onChange={(e) => set({ subtitle: e.target.value })} /></label>
                <label className="block space-y-1"><span className="label-caps">Logo box text</span><textarea className="field" rows={2} value={config.badge ?? ""} maxLength={30} placeholder={"MOVIE\nMAX"} onChange={(e) => set({ badge: e.target.value })} /><span className="block text-[0.65rem] text-muted-foreground">Used by the “Logo box” design.</span></label>
              </>
            )}

            {kind === "clock" && (
              <>
                <label className="block space-y-1"><span className="label-caps">Label</span><input className="field" value={config.kicker ?? BADGE_DEFAULTS.clock.kicker} maxLength={24} onChange={(e) => set({ kicker: e.target.value })} /><span className="block text-[0.65rem] text-muted-foreground">Clear it to show only the time.</span></label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block space-y-1"><span className="label-caps">Format</span><select className="field" value={config.h12 ? "12" : "24"} onChange={(e) => set({ h12: e.target.value === "12" })}><option value="24">24-hour (18:30)</option><option value="12">12-hour (6:30 PM)</option></select></label>
                  <div className="space-y-1.5 pt-5 text-sm">
                    <label className="flex items-center gap-2"><input type="checkbox" className="accent-program" checked={!!config.seconds} onChange={(e) => set({ seconds: e.target.checked })} />Seconds</label>
                    <label className="flex items-center gap-2"><input type="checkbox" className="accent-program" checked={!!config.show_date} onChange={(e) => set({ show_date: e.target.checked })} />Date</label>
                  </div>
                </div>
              </>
            )}

            {kind === "on_air" && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block space-y-1"><span className="label-caps">Words</span><input className="field" value={config.text ?? BADGE_DEFAULTS.on_air.text} maxLength={20} onChange={(e) => set({ text: e.target.value })} /></label>
                  <label className="block space-y-1"><span className="label-caps">Small tag</span><input className="field" value={config.tag ?? ""} maxLength={16} placeholder="e.g. HD" onChange={(e) => set({ tag: e.target.value })} /></label>
                </div>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-program" checked={config.blink !== false} onChange={(e) => set({ blink: e.target.checked })} />Blinking light</label>
                <p className="text-[0.65rem] text-muted-foreground">Shows only while a programme is actually playing.</p>
              </>
            )}

            {kind === "logo" && (
              <>
                <label className="block space-y-1"><span className="label-caps">Text with the logo</span><input className="field" value={config.caption ?? ""} maxLength={24} placeholder="e.g. TV" onChange={(e) => set({ caption: e.target.value })} /></label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block space-y-1"><span className="label-caps">Where</span><select className="field" value={config.caption_pos ?? "below"} onChange={(e) => set({ caption_pos: e.target.value as OverlayConfig["caption_pos"] })}>{CAPTION_PLACES.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
                  <label className="block space-y-1"><span className="label-caps">Text size · {config.caption_size ?? 18}%</span><input type="range" min={8} max={60} value={config.caption_size ?? 18} onChange={(e) => set({ caption_size: +e.target.value })} className="w-full accent-program" /></label>
                </div>
              </>
            )}
          </Step>

          {(kind === "now_showing" || kind === "logo") && (() => {
            const f = kind === "logo" ? "logo_url" : "image_url";
            const url = config[f];
            return (
              <Step n={3} title={kind === "logo" ? "Logo picture" : "Logo for the logo box"} hint="A PNG with a see-through background looks best.">
                <div className="flex items-center gap-2">
                  {url ? <img src={url} alt="Logo" className="h-14 w-24 rounded-sm border border-border bg-inset object-contain" /> : <div className="grid h-14 w-24 place-items-center rounded-sm border border-dashed border-border text-[0.65rem] text-muted-foreground">{kind === "logo" ? "MOVIE MAX" : "Text only"}</div>}
                  <label className="flex h-8 flex-1 cursor-pointer items-center justify-center gap-2 rounded-sm border border-dashed border-border text-xs hover:bg-accent">
                    <ImagePlus className="size-3.5" />{url ? "Change picture" : "Upload picture"}
                    <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) onUpload(file, f); e.target.value = ""; }} />
                  </label>
                  {url && <Button type="button" size="xs" variant="panel" onClick={() => set({ [f]: undefined })} aria-label="Remove picture"><Trash2 className="size-3.5" /></Button>}
                </div>
              </Step>
            );
          })()}

          <Step n={4} title="Colours">
            <div className="flex items-end gap-2">
              <label className="flex-1 space-y-1"><span className="label-caps">{kind === "logo" ? "Text" : "Main"}</span><input type="color" className="h-8 w-full rounded-sm border border-input bg-inset" value={config.color ?? d.c1} onChange={(e) => set({ color: e.target.value })} /></label>
              <label className="flex-1 space-y-1"><span className="label-caps">Accent</span><input type="color" className="h-8 w-full rounded-sm border border-input bg-inset" value={config.color2 ?? d.c2} onChange={(e) => set({ color2: e.target.value })} /></label>
              <Button type="button" size="xs" variant="panel" onClick={() => set({ color: undefined, color2: undefined })}><RotateCcw className="size-3.5" />Design colours</Button>
            </div>
          </Step>

          <Step n={5} title="Transition" hint="How it appears and disappears.">
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1"><span className="label-caps">Appear</span><select className="field" value={config.transition_in ?? copy.inDefault} onChange={(e) => set({ transition_in: e.target.value }, true)}>{TRANSITIONS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
              <label className="block space-y-1"><span className="label-caps">Disappear</span><select className="field" value={config.transition_out ?? copy.outDefault} onChange={(e) => set({ transition_out: e.target.value }, true)}>{TRANSITIONS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
            </div>
            <label className="block space-y-1"><span className="label-caps">Speed · {((config.transition_ms ?? 700) / 1000).toFixed(1)} s</span><input type="range" min={200} max={2500} step={100} value={config.transition_ms ?? 700} onChange={(e) => set({ transition_ms: +e.target.value })} onPointerUp={onPlay} className="w-full accent-program" /></label>
            <Button type="button" size="xs" variant="brand" onClick={onPlay}><Play className="size-3.5" />Play transition in preview</Button>
          </Step>

          <TimingStep n={6} kind={kind} config={config} set={set} defaultSeconds={kind === "now_showing" ? 10 : 15} />
        </div>
      </div>
    </section>
  );
}
