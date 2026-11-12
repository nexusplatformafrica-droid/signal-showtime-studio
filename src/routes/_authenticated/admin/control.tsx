import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FastForward, Pause, Play, Radio, RotateCcw, Siren, Square, Tv, Unplug, ArrowRightLeft, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStation } from "@/components/admin/station-context";
import { useBroadcastStatus, useNow, useRealtimeInvalidate } from "@/hooks/use-station";
import { useScheduleRange } from "@/hooks/use-schedule";
import { COMMAND_LABELS, useIssueCommand, type CommandType } from "@/hooks/use-commands";
import { findNowNext, formatClock, formatDuration, formatTime, isEngineOnline, isOnAir } from "@/lib/broadcast";
import { getMediaPlaybackUrl } from "@/lib/station.functions";
import { HlsPlayer } from "@/components/broadcast/HlsPlayer";
import { OnAirBadge, StatusChip, Tally } from "@/components/broadcast/status";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { PageHeader, EmptyState } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import slate from "@/assets/standby-slate.jpg";

export const Route = createFileRoute("/_authenticated/admin/control")({ component: ControlRoom });

type PreviewSource = { kind: "schedule" } | { kind: "live"; id: string } | { kind: "standby" };

function ControlRoom() {
  const { channel, can } = useStation();
  const tz = channel.timezone;
  const now = useNow(500);
  const { data: status } = useBroadcastStatus(channel.id);
  const onAir = now != null && isOnAir(status, now);
  const online = now != null && isEngineOnline(status, now);
  const issue = useIssueCommand();
  const allowed = can("control");
  const [preview, setPreview] = useState<PreviewSource>({ kind: "schedule" });

  const minute = Math.floor((now ?? 0) / 60000);
  const from = useMemo(() => new Date(minute * 60000 - 3600_000).toISOString(), [minute]);
  const to = useMemo(() => new Date(minute * 60000 + 24 * 3600_000).toISOString(), [minute]);
  const { data: entries = [] } = useScheduleRange(channel.id, from, to, { publishedOnly: true });
  const { current, next } = findNowNext(entries, now ?? 0);

  useRealtimeInvalidate("live_inputs", [["live-inputs", channel.id]], `channel_id=eq.${channel.id}`);
  const inputs = useQuery({
    queryKey: ["live-inputs", channel.id],
    queryFn: async () => {
      const { data } = await supabase.from("live_inputs").select("id, name, protocol, connected, bitrate_kbps, resolution, fps, audio_ok, last_seen_at, enabled").eq("channel_id", channel.id).order("created_at");
      return data ?? [];
    },
  });

  useRealtimeInvalidate("broadcast_commands", [["commands", channel.id]], `channel_id=eq.${channel.id}`);
  const commands = useQuery({
    queryKey: ["commands", channel.id],
    queryFn: async () => {
      const { data } = await supabase.from("broadcast_commands").select("*").eq("channel_id", channel.id).order("created_at", { ascending: false }).limit(25);
      return data ?? [];
    },
  });
  useRealtimeInvalidate("broadcast_events", [["events", channel.id]], `channel_id=eq.${channel.id}`);
  const events = useQuery({
    queryKey: ["events", channel.id],
    queryFn: async () => {
      const { data } = await supabase.from("broadcast_events").select("*").eq("channel_id", channel.id).order("occurred_at", { ascending: false }).limit(50);
      return data ?? [];
    },
  });

  const previewMediaId = preview.kind === "schedule" ? next?.media_id : preview.kind === "standby" ? channel.standby_media_id : null;
  const signUrl = useServerFn(getMediaPlaybackUrl);
  const previewUrl = useQuery({
    queryKey: ["preview-url", previewMediaId],
    enabled: !!previewMediaId,
    staleTime: 30 * 60_000,
    queryFn: () => signUrl({ data: { mediaId: previewMediaId! } }),
  });
  const previewInput = preview.kind === "live" ? inputs.data?.find((i) => i.id === preview.id) : null;

  const send = (command: CommandType, payload: Record<string, string | number | boolean | null> = {}) => issue.mutateAsync({ command, payload }).then(() => undefined);

  const take = () => {
    if (preview.kind === "live" && previewInput) return send("take_live", { live_input_id: previewInput.id });
    if (preview.kind === "standby") return send("play_standby");
    return send("switch_source", { source: "schedule" });
  };

  // Keyboard shortcuts (ignored while typing)
  useEffect(() => {
    if (!allowed) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]")) return;
      const map: Record<string, () => void> = { F5: () => send("play"), F6: () => send("pause"), F8: () => send("skip"), F9: () => void take(), F10: () => send("return_to_schedule") };
      if (map[e.key]) {
        e.preventDefault();
        map[e.key]();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, preview, previewInput]);

  const pos = Number(status?.position_seconds ?? 0);
  const dur = Number(status?.duration_seconds ?? 0);
  const pct = onAir && dur > 0 ? Math.min(100, (pos / dur) * 100) : 0;

  return (
    <div>
      <PageHeader title="Control Room" description="Preview → Program. Commands are executed by the playout engine and confirmed back here." actions={
        <>
          {!online && <StatusChip tone="warn">Engine offline — commands will expire after 2 min</StatusChip>}
          {!allowed && <StatusChip tone="off">View only</StatusChip>}
          <span className="timecode text-sm font-semibold">{now ? formatClock(now, tz) : "--:--:--"}</span>
        </>
      } />
      <div className="grid gap-3 p-3 2xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-2">
            {/* PREVIEW */}
            <section className="panel">
              <div className="panel-header"><span className="flex items-center gap-2"><Tally tone="preview" />Preview</span>
                <span className="normal-case tracking-normal">{preview.kind === "schedule" ? "Next scheduled" : preview.kind === "standby" ? "Standby" : previewInput?.name}</span></div>
              <div className="monitor m-2" data-tally="preview">
                {preview.kind === "live" ? (
                  <div className="absolute inset-0 grid place-items-center text-center">
                    <div>
                      <div className="label-caps">{previewInput?.connected ? "Live input connected" : "Waiting for live input"}</div>
                      <div className="timecode mt-1 text-xs text-muted-foreground">{previewInput?.resolution ?? "—"} · {previewInput?.fps ?? "—"} fps · {previewInput?.bitrate_kbps ? `${previewInput.bitrate_kbps} kbps` : "—"} · audio {previewInput?.audio_ok == null ? "—" : previewInput.audio_ok ? "ok" : "missing"}</div>
                      <div className="mt-2 max-w-xs text-[11px] text-muted-foreground">Input video is monitored on the playout engine; stats above are reported by the engine.</div>
                    </div>
                  </div>
                ) : previewUrl.data?.url ? (
                  <video key={previewUrl.data.url} src={previewUrl.data.url} className="h-full w-full object-contain" controls muted playsInline preload="metadata" />
                ) : (
                  <div className="absolute inset-0 grid place-items-center">
                    <img src={(preview.kind === "schedule" ? next?.thumbnail_url : null) ?? slate} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
                    <div className="relative label-caps">{preview.kind === "schedule" ? (next ? next.title : "Nothing scheduled next") : channel.standby_media_id ? "Standby media (storage not connected)" : "No standby media set"}</div>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-1 border-t border-border p-2">
                <SourceBtn active={preview.kind === "schedule"} onClick={() => setPreview({ kind: "schedule" })}>Schedule</SourceBtn>
                <SourceBtn active={preview.kind === "standby"} onClick={() => setPreview({ kind: "standby" })}>Standby</SourceBtn>
                {inputs.data?.map((i) => (
                  <SourceBtn key={i.id} active={preview.kind === "live" && preview.id === i.id} onClick={() => setPreview({ kind: "live", id: i.id })}>
                    <Tally tone={i.connected ? "preview" : "off"} />{i.name}
                  </SourceBtn>
                ))}
              </div>
            </section>

            {/* PROGRAM */}
            <section className="panel">
              <div className="panel-header"><span className="flex items-center gap-2"><Tally tone={onAir ? "program" : "off"} pulse={onAir} />Program</span><OnAirBadge onAir={onAir} engineOnline={online} /></div>
              <div className="monitor m-2" data-tally={onAir ? "program" : undefined}>
                {onAir && channel.hls_url ? <HlsPlayer src={channel.hls_url} poster={slate} /> : (
                  <div className="absolute inset-0 grid place-items-center text-center">
                    <img src={slate} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
                    <div className="relative">
                      <div className="label-caps">{!online ? "No signal — playout engine offline" : !onAir ? "Engine online · off air" : "No public HLS URL configured"}</div>
                    </div>
                  </div>
                )}
              </div>
              <div className="border-t border-border p-2">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="truncate text-sm font-semibold">{onAir ? status?.current_title ?? "Untitled" : "—"}</div>
                  <div className="timecode text-xs text-muted-foreground">{onAir ? `${formatDuration(pos)} / ${formatDuration(dur)}` : "--:-- / --:--"}</div>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-inset"><div className="h-full bg-program" style={{ width: `${pct}%` }} /></div>
              </div>
            </section>
          </div>

          {/* CONTROLS */}
          <section className="panel">
            <div className="panel-header">Broadcast controls<span className="normal-case tracking-normal">F5 play · F6 pause · F8 skip · F9 take · F10 automation</span></div>
            <div className="flex flex-wrap items-center gap-1.5 p-2">
              <Button size="sm" variant="panel" disabled={!allowed} onClick={() => send("play")}><Play />Play</Button>
              <Button size="sm" variant="panel" disabled={!allowed} onClick={() => send("pause")}><Pause />Pause</Button>
              <ConfirmButton size="sm" variant="panel" disabled={!allowed} title="Stop playout" description="Stopping takes the channel off air for every viewer until playout is restarted." confirmLabel="Stop" destructive onConfirm={() => send("stop")}><Square />Stop</ConfirmButton>
              <Button size="sm" variant="panel" disabled={!allowed} onClick={() => send("skip")}><FastForward />Skip</Button>
              <span className="mx-1 h-6 w-px bg-border" />
              <ConfirmButton size="sm" variant="program" disabled={!allowed || (preview.kind === "live" && !previewInput?.connected)} title="Take preview to air" description={preview.kind === "live" ? `Interrupt scheduled programming and put "${previewInput?.name}" on air.` : preview.kind === "standby" ? "Replace the current programme with standby content." : "Switch the output to the scheduled programme."} confirmLabel="Take" onConfirm={take}>
                <ArrowRightLeft />Take
              </ConfirmButton>
              <Button size="sm" variant="panel" disabled={!allowed} onClick={() => send("end_live")}><Unplug />End live</Button>
              <Button size="sm" variant="preview" disabled={!allowed} onClick={() => send("return_to_schedule")}><RotateCcw />Return to schedule</Button>
              <Button size="sm" variant="panel" disabled={!allowed} onClick={() => send("play_standby")}><Tv />Play standby</Button>
              <Button size="sm" variant="ghost" disabled={!allowed} onClick={() => send("reload_schedule")}><RefreshCw />Reload schedule</Button>
              <div className="flex-1" />
              <ConfirmButton size="sm" variant="warn" disabled={!can("emergency")} destructive typeToConfirm="EMERGENCY" confirmLabel="Execute takeover" title="Emergency takeover" description="Immediately replaces the broadcast for all viewers with the emergency/standby source. Only Super Admins and Station Managers can do this." onConfirm={() => send("emergency_takeover", { source: preview.kind === "live" && previewInput ? "live" : "standby", live_input_id: previewInput?.id ?? null })}>
                <Siren />Emergency
              </ConfirmButton>
            </div>
          </section>

          <div className="grid gap-3 lg:grid-cols-2">
            <section className="panel">
              <div className="panel-header">Playout status</div>
              <dl className="grid grid-cols-[140px_1fr] gap-y-1 p-3 text-xs">
                <dt className="text-muted-foreground">Source</dt><dd>{online ? status?.source : "—"}</dd>
                <dt className="text-muted-foreground">Current media</dt><dd className="truncate">{online ? status?.current_title ?? "—" : "—"}</dd>
                <dt className="text-muted-foreground">Next media</dt><dd className="truncate">{status?.next_title ?? next?.title ?? "—"}</dd>
                <dt className="text-muted-foreground">Scheduled now</dt><dd className="truncate">{current ? `${current.title} (${formatTime(current.starts_at, tz)}–${formatTime(current.ends_at, tz)})` : "—"}</dd>
                <dt className="text-muted-foreground">Position</dt><dd className="timecode">{online ? `${formatDuration(pos)} / ${formatDuration(dur)}` : "—"}</dd>
                <dt className="text-muted-foreground">Encoder</dt><dd>{online ? status?.encoder_status ?? "—" : "—"}</dd>
                <dt className="text-muted-foreground">Output / destination</dt><dd>{online ? status?.destination_status ?? "—" : "—"}</dd>
                <dt className="text-muted-foreground">Output format</dt><dd className="timecode">{status?.output_resolution ?? "—"} {status?.output_fps ? `@ ${status.output_fps}` : ""} {status?.output_bitrate_kbps ? `· ${status.output_bitrate_kbps} kbps` : ""}</dd>
                <dt className="text-muted-foreground">Engine</dt><dd>{status?.engine_host ?? "—"} {status?.engine_version ? `v${status.engine_version}` : ""}</dd>
              </dl>
            </section>
            <section className="panel">
              <div className="panel-header">Command log</div>
              <div className="max-h-64 overflow-y-auto">
                {!commands.data?.length && <EmptyState title="No commands issued yet" />}
                {commands.data?.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 border-b border-border/60 px-3 py-1.5 text-xs">
                    <span className="timecode w-12 text-muted-foreground">{formatTime(c.created_at, tz)}</span>
                    <span className="flex-1 truncate">{COMMAND_LABELS[c.command]}</span>
                    <StatusChip tone={c.status === "completed" ? "preview" : c.status === "failed" ? "program" : c.status === "expired" ? "off" : "warn"}>{c.status}</StatusChip>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        {/* Events */}
        <section className="panel 2xl:max-h-[calc(100vh-7rem)] 2xl:overflow-hidden">
          <div className="panel-header">Broadcast events<Radio className="size-3.5" /></div>
          <div className="max-h-[520px] overflow-y-auto 2xl:max-h-[calc(100vh-10rem)]">
            {!events.data?.length && <EmptyState title="No events">Programme starts, live input changes and encoder errors reported by the engine appear here in real time.</EmptyState>}
            {events.data?.map((e) => (
              <div key={e.id} className="border-b border-border/60 px-3 py-1.5 text-xs">
                <div className="flex items-center gap-2"><Tally tone={e.severity === "info" ? "info" : e.severity === "warning" ? "warn" : "program"} /><span className="timecode text-muted-foreground">{formatTime(e.occurred_at, tz)}</span><span className="label-caps">{e.event_type.replace(/_/g, " ")}</span></div>
                <div className="mt-0.5 pl-4">{e.message}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function SourceBtn({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("inline-flex h-7 items-center gap-1.5 rounded-sm border px-2 text-xs", active ? "border-preview bg-preview/15 text-preview" : "border-border bg-inset text-muted-foreground hover:text-foreground")}>
      {children}
    </button>
  );
}
