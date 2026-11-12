import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";
import { useStation } from "@/components/admin/station-context";
import { useNow } from "@/hooks/use-station";
import { PageHeader, EmptyState } from "@/components/admin/PageHeader";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { StatusChip } from "@/components/broadcast/status";
import { Wordmark } from "@/components/brand/Wordmark";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { formatClock, formatTime } from "@/lib/broadcast";
import { cn } from "@/lib/utils";
import slate from "@/assets/standby-slate.jpg";

export const Route = createFileRoute("/_authenticated/admin/graphics")({ component: GraphicsPage });

type Overlay = Tables<"graphics_overlays">;
interface OverlayConfig {
  position?: string;
  size?: number;
  opacity?: number;
  color?: string;
  text?: string;
  title?: string;
  subtitle?: string;
  speed?: number;
  duration?: number;
  logo_url?: string;
}
const POSITIONS = ["top-left", "top-center", "top-right", "bottom-left", "bottom-center", "bottom-right", "bottom"];
const cfg = (o: Overlay): OverlayConfig => (o.config && typeof o.config === "object" && !Array.isArray(o.config) ? (o.config as OverlayConfig) : {});

function GraphicsPage() {
  const { channel, can } = useStation();
  const qc = useQueryClient();
  const canEdit = can("graphics");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, OverlayConfig>>({});
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});

  const overlays = useQuery({
    queryKey: ["overlays", channel.id],
    queryFn: async () => (await supabase.from("graphics_overlays").select("*").eq("channel_id", channel.id).order("created_at")).data ?? [],
  });
  useEffect(() => {
    if (!overlays.data) return;
    setDraft(Object.fromEntries(overlays.data.map((o) => [o.id, cfg(o)])));
    setEnabled(Object.fromEntries(overlays.data.map((o) => [o.id, o.enabled])));
    if (!activeId && overlays.data[0]) setActiveId(overlays.data[0].id);
  }, [overlays.data, activeId]);

  const list = overlays.data ?? [];
  const active = list.find((o) => o.id === activeId) ?? null;
  const activeCfg = active ? draft[active.id] ?? {} : {};
  const setCfg = (patch: OverlayConfig) => active && setDraft((d) => ({ ...d, [active.id]: { ...(d[active.id] ?? {}), ...patch } }));
  const dirty = list.some((o) => JSON.stringify(draft[o.id] ?? {}) !== JSON.stringify(cfg(o)) || enabled[o.id] !== o.enabled);
  const unpublished = list.some((o) => !o.published_at || o.updated_at > o.published_at);

  async function save(publish: boolean) {
    const ts = new Date().toISOString();
    const results = await Promise.all(list.map((o) =>
      supabase.from("graphics_overlays").update({ config: (draft[o.id] ?? {}) as Json, enabled: enabled[o.id] ?? o.enabled, ...(publish ? { published_at: new Date(Date.now() + 1000).toISOString() } : {}) }).eq("id", o.id),
    ));
    const err = results.find((r) => r.error)?.error;
    if (err) toast.error(err.message);
    else toast.success(publish ? `Graphics published to the broadcast output at ${formatTime(ts, channel.timezone)}` : "Graphics saved as draft");
    qc.invalidateQueries({ queryKey: ["overlays", channel.id] });
  }

  async function uploadLogo(file: File) {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 2_000_000) {
      toast.error("Use a PNG, JPG or WebP under 2 MB");
      return;
    }
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `logos/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("media-thumbnails").upload(path, file, { contentType: file.type });
    if (error) {
      toast.error(error.message);
      return;
    }
    setCfg({ logo_url: `/api/public/thumbnails/${path}` });
    toast.success("Logo uploaded — save or publish to apply");
  }

  return (
    <div>
      <PageHeader title="Graphics" description="On-screen graphics are composited by the playout engine into the broadcast output." actions={
        <>
          {unpublished && <StatusChip tone="warn">Unpublished changes</StatusChip>}
          <Button size="xs" variant="panel" disabled={!canEdit || !dirty} onClick={() => save(false)}>Save draft</Button>
          <ConfirmButton size="xs" variant="brand" disabled={!canEdit} title="Publish graphics to air?" description="Enabled overlays will be rendered into the live output for every viewer on the engine's next config refresh." confirmLabel="Publish" onConfirm={() => save(true)}>Publish to output</ConfirmButton>
        </>
      } />
      <div className="grid gap-3 p-3 xl:grid-cols-[260px_minmax(0,1fr)_320px]">
        <section className="panel h-fit">
          <div className="panel-header">Overlays</div>
          {list.length === 0 && <EmptyState title="No overlays" />}
          {list.map((o) => (
            <div key={o.id} className={cn("flex items-center gap-2 border-b border-border/60 px-3 py-1.5", activeId === o.id && "bg-accent")}>
              <button className="min-w-0 flex-1 truncate text-left text-sm" onClick={() => setActiveId(o.id)}>{o.name}</button>
              <Switch disabled={!canEdit} checked={!!enabled[o.id]} onCheckedChange={(c) => setEnabled((e) => ({ ...e, [o.id]: c }))} aria-label={`Enable ${o.name}`} />
            </div>
          ))}
        </section>

        <section className="panel">
          <div className="panel-header">Preview<span className="normal-case tracking-normal">layout preview — final render happens on the playout engine</span></div>
          <div className="p-2"><GraphicsPreview overlays={list} draft={draft} enabled={enabled} /></div>
        </section>

        <section className="panel h-fit">
          <div className="panel-header">{active?.name ?? "Editor"}</div>
          {active ? (
            <fieldset disabled={!canEdit} className="space-y-3 p-3 text-sm">
              <label className="block space-y-1"><span className="label-caps">Position</span><select className="field" value={activeCfg.position ?? "top-right"} onChange={(e) => setCfg({ position: e.target.value })}>{POSITIONS.map((p) => <option key={p}>{p}</option>)}</select></label>
              <label className="block space-y-1"><span className="label-caps">Size · {activeCfg.size ?? 20}% of width</span><input type="range" min={4} max={100} value={activeCfg.size ?? 20} onChange={(e) => setCfg({ size: +e.target.value })} className="w-full accent-program" /></label>
              <label className="block space-y-1"><span className="label-caps">Opacity · {Math.round((activeCfg.opacity ?? 1) * 100)}%</span><input type="range" min={0.1} max={1} step={0.05} value={activeCfg.opacity ?? 1} onChange={(e) => setCfg({ opacity: +e.target.value })} className="w-full accent-program" /></label>
              {active.kind !== "clock" && active.kind !== "logo" && <label className="block space-y-1"><span className="label-caps">Accent colour</span><input type="color" className="h-8 w-full rounded-sm border border-input bg-inset" value={activeCfg.color ?? "#e5322d"} onChange={(e) => setCfg({ color: e.target.value })} /></label>}
              {["ticker", "breaking_news", "on_air", "ad_banner", "station_id", "programme_title", "logo"].includes(active.kind) && (
                <label className="block space-y-1"><span className="label-caps">{active.kind === "ticker" ? "Ticker text" : "Text"}</span><textarea className="field" rows={active.kind === "ticker" ? 3 : 1} value={activeCfg.text ?? ""} onChange={(e) => setCfg({ text: e.target.value })} maxLength={500} /></label>
              )}
              {active.kind === "ticker" && <label className="block space-y-1"><span className="label-caps">Speed · {activeCfg.speed ?? 60} px/s</span><input type="range" min={20} max={200} value={activeCfg.speed ?? 60} onChange={(e) => setCfg({ speed: +e.target.value })} className="w-full accent-program" /></label>}
              {active.kind === "lower_third" && (
                <>
                  <label className="block space-y-1"><span className="label-caps">Title line</span><input className="field" value={activeCfg.title ?? ""} onChange={(e) => setCfg({ title: e.target.value })} maxLength={80} /></label>
                  <label className="block space-y-1"><span className="label-caps">Subtitle line</span><input className="field" value={activeCfg.subtitle ?? ""} onChange={(e) => setCfg({ subtitle: e.target.value })} maxLength={120} /></label>
                </>
              )}
              {["now_showing", "next_programme", "lower_third", "station_id", "programme_title", "ad_banner"].includes(active.kind) && (
                <label className="block space-y-1"><span className="label-caps">Display duration (seconds, 0 = always)</span><input type="number" min={0} max={3600} className="field" value={activeCfg.duration ?? 0} onChange={(e) => setCfg({ duration: Math.max(0, +e.target.value) })} /></label>
              )}
              {active.kind === "logo" && (
                <label className="flex h-8 cursor-pointer items-center justify-center gap-2 rounded-sm border border-dashed border-border text-xs hover:bg-accent">
                  <Upload className="size-3.5" />Upload logo image
                  <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
                </label>
              )}
              <ScheduleWindow overlay={active} />
            </fieldset>
          ) : <EmptyState title="Select an overlay" />}
        </section>
      </div>
    </div>
  );
}

function ScheduleWindow({ overlay }: { overlay: Overlay }) {
  const qc = useQueryClient();
  const toLocal = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : "");
  const [from, setFrom] = useState(toLocal(overlay.show_from));
  const [until, setUntil] = useState(toLocal(overlay.show_until));
  useEffect(() => { setFrom(toLocal(overlay.show_from)); setUntil(toLocal(overlay.show_until)); }, [overlay]);
  async function save() {
    const { error } = await supabase.from("graphics_overlays").update({ show_from: from ? new Date(from + "Z").toISOString() : null, show_until: until ? new Date(until + "Z").toISOString() : null }).eq("id", overlay.id);
    if (error) toast.error(error.message);
    else toast.success("Schedule window saved");
    qc.invalidateQueries({ queryKey: ["overlays"] });
  }
  return (
    <div className="space-y-1.5 rounded-sm border border-border bg-inset p-2">
      <span className="label-caps">Scheduled display window (UTC, optional)</span>
      <input type="datetime-local" className="field" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Show from" />
      <input type="datetime-local" className="field" value={until} onChange={(e) => setUntil(e.target.value)} aria-label="Show until" />
      <Button type="button" size="xs" variant="panel" onClick={save}>Save window</Button>
    </div>
  );
}

function GraphicsPreview({ overlays, draft, enabled }: { overlays: Overlay[]; draft: Record<string, OverlayConfig>; enabled: Record<string, boolean> }) {
  const { channel } = useStation();
  const now = useNow(1000);
  const pos = (p?: string) => {
    switch (p) {
      case "top-left": return "left-[3%] top-[4%]";
      case "top-center": return "left-1/2 top-[4%] -translate-x-1/2";
      case "top-right": return "right-[3%] top-[4%]";
      case "bottom-left": return "bottom-[12%] left-[3%]";
      case "bottom-center": return "bottom-[12%] left-1/2 -translate-x-1/2";
      case "bottom-right": return "bottom-[12%] right-[3%]";
      default: return "inset-x-0 bottom-0";
    }
  };
  return (
    <div className="monitor @container" style={{ containerType: "inline-size" }}>
      <img src={slate} alt="" className="absolute inset-0 h-full w-full object-cover" />
      {overlays.filter((o) => enabled[o.id]).map((o) => {
        const c = draft[o.id] ?? {};
        const style: React.CSSProperties = { opacity: c.opacity ?? 1, width: o.kind === "ticker" || o.kind === "breaking_news" ? "100%" : `${c.size ?? 20}%` };
        const accent = { backgroundColor: c.color ?? "var(--tally-program)" };
        const fs = { fontSize: "clamp(8px, 1.6cqw, 22px)" };
        return (
          <div key={o.id} className={cn("absolute", pos(c.position))} style={style}>
            {o.kind === "logo" && (c.logo_url ? <img src={c.logo_url} alt="Logo" className="w-full" /> : <Wordmark className="text-[clamp(8px,2.2cqw,28px)]" />)}
            {o.kind === "on_air" && <span className="inline-block rounded-sm px-[0.6em] py-[0.2em] font-bold uppercase tracking-widest text-program-foreground" style={{ ...accent, ...fs }}>{c.text ?? "On Air"}</span>}
            {o.kind === "live_indicator" && <span className="inline-block rounded-sm px-[0.6em] py-[0.2em] font-bold uppercase text-program-foreground" style={{ ...accent, ...fs }}>Live</span>}
            {o.kind === "clock" && <span className="timecode rounded-sm bg-inset/80 px-[0.5em] py-[0.15em] font-semibold" style={fs}>{now ? formatClock(now, channel.timezone).slice(0, 5) : "--:--"}</span>}
            {(o.kind === "now_showing" || o.kind === "next_programme") && (
              <div className="bg-inset/90" style={fs}><div className="px-[0.6em] py-[0.2em] text-[0.7em] font-bold uppercase tracking-widest text-program-foreground" style={accent}>{o.kind === "now_showing" ? "Now showing" : "Up next"}</div><div className="px-[0.6em] py-[0.3em] font-semibold">Programme title</div></div>
            )}
            {o.kind === "lower_third" && (
              <div style={fs}><div className="px-[0.6em] py-[0.25em] font-bold text-program-foreground" style={accent}>{c.title || "Name"}</div><div className="bg-inset/90 px-[0.6em] py-[0.2em] text-[0.8em]">{c.subtitle || "Role"}</div></div>
            )}
            {(o.kind === "ticker" || o.kind === "breaking_news") && (
              <div className="flex items-stretch overflow-hidden bg-inset/90" style={fs}>
                <span className="shrink-0 px-[0.6em] py-[0.3em] font-bold uppercase text-program-foreground" style={accent}>{o.kind === "breaking_news" ? "Breaking" : "MOVIE MAX"}</span>
                <span className="relative flex-1 overflow-hidden whitespace-nowrap py-[0.3em]"><span className="animate-ticker inline-block" style={{ ["--ticker-duration" as string]: `${Math.max(6, 1200 / (c.speed ?? 60))}s` }}>{c.text || "Ticker text"}</span></span>
              </div>
            )}
            {(o.kind === "ad_banner" || o.kind === "station_id" || o.kind === "programme_title" || o.kind === "countdown") && (
              <span className="inline-block bg-inset/90 px-[0.6em] py-[0.3em] font-semibold" style={fs}>{c.text || o.name}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
