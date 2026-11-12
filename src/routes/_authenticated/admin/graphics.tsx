import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Radio, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables, TablesUpdate } from "@/integrations/supabase/types";
import { useStation } from "@/components/admin/station-context";
import { useNow } from "@/hooks/use-station";
import { PageHeader, EmptyState } from "@/components/admin/PageHeader";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { StatusChip } from "@/components/broadcast/status";
import { GraphicsLayer, type GraphicsReplay } from "@/components/broadcast/GraphicsLayer";
import { UpNextStudio } from "@/components/admin/UpNextStudio";
import { NewsStudio } from "@/components/admin/NewsStudio";
import { KitStudio } from "@/components/admin/KitStudio";
import { BadgeStudio } from "@/components/admin/BadgeStudio";
import type { BadgeKind } from "@/lib/badge-kits";
import { useWebPlayout } from "@/hooks/use-web-playout";
import { nextWebEntry, pickWebProgramme } from "@/lib/web-playout";
import { OPERATOR_TIMED, asConfig, isOverlayVisible, publishPatch, showNowPatch, takeOffPatch, type LiveOverlay, type OverlayConfig, type OverlayKind } from "@/lib/graphics";
import type { KitKind } from "@/lib/card-kits";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { formatTime } from "@/lib/broadcast";
import { cn } from "@/lib/utils";
import slate from "@/assets/standby-slate.jpg";

export const Route = createFileRoute("/_authenticated/admin/graphics")({ component: GraphicsPage });

type Overlay = Tables<"graphics_overlays">;
type OverlayUpdate = TablesUpdate<"graphics_overlays">;
const POSITIONS = ["top-left", "top-center", "top-right", "bottom-left", "bottom-center", "bottom-right", "bottom"];
const KIT = new Set(["ticker", "breaking_news", "ad_banner"]);
const BADGE = new Set(["now_showing", "clock", "on_air", "logo"]);
const STUDIO = new Set(["ticker", "breaking_news", "ad_banner", "lower_third", "next_programme", ...BADGE]);
const cfg = (o: Overlay): OverlayConfig => (o.config && typeof o.config === "object" && !Array.isArray(o.config) ? (o.config as OverlayConfig) : {});

function GraphicsPage() {
  const { channel, can } = useStation();
  const qc = useQueryClient();
  const canEdit = can("graphics");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, OverlayConfig>>({});
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [replay, setReplay] = useState<GraphicsReplay | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const resetDrafts = useRef(true);
  const studioNow = useNow(15_000);
  const { web } = useWebPlayout(null);

  const overlays = useQuery({
    queryKey: ["overlays", channel.id],
    queryFn: async () => (await supabase.from("graphics_overlays").select("*").eq("channel_id", channel.id).order("created_at")).data ?? [],
  });
  useEffect(() => {
    if (!overlays.data) return;
    // Full reload after Save/Publish; after "Show now" keep unsaved edits on the other graphics.
    const full = resetDrafts.current;
    resetDrafts.current = false;
    setDraft((d) => Object.fromEntries(overlays.data.map((o) => [o.id, !full && d[o.id] ? d[o.id]! : cfg(o)])));
    setEnabled((e) => Object.fromEntries(overlays.data.map((o) => [o.id, !full && o.id in e ? e[o.id]! : o.enabled])));
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
      supabase.from("graphics_overlays").update(
        publish
          ? (publishPatch(o, draft[o.id] ?? {}, enabled[o.id] ?? o.enabled, ts) as unknown as OverlayUpdate)
          : { config: (draft[o.id] ?? {}) as Json, enabled: enabled[o.id] ?? o.enabled },
      ).eq("id", o.id),
    ));
    resetDrafts.current = true;
    const err = results.find((r) => r.error)?.error;
    if (err) toast.error(err.message);
    else toast.success(publish ? `Graphics are on air now (${formatTime(ts, channel.timezone)}) — viewers see them within 15 seconds` : "Saved as draft — not on air until you publish");
    qc.invalidateQueries({ queryKey: ["overlays", channel.id] });
  }

  /** Put one graphic on air right now (restarts its timer) without touching the others. */
  async function showNow(o: Overlay) {
    const ts = new Date().toISOString();
    const { error } = await supabase.from("graphics_overlays").update(showNowPatch(draft[o.id] ?? {}, ts) as unknown as OverlayUpdate).eq("id", o.id);
    if (error) { toast.error(error.message); return; }
    setEnabled((e) => ({ ...e, [o.id]: true }));
    toast.success(`${o.name} is on air now — viewers see it within 15 seconds`);
    qc.invalidateQueries({ queryKey: ["overlays", channel.id] });
  }
  async function takeOff(o: Overlay) {
    const { error } = await supabase.from("graphics_overlays").update(takeOffPatch()).eq("id", o.id);
    if (error) { toast.error(error.message); return; }
    setEnabled((e) => ({ ...e, [o.id]: false }));
    toast.success(`${o.name} taken off air`);
    qc.invalidateQueries({ queryKey: ["overlays", channel.id] });
  }

  /** Replay the active card's appear → hold → disappear → appear in the preview. */
  function playTransition() {
    if (!active) return;
    const ms = Number(activeCfg.transition_ms) || 700;
    timers.current.forEach(clearTimeout);
    setReplay({ id: active.id, key: Date.now(), phase: "in" });
    timers.current = [
      setTimeout(() => setReplay((r) => r && { ...r, phase: "out" }), ms + 2200),
      setTimeout(() => setReplay((r) => r && { ...r, key: Date.now(), phase: "in" }), ms * 2 + 3000),
    ];
  }
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  async function uploadImage(file: File, field: "logo_url" | "image_url" = "logo_url") {
    const max = field === "logo_url" ? 2_000_000 : 5_000_000;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > max) {
      toast.error(`Use a PNG, JPG or WebP under ${max / 1_000_000} MB`);
      return;
    }
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${field === "logo_url" ? "logos" : "brand"}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("media-thumbnails").upload(path, file, { contentType: file.type });
    if (error) {
      toast.error(error.message);
      return;
    }
    setCfg({ [field]: `/api/public/thumbnails/${path}` });
    toast.success(`${field === "logo_url" ? "Logo" : "Picture"} uploaded — save or publish to apply`);
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
          <div className="p-2"><GraphicsPreview overlays={list} draft={draft} enabled={enabled} replay={replay} /></div>
        </section>

        <section className="panel h-fit">
          <div className="panel-header">{active?.name ?? "Editor"}</div>
          {active ? (
            <fieldset disabled={!canEdit} className="space-y-3 p-3 text-sm">
              <label className="block space-y-1"><span className="label-caps">Position</span><select className="field" value={activeCfg.position ?? "top-right"} onChange={(e) => setCfg({ position: e.target.value })}>{POSITIONS.map((p) => <option key={p}>{p}</option>)}</select></label>
              <label className="block space-y-1"><span className="label-caps">Size · {activeCfg.size ?? 20}% of width</span><input type="range" min={4} max={100} value={activeCfg.size ?? 20} onChange={(e) => setCfg({ size: +e.target.value })} className="w-full accent-program" /></label>
              <label className="block space-y-1"><span className="label-caps">Opacity · {Math.round((activeCfg.opacity ?? 1) * 100)}%</span><input type="range" min={0.1} max={1} step={0.05} value={activeCfg.opacity ?? 1} onChange={(e) => setCfg({ opacity: +e.target.value })} className="w-full accent-program" /></label>
              {active.kind === "lower_third" && <p className="rounded-sm border border-border bg-inset p-2 text-xs text-muted-foreground">News design, headlines, logo, transitions and timing are in the <b className="text-foreground">news branding studio</b> below.</p>}
              {active.kind === "next_programme" && <p className="rounded-sm border border-border bg-inset p-2 text-xs text-muted-foreground">Design, text, picture, transitions and timing are in the <b className="text-foreground">branding studio</b> below.</p>}
              {(KIT.has(active.kind) || BADGE.has(active.kind)) && <p className="rounded-sm border border-border bg-inset p-2 text-xs text-muted-foreground">Design, wording, logo, transitions and timing are in the <b className="text-foreground">branding studio</b> below.</p>}
              {!STUDIO.has(active.kind) && active.kind !== "clock" && active.kind !== "logo" && <label className="block space-y-1"><span className="label-caps">Accent colour</span><input type="color" className="h-8 w-full rounded-sm border border-input bg-inset" value={activeCfg.color ?? "#e5322d"} onChange={(e) => setCfg({ color: e.target.value })} /></label>}
              {["station_id", "programme_title"].includes(active.kind) && (
                <label className="block space-y-1"><span className="label-caps">{active.kind === "ticker" ? "Ticker text" : "Text"}</span><textarea className="field" rows={active.kind === "ticker" ? 3 : 1} value={activeCfg.text ?? ""} onChange={(e) => setCfg({ text: e.target.value })} maxLength={500} /></label>
              )}
              {["station_id", "programme_title"].includes(active.kind) && (
                <label className="block space-y-1"><span className="label-caps">Display duration (seconds, 0 = always)</span><input type="number" min={0} max={3600} className="field" value={activeCfg.duration ?? 0} onChange={(e) => setCfg({ duration: Math.max(0, +e.target.value) })} /></label>
              )}
              <ScheduleWindow overlay={active} />
            </fieldset>
          ) : <EmptyState title="Select an overlay" />}
        </section>
      </div>
      {active && OPERATOR_TIMED.has(active.kind as OverlayKind) && (
        <div className="px-3 pb-3"><OnAirBar overlay={active} canEdit={canEdit} onShow={() => showNow(active)} onTakeOff={() => takeOff(active)} /></div>
      )}
      {active && KIT.has(active.kind) && (
        <fieldset disabled={!canEdit} className="px-3 pb-3">
          <KitStudio
            kind={active.kind as KitKind}
            config={activeCfg}
            timezone={channel.timezone}
            onChange={setCfg}
            onUpload={(f) => uploadImage(f, "image_url")}
            onPlay={playTransition}
            enabled={!!enabled[active.id]}
            onEnable={() => { setEnabled((e) => ({ ...e, [active.id]: true })); setTimeout(playTransition, 50); }}
          />
        </fieldset>
      )}
      {active && BADGE.has(active.kind) && (
        <fieldset disabled={!canEdit} className="px-3 pb-3">
          <BadgeStudio
            kind={active.kind as BadgeKind}
            config={activeCfg}
            timezone={channel.timezone}
            programme={(studioNow != null ? pickWebProgramme(web?.bundle, studioNow)?.title : null) ?? "Programme title"}
            onChange={setCfg}
            onUpload={(f, field) => uploadImage(f, field)}
            onPlay={playTransition}
            enabled={!!enabled[active.id]}
            onEnable={() => { setEnabled((e) => ({ ...e, [active.id]: true })); setTimeout(playTransition, 50); }}
          />
        </fieldset>
      )}
      {active?.kind === "next_programme" && (
        <fieldset disabled={!canEdit} className="px-3 pb-3">
          <UpNextStudio
            config={activeCfg}
            vars={(() => {
              const next = studioNow != null ? nextWebEntry(web?.bundle, studioNow) : null;
              return { title: next?.title ?? "Next programme", startsAt: next ? Date.parse(next.starts_at) : (studioNow ?? 0) + 20 * 60_000, now: studioNow ?? 0, timezone: channel.timezone };
            })()}
            onChange={setCfg}
            onUpload={(f) => uploadImage(f, "image_url")}
            onPlay={playTransition}
            enabled={!!enabled[active.id]}
            onEnable={() => { setEnabled((e) => ({ ...e, [active.id]: true })); setTimeout(playTransition, 50); }}
          />
        </fieldset>
      )}
      {active?.kind === "lower_third" && (
        <fieldset disabled={!canEdit} className="px-3 pb-3">
          <NewsStudio
            config={activeCfg}
            timezone={channel.timezone}
            onChange={setCfg}
            onUpload={(f) => uploadImage(f, "image_url")}
            onPlay={playTransition}
            enabled={!!enabled[active.id]}
            onEnable={() => { setEnabled((e) => ({ ...e, [active.id]: true })); setTimeout(playTransition, 50); }}
          />
        </fieldset>
      )}
    </div>
  );
}

/** Operator buttons: what viewers see right now for this graphic, plus Show now / Take off air. */
function OnAirBar({ overlay, canEdit, onShow, onTakeOff }: { overlay: Overlay; canEdit: boolean; onShow: () => void; onTakeOff: () => void }) {
  const now = useNow(1000);
  const live: LiveOverlay = { id: overlay.id, kind: overlay.kind as OverlayKind, name: overlay.name, config: asConfig(overlay.published_config), show_from: overlay.show_from, show_until: overlay.show_until, published_at: overlay.published_at };
  const onAir = now != null && overlay.published_enabled && overlay.published_config != null && isOverlayVisible(live, { now, live: true, title: null, nextTitle: null, programmeStartedAt: null });
  return (
    <section className="panel flex flex-wrap items-center gap-3 px-3 py-2">
      {onAir ? <StatusChip tone="program"><span className="size-1.5 rounded-full bg-program animate-tally" />On viewers' screens now</StatusChip> : <StatusChip tone="off">Not on screen</StatusChip>}
      <span className="text-xs text-muted-foreground">Show now puts what you see in the preview on air immediately and starts its timer. Other graphics are not touched.</span>
      <div className="ml-auto flex gap-2">
        <Button type="button" size="xs" variant="program" disabled={!canEdit} onClick={onShow}><Radio className="size-3.5" />Show now</Button>
        <Button type="button" size="xs" variant="panel" disabled={!canEdit || !overlay.published_enabled} onClick={onTakeOff}><Square className="size-3.5" />Take off air</Button>
      </div>
    </section>
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

function GraphicsPreview({ overlays, draft, enabled, replay }: { overlays: Overlay[]; draft: Record<string, OverlayConfig>; enabled: Record<string, boolean>; replay: GraphicsReplay | null }) {
  const { channel } = useStation();
  const now = useNow(1000);
  const { pick, web } = useWebPlayout(now);
  if (now == null) return <div className="monitor" />;
  const next = nextWebEntry(web?.bundle, now);
  // Preview shows every enabled overlay (ignoring timing) so each one can be positioned.
  const items: LiveOverlay[] = overlays.filter((o) => enabled[o.id]).map((o) => ({ id: o.id, kind: o.kind as LiveOverlay["kind"], name: o.name, config: { ...(draft[o.id] ?? {}), duration: 0, show_mode: "cycle" }, show_from: null, show_until: null, published_at: null }));
  return (
    <div className="monitor">
      <img src={slate} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <GraphicsLayer overlays={items} timezone={channel.timezone} replay={replay} ctx={{ now, live: true, title: pick?.title ?? "Programme title", nextTitle: next?.title ?? "Next programme", nextStartsAt: next ? Date.parse(next.starts_at) : now + 20 * 60_000, programmeStartedAt: now }} />
    </div>
  );
}
