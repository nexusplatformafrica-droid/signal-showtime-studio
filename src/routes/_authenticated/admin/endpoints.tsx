import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Activity, Check, Copy, X, CircleDashed } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStation } from "@/components/admin/station-context";
import { useBroadcastStatus, useNow } from "@/hooks/use-station";
import { runStreamHealthCheck } from "@/lib/station.functions";
import type { HlsCheckStep } from "@/lib/hls-check";
import { PageHeader, EmptyState } from "@/components/admin/PageHeader";
import { StatusChip } from "@/components/broadcast/status";
import { Button } from "@/components/ui/button";
import { formatDate, formatTime, isEngineOnline, isOnAir } from "@/lib/broadcast";
import { copyText } from "@/lib/clipboard";
import { playbackUrl } from "@/lib/stream-url";

export const Route = createFileRoute("/_authenticated/admin/endpoints")({ component: EndpointsPage });

const STATUS_LABEL: Record<string, { label: string; tone: "program" | "preview" | "warn" | "off" }> = {
  on_air: { label: "On Air", tone: "program" },
  connected: { label: "Connected", tone: "preview" },
  offline: { label: "Offline", tone: "off" },
  error: { label: "Error", tone: "warn" },
  not_configured: { label: "Not configured", tone: "off" },
};

function EndpointsPage() {
  const { channel, can } = useStation();
  const qc = useQueryClient();
  const canEdit = can("settings");
  const now = useNow(5000);
  const { data: status } = useBroadcastStatus(channel.id);
  const engineOnline = now != null && isEngineOnline(status, now);
  const onAir = now != null && isOnAir(status, now);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const [form, setForm] = useState({ hls_url: channel.hls_url ?? "", streaming_provider: channel.streaming_provider ?? "", custom_domain: channel.custom_domain ?? "", website_url: channel.website_url ?? "" });

  const check = useServerFn(runStreamHealthCheck);
  const run = useMutation({
    mutationFn: () => check({ data: { channelId: channel.id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["health-checks", channel.id] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const history = useQuery({
    queryKey: ["health-checks", channel.id],
    queryFn: async () => (await supabase.from("stream_health_checks").select("id, status, checked_at, url, details").eq("channel_id", channel.id).order("checked_at", { ascending: false }).limit(20)).data ?? [],
  });
  const last = run.data ?? null;
  const lastStatus = last?.status ?? history.data?.[0]?.status ?? "not_configured";
  const inputs = useQuery({
    queryKey: ["live-inputs-ingest", channel.id],
    enabled: can("live"),
    queryFn: async () => (await supabase.from("live_inputs").select("id, name, protocol, ingest_url").eq("channel_id", channel.id)).data ?? [],
  });

  const dest = useQuery({
    queryKey: ["stream-destination", channel.id],
    enabled: can("live"),
    queryFn: async () => (await supabase.from("stream_destinations").select("id, provider, rtmp_url, stream_name, username, enabled").eq("channel_id", channel.id).maybeSingle()).data ?? null,
  });
  const [destForm, setDestForm] = useState<{ provider: string; rtmp_url: string; stream_name: string; username: string } | null>(null);
  const d = destForm ?? { provider: dest.data?.provider ?? "Wowza Streaming Engine", rtmp_url: dest.data?.rtmp_url ?? "", stream_name: dest.data?.stream_name ?? "", username: dest.data?.username ?? "" };

  async function saveDestination() {
    const rtmp = d.rtmp_url.trim();
    if (rtmp && !/^(rtmps?|srt):\/\/[^\s]+$/i.test(rtmp)) {
      toast.error("The server URL must start with rtmp://, rtmps:// or srt://");
      return;
    }
    const row = { channel_id: channel.id, provider: d.provider.trim() || "Wowza Streaming Engine", rtmp_url: rtmp || null, stream_name: d.stream_name.trim() || null, username: d.username.trim() || null, updated_at: new Date().toISOString() };
    const { error } = await supabase.from("stream_destinations").upsert(row, { onConflict: "channel_id" });
    if (error) toast.error(error.message);
    else {
      toast.success("Broadcast destination saved");
      setDestForm(null);
      qc.invalidateQueries({ queryKey: ["stream-destination", channel.id] });
    }
  }

  async function save() {
    const hls = form.hls_url.trim();
    if (hls && !/^https?:\/\/.+\.m3u8(\?.*)?$/i.test(hls)) {
      toast.error("The HLS URL must be an http:// or https:// address ending in .m3u8");
      return;
    }
    const domain = form.custom_domain.trim().toLowerCase();
    if (domain && !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
      toast.error("Enter a domain like tv.mydomain.com");
      return;
    }
    const { error } = await supabase.from("channels").update({ hls_url: hls || null, streaming_provider: form.streaming_provider.trim() || null, custom_domain: domain || null, website_url: form.website_url.trim() || null }).eq("id", channel.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Streaming endpoints saved");
      qc.invalidateQueries({ queryKey: ["channel"] });
    }
  }

  const site = (channel.website_url || (channel.custom_domain ? `https://${channel.custom_domain}` : origin)).replace(/\/$/, "");
  const delivered = lastStatus === "on_air";
  const publicHls = playbackUrl(channel.hls_url, channel.slug, site);
  const relayed = !!channel.hls_url && publicHls !== channel.hls_url;
  const checklist = [
    { ok: engineOnline, label: "Playout engine connected (heartbeat within 30 s)" },
    { ok: !!channel.hls_url, label: "Public HLS master playlist URL configured" },
    { ok: lastStatus === "connected" || lastStatus === "on_air", label: "Stream health check passing" },
    { ok: onAir && lastStatus === "on_air", label: "Engine reports ON AIR and stream verified" },
  ];

  return (
    <div>
      <PageHeader title="Streaming Endpoints" description="Public stream links, ingest addresses and stream validation." actions={
        <>
          <StatusChip tone={STATUS_LABEL[lastStatus]?.tone ?? "off"}>{STATUS_LABEL[lastStatus]?.label ?? lastStatus}</StatusChip>
          <Button size="xs" variant="brand" disabled={run.isPending || !can("endpoints")} onClick={() => run.mutate()}><Activity />{run.isPending ? "Testing stream…" : "Test stream"}</Button>
        </>
      } />
      <div className="grid gap-3 p-3 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-3">
          <section className="panel">
            <div className="panel-header">Public endpoints</div>
            <EndpointRow label="Public HLS stream (.m3u8)" value={publicHls} hint="Use in VLC, Android Media3/ExoPlayer, Smart TV apps and HLS.js." />
            {relayed && <EndpointRow label="Origin stream (http)" value={channel.hls_url} hint="Your provider's direct link. The secure link above relays it so https websites can play it." />}
            <EndpointRow label="Public live TV player" value={site ? `${site}/watch` : null} />
            <EndpointRow label="Channel website" value={site || null} />
            <EndpointRow label="TV guide" value={site ? `${site}/guide` : null} />
            {!delivered && <div className="border-t border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn">The public stream link is not delivered yet. It only counts as working once a health check passes while the engine reports ON AIR.</div>}
          </section>

          <section className="panel">
            <div className="panel-header">Private ingest (never public)</div>
            {!can("live") && <EmptyState title="Restricted to broadcast operators" />}
            {can("live") && !inputs.data?.length && <EmptyState title="No live inputs">Create one in Live Inputs to get RTMP/RTMPS/SRT credentials.</EmptyState>}
            {inputs.data?.map((i) => <EndpointRow key={i.id} label={`${i.name} · ${i.protocol.toUpperCase()}`} value={i.ingest_url} hint="Stream key is shown in Live Inputs." />)}
          </section>

          <section className="panel">
            <div className="panel-header">Stream health check</div>
            {!last && <EmptyState title="Run a test">The checker fetches the master playlist, a rendition playlist and the latest segment, then confirms new segments are being produced.</EmptyState>}
            {last && (
              <div className="divide-y divide-border/60">
                {last.steps.map((s: HlsCheckStep) => (
                  <div key={s.id} className="flex items-start gap-2 px-3 py-1.5 text-xs">
                    {s.ok ? <Check className="mt-0.5 size-3.5 text-preview" /> : <X className="mt-0.5 size-3.5 text-program" />}
                    <span className="w-56 shrink-0">{s.label}</span><span className="min-w-0 break-all text-muted-foreground">{s.detail}</span>
                  </div>
                ))}
                <div className="flex flex-wrap gap-4 px-3 py-2 text-xs text-muted-foreground">
                  <span>Resolution <span className="timecode text-foreground">{last.resolution ?? "—"}</span></span>
                  <span>Target duration <span className="timecode text-foreground">{last.targetDuration ?? "—"}s</span></span>
                  <span>Latency <span className="timecode text-foreground">{last.latencyMs ?? "—"} ms</span></span>
                  <span>Engine on air <span className="text-foreground">{last.engineOnAir ? "yes" : "no"}</span></span>
                </div>
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-header">Check history</div>
            <table className="data-table w-full"><tbody>
              {history.data?.map((h) => (
                <tr key={h.id}><td className="timecode w-40 text-muted-foreground">{formatDate(h.checked_at, channel.timezone)} {formatTime(h.checked_at, channel.timezone)}</td><td className="w-32"><StatusChip tone={STATUS_LABEL[h.status]?.tone ?? "off"}>{STATUS_LABEL[h.status]?.label ?? h.status}</StatusChip></td><td className="max-w-0 truncate text-muted-foreground">{h.url || "—"}</td></tr>
              ))}
            </tbody></table>
            {!history.data?.length && <EmptyState title="No checks yet" />}
          </section>
        </div>

        <div className="space-y-3">
          <section className="panel">
            <div className="panel-header">Delivery checklist</div>
            <div className="space-y-1.5 p-3 text-xs">
              {checklist.map((c) => <div key={c.label} className="flex items-start gap-2">{c.ok ? <Check className="mt-0.5 size-3.5 text-preview" /> : <CircleDashed className="mt-0.5 size-3.5 text-muted-foreground" />}<span className={c.ok ? "" : "text-muted-foreground"}>{c.label}</span></div>)}
            </div>
          </section>
          <section className="panel">
            <div className="panel-header">Configuration</div>
            <fieldset disabled={!canEdit} className="space-y-3 p-3 text-sm">
              <label className="block space-y-1"><span className="label-caps">Public HLS master playlist URL</span><input className="field" placeholder="http(s)://…/playlist.m3u8 from your provider" value={form.hls_url} onChange={(e) => setForm({ ...form, hls_url: e.target.value })} /></label>
              <label className="block space-y-1"><span className="label-caps">Streaming provider / destination</span><input className="field" placeholder="e.g. Cloudflare Stream" value={form.streaming_provider} onChange={(e) => setForm({ ...form, streaming_provider: e.target.value })} /></label>
              <label className="block space-y-1"><span className="label-caps">Custom stream domain</span><input className="field" placeholder="tv.mydomain.com" value={form.custom_domain} onChange={(e) => setForm({ ...form, custom_domain: e.target.value })} /></label>
              <label className="block space-y-1"><span className="label-caps">Public website URL (after publishing)</span><input className="field" placeholder={origin} value={form.website_url} onChange={(e) => setForm({ ...form, website_url: e.target.value })} /></label>
              <Button type="button" size="sm" variant="brand" onClick={save}>Save endpoints</Button>
              <p className="text-[11px] text-muted-foreground">For a custom stream domain, create a CNAME record at your DNS provider pointing to your streaming provider's hostname; HTTPS certificates are issued by that provider.</p>
            </fieldset>
          </section>
          <section className="panel">
            <div className="panel-header">Broadcast destination (playout engine → provider)</div>
            {!can("live") ? <EmptyState title="Restricted to broadcast operators" /> : (
              <fieldset disabled={!canEdit} className="space-y-3 p-3 text-sm">
                <label className="block space-y-1"><span className="label-caps">Provider</span><input className="field" value={d.provider} onChange={(e) => setDestForm({ ...d, provider: e.target.value })} /></label>
                <label className="block space-y-1"><span className="label-caps">Server URL</span><input className="field" placeholder="rtmp://host:1935/application" value={d.rtmp_url} onChange={(e) => setDestForm({ ...d, rtmp_url: e.target.value })} /></label>
                <label className="block space-y-1"><span className="label-caps">Stream name / key</span><input className="field" value={d.stream_name} onChange={(e) => setDestForm({ ...d, stream_name: e.target.value })} /></label>
                <label className="block space-y-1"><span className="label-caps">Username (if required)</span><input className="field" value={d.username} onChange={(e) => setDestForm({ ...d, username: e.target.value })} /></label>
                <Button type="button" size="sm" variant="brand" onClick={saveDestination}>Save destination</Button>
                <p className="text-[11px] text-muted-foreground">The playout engine reads this from its config and pushes the channel here. A publish password, if your provider uses one, is entered only on the engine server.</p>
              </fieldset>
            )}
          </section>
          <section className="panel">
            <div className="panel-header">Using the stream in players</div>
            <ul className="space-y-1.5 p-3 text-xs text-muted-foreground">
              <li><span className="text-foreground">VLC:</span> Media → Open Network Stream → paste the HLS URL.</li>
              <li><span className="text-foreground">Android Media3:</span> MediaItem.fromUri(hlsUrl) with HlsMediaSource.</li>
              <li><span className="text-foreground">Web:</span> hls.js (Chrome/Firefox) or native video (Safari/iOS).</li>
              <li><span className="text-foreground">Smart TV:</span> use the HLS URL in the platform's native player.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function EndpointRow({ label, value, hint }: { label: string; value: string | null | undefined; hint?: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2 text-xs last:border-b-0">
      <div className="w-52 shrink-0"><div className="font-medium">{label}</div>{hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}</div>
      <code className="timecode min-w-0 flex-1 truncate rounded-sm border border-input bg-inset px-2 py-1">{value || "Not configured"}</code>
      <Button size="icon-sm" variant="panel" disabled={!value} aria-label={`Copy ${label}`} onClick={() => value && copyText(value, `${label} copied`)}><Copy /></Button>
    </div>
  );
}
