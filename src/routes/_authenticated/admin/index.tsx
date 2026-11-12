import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarRange, Clapperboard, Radio, RotateCcw, Siren, Upload, PlayCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { playbackUrl } from "@/lib/stream-url";
import { useStation } from "@/components/admin/station-context";
import { useBroadcastStatus, useNow, useRealtimeInvalidate } from "@/hooks/use-station";
import { useMediaIndex, useScheduleRange } from "@/hooks/use-schedule";
import { useIssueCommand } from "@/hooks/use-commands";
import { detectScheduleIssues, findNowNext, formatBytes, formatDate, formatDuration, formatTime, isEngineOnline, isOnAir, toZoned, zonedToUtc, VIEWER_ACTIVE_MS } from "@/lib/broadcast";
import { Metric, OnAirBadge, StatusChip, Tally } from "@/components/broadcast/status";
import { HlsPlayer } from "@/components/broadcast/HlsPlayer";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/admin/PageHeader";
import slate from "@/assets/standby-slate.jpg";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: Overview,
});

function Overview() {
  const { channel, can } = useStation();
  const now = useNow(1000);
  const tz = channel.timezone;
  const { data: status } = useBroadcastStatus(channel.id);
  const onAir = now != null && isOnAir(status, now);
  const online = now != null && isEngineOnline(status, now);
  const issue = useIssueCommand();

  // Stable windows (minute resolution) so queries don't refetch every tick.
  const minute = Math.floor((now ?? 0) / 60000);
  const from = useMemo(() => new Date(minute * 60000 - 12 * 3600_000).toISOString(), [minute]);
  const to = useMemo(() => new Date(minute * 60000 + 48 * 3600_000).toISOString(), [minute]);
  const schedule = useScheduleRange(channel.id, from, to);
  const entries = schedule.data ?? [];
  const mediaIndex = useMediaIndex(entries.map((e) => e.media_id).filter(Boolean) as string[]);
  const published = entries.filter((e) => e.status === "published");
  const { next } = findNowNext(published, now ?? 0);
  const upcoming = published.filter((e) => +new Date(e.starts_at) > (now ?? 0)).slice(0, 8);
  const issues = useMemo(() => {
    const future = entries.filter((e) => +new Date(e.ends_at) > (now ?? 0));
    return detectScheduleIssues(future, { ...(mediaIndex.data ? { media: mediaIndex.data } : {}), windowStart: new Date(minute * 60000).toISOString(), windowEnd: to });
  }, [entries, mediaIndex.data, minute, to, now]);

  useRealtimeInvalidate("broadcast_events", [["events-recent", channel.id]], `channel_id=eq.${channel.id}`);
  const events = useQuery({
    queryKey: ["events-recent", channel.id],
    queryFn: async () => {
      const { data } = await supabase.from("broadcast_events").select("*").eq("channel_id", channel.id).order("occurred_at", { ascending: false }).limit(60);
      return data ?? [];
    },
  });
  const aired = (events.data ?? []).filter((e) => e.event_type === "programme_started").slice(0, 6);
  const alerts = (events.data ?? []).filter((e) => e.severity !== "info").slice(0, 6);
  const lastInterruption = (events.data ?? []).find((e) => ["programme_interrupted", "live_input_connected", "emergency_takeover", "encoder_error"].includes(e.event_type));

  const stats = useQuery({
    queryKey: ["overview-stats", channel.id],
    refetchInterval: 30000,
    queryFn: async () => {
      const todayLocal = toZoned(new Date(), tz).date;
      const dayStart = zonedToUtc(todayLocal, "00:00", tz).toISOString();
      const [live, today, media, inputs] = await Promise.all([
        supabase.from("viewer_sessions").select("id", { count: "exact", head: true }).eq("channel_id", channel.id).gte("last_seen_at", new Date(Date.now() - VIEWER_ACTIVE_MS).toISOString()),
        supabase.from("viewer_sessions").select("id", { count: "exact", head: true }).eq("channel_id", channel.id).gte("last_seen_at", dayStart),
        supabase.from("media_assets").select("file_size").eq("channel_id", channel.id).limit(5000),
        can("live") ? supabase.from("live_inputs").select("id, name, connected").eq("channel_id", channel.id) : Promise.resolve({ data: [] as { id: string; name: string; connected: boolean }[] }),
      ]);
      return {
        live: live.count ?? 0,
        today: today.count ?? 0,
        storage: (media.data ?? []).reduce((a, m) => a + (m.file_size ?? 0), 0),
        assets: media.data?.length ?? 0,
        inputs: inputs.data ?? [],
      };
    },
  });

  const pos = Number(status?.position_seconds ?? 0);
  const dur = Number(status?.duration_seconds ?? 0);
  const pct = onAir && dur > 0 ? Math.min(100, (pos / dur) * 100) : 0;
  const nextIn = next && now ? (+new Date(next.starts_at) - now) / 1000 : null;
  const activeInput = stats.data?.inputs.find((i) => i.id === status?.active_live_input_id) ?? stats.data?.inputs.find((i) => i.connected);
  const heartbeatAge = status?.last_heartbeat_at && now ? Math.round((now - +new Date(status.last_heartbeat_at)) / 1000) : null;

  return (
    <div className="space-y-3 p-3">
      {/* Quick actions */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Button asChild size="xs" variant="program" disabled={!can("live")}><Link to="/admin/live"><Radio />Go live</Link></Button>
        <Button asChild size="xs" variant="panel"><Link to="/admin/control"><Clapperboard />Take control</Link></Button>
        <ConfirmButton size="xs" variant="panel" disabled={!can("control")} title="Return to automation" description="The playout engine will leave the current live/manual source and resume the published schedule." onConfirm={() => issue.mutateAsync({ command: "return_to_schedule" }).then(() => undefined)}>
          <RotateCcw />Return to automation
        </ConfirmButton>
        <ConfirmButton size="xs" variant="warn" disabled={!can("emergency")} destructive typeToConfirm="EMERGENCY" confirmLabel="Execute takeover" title="Emergency broadcast" description="This immediately replaces the broadcast for every viewer with the emergency source configured in the Control Room." onConfirm={() => issue.mutateAsync({ command: "emergency_takeover", payload: { source: "standby" } }).then(() => undefined)}>
          <Siren />Emergency
        </ConfirmButton>
        <span className="mx-1 h-5 w-px bg-border" />
        <Button asChild size="xs" variant="ghost"><Link to="/admin/control"><PlayCircle />Open playout</Link></Button>
        <Button asChild size="xs" variant="ghost"><Link to="/admin/schedule"><CalendarRange />Edit schedule</Link></Button>
        <Button asChild size="xs" variant="ghost"><Link to="/admin/media"><Upload />Upload media</Link></Button>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        {/* Program */}
        <section className="panel">
          <div className="panel-header"><span className="flex items-center gap-2">Program output <OnAirBadge onAir={onAir} engineOnline={online} /></span><span className="timecode normal-case tracking-normal">{status?.output_resolution ?? "—"} · {status?.output_bitrate_kbps ? `${(status.output_bitrate_kbps / 1000).toFixed(1)} Mbps` : "—"}</span></div>
          <div className="grid gap-0 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <div className="monitor m-2 md:mr-0" data-tally={onAir ? "program" : undefined}>
              {onAir && channel.hls_url ? (
                <HlsPlayer src={playbackUrl(channel.hls_url, channel.slug)} poster={slate} controls={false} />
              ) : (
                <div className="absolute inset-0">
                  <img src={slate} alt="" className="h-full w-full object-cover opacity-30" />
                  <div className="absolute inset-0 grid place-items-center text-center">
                    <div>
                      <div className="label-caps">{online ? "Engine online — not on air" : "No signal from playout engine"}</div>
                      {!online && <Link to="/admin/settings" search={{ tab: "engine" }} className="mt-1 inline-block text-xs text-info hover:underline">Connect the playout engine</Link>}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-col p-3">
              <div className="label-caps">Now on air</div>
              <div className="mt-1 line-clamp-2 font-display text-lg font-bold leading-tight">{onAir ? status?.current_title ?? "Untitled" : "—"}</div>
              <div className="mt-1 text-xs text-muted-foreground">{onAir ? `Source: ${status?.source}` : "The channel is not broadcasting."}</div>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-inset"><div className="h-full bg-program transition-[width]" style={{ width: `${pct}%` }} /></div>
              <div className="timecode mt-1 flex justify-between text-[11px] text-muted-foreground"><span>{onAir ? formatDuration(pos) : "--:--"}</span><span>{onAir && dur ? `-${formatDuration(dur - pos)}` : "--:--"}</span></div>
              <div className="mt-auto border-t border-border pt-3">
                <div className="label-caps">Next scheduled</div>
                {next ? (
                  <>
                    <div className="mt-1 truncate text-sm font-semibold">{next.title}</div>
                    <div className="timecode text-[11px] text-muted-foreground">{formatTime(next.starts_at, tz)} · in <span className="text-foreground">{nextIn != null ? formatDuration(nextIn) : "—"}</span></div>
                  </>
                ) : <div className="mt-1 text-xs text-muted-foreground">Nothing published in the next 48 hours.</div>}
              </div>
            </div>
          </div>
        </section>

        {/* Health */}
        <section className="panel">
          <div className="panel-header">Station health</div>
          <div className="grid grid-cols-2 divide-x divide-y divide-border/70 border-b border-border sm:grid-cols-3">
            <Metric label="Watching now" value={stats.data?.live ?? "—"} sub="active players · 60s" />
            <Metric label="Viewers today" value={stats.data?.today ?? "—"} sub="unique sessions" />
            <Metric label="Engine" value={online ? "Online" : "Offline"} tone={online ? "preview" : undefined} sub={heartbeatAge != null ? `heartbeat ${heartbeatAge}s ago` : "never connected"} />
            <Metric label="Resolution" value={status?.output_resolution ?? "—"} sub={status?.output_fps ? `${status.output_fps} fps` : "reported by engine"} />
            <Metric label="Encoder" value={status?.encoder_status ?? "—"} sub={status?.destination_status ? `output ${status.destination_status}` : "no output data"} />
            <Metric label="Media storage" value={formatBytes(stats.data?.storage)} sub={`${stats.data?.assets ?? 0} assets`} />
            <Metric label="Live input" value={activeInput?.name ?? "None"} tone={activeInput?.connected ? "preview" : undefined} sub={activeInput ? (activeInput.connected ? "connected" : "idle") : "no input connected"} />
            <Metric label="Last interruption" value={lastInterruption ? formatTime(lastInterruption.occurred_at, tz) : "—"} sub={lastInterruption?.message ?? "none recorded"} />
            <Metric label="Last error" value={status?.last_error ? "Reported" : "None"} tone={status?.last_error ? "warn" : undefined} sub={status?.last_error ?? "engine reports no errors"} />
          </div>
        </section>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <section className="panel lg:col-span-1">
          <div className="panel-header">Upcoming programmes<Link to="/admin/schedule" className="normal-case tracking-normal text-info hover:underline">Schedule</Link></div>
          {upcoming.length ? (
            <table className="data-table w-full"><tbody>
              {upcoming.map((e) => (
                <tr key={e.id}><td className="timecode w-14 text-muted-foreground">{formatTime(e.starts_at, tz)}</td><td className="truncate">{e.title}</td><td className="w-20 text-right text-[11px] text-muted-foreground">{formatDate(e.starts_at, tz, { weekday: "short" })}</td></tr>
              ))}
            </tbody></table>
          ) : <EmptyState title="No published programmes">Create and publish programmes in the Schedule.</EmptyState>}
        </section>

        <section className="panel">
          <div className="panel-header">Schedule warnings · 48h<span className="normal-case tracking-normal">{issues.length}</span></div>
          <div className="max-h-[280px] overflow-y-auto">
            {issues.length === 0 && <EmptyState title="No conflicts detected" />}
            {issues.slice(0, 30).map((i, idx) => (
              <div key={idx} className="flex items-start gap-2 border-b border-border/60 px-3 py-1.5 text-xs">
                <AlertTriangle className={i.severity === "error" ? "mt-0.5 size-3.5 shrink-0 text-program" : "mt-0.5 size-3.5 shrink-0 text-warn"} />
                <span className="timecode w-16 shrink-0 text-muted-foreground">{formatDate(i.at, tz, { weekday: "short" })} {formatTime(i.at, tz)}</span>
                <span className="min-w-0">{i.message}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">Recently aired · alerts</div>
          <div className="max-h-[280px] overflow-y-auto">
            {aired.length === 0 && alerts.length === 0 && <EmptyState title="No broadcast history yet">The playout engine reports aired programmes and alerts here.</EmptyState>}
            {aired.map((e) => (
              <div key={e.id} className="flex items-center gap-2 border-b border-border/60 px-3 py-1.5 text-xs"><Tally tone="preview" /><span className="timecode w-12 text-muted-foreground">{formatTime(e.occurred_at, tz)}</span><span className="truncate">{e.message}</span></div>
            ))}
            {alerts.map((e) => (
              <div key={e.id} className="flex items-center gap-2 border-b border-border/60 px-3 py-1.5 text-xs"><StatusChip tone={e.severity === "warning" ? "warn" : "program"}>{e.severity}</StatusChip><span className="timecode w-12 text-muted-foreground">{formatTime(e.occurred_at, tz)}</span><span className="truncate">{e.message}</span></div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
