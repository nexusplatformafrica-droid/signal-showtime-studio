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
import { GraphicsLayer } from "@/components/broadcast/GraphicsLayer";
import { useWebPlayout } from "@/hooks/use-web-playout";
import type { LiveOverlay } from "@/lib/graphics";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { formatTime } from "@/lib/broadcast";
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
  // Compare what is in the editor with what is actually on air.
  const unpublished = list.some((o) => JSON.stringify(draft[o.id] ?? {}) !== JSON.stringify(o.published_config ?? null) || (enabled[o.id] ?? o.enabled) !== o.published_enabled);

  async function save(publish: boolean) {
    const ts = new Date().toISOString();
    const results = await Promise.all(list.map((o) =>
      supabase.from("graphics_overlays").update({ config: (draft[o.id] ?? {}) as Json, enabled: enabled[o.id] ?? o.enabled, ...(publish ? { published_at: ts, published_config: (draft[o.id] ?? {}) as Json, published_enabled: enabled[o.id] ?? o.enabled } : {}) }).eq("id", o.id),
    ));
    const err = results.find((r) => r.error)?.error;
    if (err) toast.error(err.message);
    else toast.success(publish ? `Graphics are on air now (${formatTime(ts, channel.timezone)}) — viewers see them within 15 seconds` : "Saved as draft — not on air until you publish");
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
      <PageHeader title="Graphics" description="Published graphics appear over the live picture on the website and on the output page you send to Wowza." actions={
        <>
          {unpublished && <StatusChip tone="warn">Unpublished changes</StatusChip>}
          <Button size="xs" variant="panel" disabled={!canEdit || !dirty} onClick={() => save(false)}>Save draft</Button>
          <ConfirmButton size="xs" variant="brand" disabled={!canEdit} title="Publish graphics to air?" description="Enabled overlays go on air for every viewer within 15 seconds." confirmLabel="Publish" onConfirm={() => save(true)}>Publish to output</ConfirmButton>
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
          <div className="panel-header">Preview<span className="normal-case tracking-normal">exactly how it looks on air · drafts included</span></div>
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
  const { pick } = useWebPlayout(now);
  if (now == null) return <div className="monitor" />;
  // Preview shows every enabled overlay (ignoring timing) so each one can be positioned.
  const items: LiveOverlay[] = overlays.filter((o) => enabled[o.id]).map((o) => ({ id: o.id, kind: o.kind as LiveOverlay["kind"], name: o.name, config: { ...(draft[o.id] ?? {}), duration: 0 }, show_from: null, show_until: null, published_at: null }));
  return (
    <div className="monitor">
      <img src={slate} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <GraphicsLayer overlays={items} timezone={channel.timezone} ctx={{ now, live: true, title: pick?.title ?? "Programme title", nextTitle: "Next programme", programmeStartedAt: now }} />
    </div>
  );
}
