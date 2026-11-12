import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Camera, Copy, Eye, EyeOff, MonitorUp, Mic, Plus, Radio, RefreshCw, RotateCcw, Square, Unplug } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useStation } from "@/components/admin/station-context";
import { useBroadcastStatus, useNow, useRealtimeInvalidate } from "@/hooks/use-station";
import { useIssueCommand } from "@/hooks/use-commands";
import { createLiveInput, regenerateStreamKey } from "@/lib/station.functions";
import { PageHeader, EmptyState } from "@/components/admin/PageHeader";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { StatusChip, Tally } from "@/components/broadcast/status";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatTime, isEngineOnline } from "@/lib/broadcast";
import { copyText } from "@/lib/clipboard";

export const Route = createFileRoute("/_authenticated/admin/live")({ component: LivePage });

type LiveInput = Tables<"live_inputs">;

function LivePage() {
  const { channel, can } = useStation();
  const qc = useQueryClient();
  const allowed = can("live");
  const now = useNow(5000);
  const { data: status } = useBroadcastStatus(channel.id);
  const online = now != null && isEngineOnline(status, now);
  const issue = useIssueCommand();
  const [createOpen, setCreateOpen] = useState(false);

  useRealtimeInvalidate("live_inputs", [["live-inputs-full", channel.id]], `channel_id=eq.${channel.id}`);
  const inputs = useQuery({
    queryKey: ["live-inputs-full", channel.id],
    enabled: allowed,
    queryFn: async () => {
      const { data, error } = await supabase.from("live_inputs").select("*").eq("channel_id", channel.id).order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  async function setReturn(v: string) {
    const { error } = await supabase.from("channels").update({ live_return_behaviour: v }).eq("id", channel.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Return behaviour saved");
      qc.invalidateQueries({ queryKey: ["channel"] });
    }
  }

  if (!allowed) return <div><PageHeader title="Live Inputs" /><EmptyState title="Restricted">Only Super Admins, Station Managers and Broadcast Operators can manage live inputs and stream keys.</EmptyState></div>;

  return (
    <div>
      <PageHeader title="Live Inputs" description="OBS / encoder ingest, live switching and browser capture." actions={
        <>
          {!online && <StatusChip tone="warn">Playout engine offline</StatusChip>}
          <Button size="xs" variant="program" onClick={() => setCreateOpen(true)}><Plus />New input</Button>
        </>
      } />
      <div className="grid gap-3 p-3 2xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-3">
          <section className="panel">
            <div className="panel-header">Ingest inputs</div>
            {!inputs.data?.length && <EmptyState title="No live inputs">Create an input to get a private stream key for OBS Studio or a hardware encoder.</EmptyState>}
            {inputs.data?.map((i) => <InputRow key={i.id} input={i} engineOnline={online} onTake={() => issue.mutateAsync({ command: "take_live", payload: { live_input_id: i.id } })} />)}
          </section>

          <section className="panel">
            <div className="panel-header">Live switching</div>
            <div className="flex flex-wrap items-end gap-2 p-3">
              <Button size="sm" variant="panel" onClick={() => issue.mutate({ command: "end_live" })}><Unplug />End live</Button>
              <Button size="sm" variant="preview" onClick={() => issue.mutate({ command: "return_to_schedule" })}><RotateCcw />Return to scheduled programming</Button>
              <label className="ml-auto space-y-1 text-xs">
                <span className="label-caps">When live ends</span>
                <select className="field w-72" value={channel.live_return_behaviour} disabled={!can("settings")} onChange={(e) => setReturn(e.target.value)}>
                  <option value="resume_programme">Resume interrupted programme from its position</option>
                  <option value="skip_next">Skip to the next programme</option>
                  <option value="resume_schedule">Join the published schedule at the current time</option>
                </select>
              </label>
            </div>
            <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">Live sources take priority over scheduled programming. Switching is executed by the playout engine and confirmed in the Control Room command log.</p>
          </section>

          <BrowserCapture inputs={inputs.data ?? []} />
        </div>

        <section className="panel h-fit">
          <div className="panel-header">OBS Studio setup</div>
          <ol className="list-decimal space-y-2 p-3 pl-7 text-xs text-muted-foreground">
            <li>Create an input here and set its <span className="text-foreground">ingest server address</span> to the RTMP/RTMPS/SRT URL exposed by your playout server (e.g. MediaMTX or nginx-rtmp).</li>
            <li>In OBS: <span className="text-foreground">Settings → Stream → Service: Custom</span>. Paste the server address and the stream key.</li>
            <li>Recommended output: 1920×1080, 25 fps, x264 CBR 4500–6000 kbps, keyframe interval 2 s, AAC 128 kbps 48 kHz.</li>
            <li>Click <span className="text-foreground">Start Streaming</span>. When the engine detects the input, it shows as connected here with bitrate, resolution and frame rate.</li>
            <li>Use <span className="text-foreground">Take live</span> to interrupt the schedule, then <span className="text-foreground">Return to schedule</span> when finished.</li>
          </ol>
          <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">Stream keys are private. The engine validates every publish attempt against them, so a regenerated key immediately blocks the old one.</p>
        </section>
      </div>
      <CreateInputDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function InputRow({ input, engineOnline, onTake }: { input: LiveInput; engineOnline: boolean; onTake: () => Promise<unknown> }) {
  const { channel } = useStation();
  const qc = useQueryClient();
  const [show, setShow] = useState(false);
  const [url, setUrl] = useState(input.ingest_url ?? "");
  const regen = useServerFn(regenerateStreamKey);
  const connected = engineOnline && input.connected;
  const invalidate = () => qc.invalidateQueries({ queryKey: ["live-inputs-full", channel.id] });

  async function saveUrl() {
    const v = url.trim();
    if (v && !/^(rtmps?|srt|https?):\/\//i.test(v)) {
      toast.error("Use an rtmp://, rtmps://, srt:// or https:// (WHIP) address");
      return;
    }
    const { error } = await supabase.from("live_inputs").update({ ingest_url: v || null }).eq("id", input.id);
    if (error) toast.error(error.message);
    else toast.success("Ingest address saved");
    invalidate();
  }

  return (
    <div className="grid gap-3 border-b border-border/60 p-3 lg:grid-cols-[220px_minmax(0,1fr)_auto]">
      <div>
        <div className="flex items-center gap-2"><Tally tone={connected ? "preview" : "off"} pulse={connected} /><span className="font-semibold">{input.name}</span><StatusChip tone="info">{input.protocol}</StatusChip></div>
        <div className="timecode mt-1 text-[11px] text-muted-foreground">
          {connected ? `${input.resolution ?? "?"} · ${input.fps ?? "?"} fps · ${input.bitrate_kbps ?? "?"} kbps · audio ${input.audio_ok ? "ok" : "missing"}` : input.last_seen_at ? `last seen ${formatTime(input.last_seen_at, channel.timezone)}` : "never connected"}
        </div>
        {!input.enabled && <StatusChip tone="off" className="mt-1">Disabled</StatusChip>}
      </div>
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="label-caps w-16">Server</span>
          <input className="field h-7" placeholder="Ingest address from your playout server" value={url} onChange={(e) => setUrl(e.target.value)} onBlur={() => url !== (input.ingest_url ?? "") && saveUrl()} />
          {input.ingest_url && <Button size="icon-sm" variant="panel" aria-label="Copy server" onClick={() => copyText(input.ingest_url ?? "", "Server address copied")}><Copy /></Button>}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="label-caps w-16">Key</span>
          <code className="timecode flex h-7 flex-1 items-center truncate rounded-sm border border-input bg-inset px-2">{show ? input.stream_key : "•".repeat(24)}</code>
          <Button size="icon-sm" variant="panel" aria-label={show ? "Hide key" : "Show key"} onClick={() => setShow((s) => !s)}>{show ? <EyeOff /> : <Eye />}</Button>
          <Button size="icon-sm" variant="panel" aria-label="Copy key" onClick={() => copyText(input.stream_key, "Stream key copied")}><Copy /></Button>
        </div>
        {!input.ingest_url && <div className="text-[11px] text-warn">No ingest address yet — set it from your playout server before using this key.</div>}
      </div>
      <div className="flex flex-wrap items-start gap-1.5">
        <ConfirmButton size="xs" variant="program" disabled={!connected} title={`Take "${input.name}" live?`} description="Scheduled programming is interrupted and this input goes to air for all viewers." confirmLabel="Take live" onConfirm={onTake}><Radio />Take live</ConfirmButton>
        <ConfirmButton size="xs" variant="panel" title="Regenerate stream key?" description="The current key stops working immediately. Update OBS with the new key." confirmLabel="Regenerate" onConfirm={async () => { try { await regen({ data: { inputId: input.id } }); toast.success("New stream key generated"); invalidate(); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } }}><RefreshCw />New key</ConfirmButton>
        <Button size="xs" variant="ghost" onClick={async () => { await supabase.from("live_inputs").update({ enabled: !input.enabled }).eq("id", input.id); invalidate(); }}>{input.enabled ? "Disable" : "Enable"}</Button>
        <ConfirmButton size="xs" variant="ghost" destructive title="Delete input?" description="The stream key is revoked permanently." confirmLabel="Delete" onConfirm={async () => { await supabase.from("live_inputs").delete().eq("id", input.id); invalidate(); }}>Delete</ConfirmButton>
      </div>
    </div>
  );
}

function CreateInputDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { channel } = useStation();
  const qc = useQueryClient();
  const create = useServerFn(createLiveInput);
  const [name, setName] = useState("Studio OBS");
  const [protocol, setProtocol] = useState<"rtmp" | "rtmps" | "srt" | "webrtc">("rtmps");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await create({ data: { channelId: channel.id, name, protocol, ...(url.trim() ? { ingestUrl: url.trim() } : {}) } });
      toast.success("Live input created");
      qc.invalidateQueries({ queryKey: ["live-inputs-full", channel.id] });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm border-border bg-panel">
        <DialogHeader><DialogTitle className="font-display uppercase tracking-wide">New live input</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3 text-sm">
          <label className="block space-y-1"><span className="label-caps">Name</span><input className="field" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} /></label>
          <label className="block space-y-1"><span className="label-caps">Protocol</span>
            <select className="field" value={protocol} onChange={(e) => setProtocol(e.target.value as typeof protocol)}>
              <option value="rtmps">RTMPS (OBS, recommended)</option><option value="rtmp">RTMP</option><option value="srt">SRT</option><option value="webrtc">WebRTC / WHIP (browser)</option>
            </select>
          </label>
          <label className="block space-y-1"><span className="label-caps">Ingest server address (optional)</span><input className="field" placeholder={protocol === "webrtc" ? "https://engine.example.com/whip/studio" : "rtmps://ingest.example.com/live"} value={url} onChange={(e) => setUrl(e.target.value)} /></label>
          <p className="text-[11px] text-muted-foreground">A private stream key is generated automatically.</p>
          <Button type="submit" variant="brand" size="sm" className="w-full" disabled={busy}>Create input</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Browser camera / mic / screen capture. Publishes over WHIP only when a WebRTC input with an ingest address exists. */
function BrowserCapture({ inputs }: { inputs: LiveInput[] }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [pc, setPc] = useState<RTCPeerConnection | null>(null);
  const [pcState, setPcState] = useState<string>("idle");
  const whipInputs = inputs.filter((i) => i.protocol === "webrtc" && i.ingest_url && i.enabled);
  const [target, setTarget] = useState<string>("");

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);
  useEffect(() => () => { stream?.getTracks().forEach((t) => t.stop()); pc?.close(); }, [stream, pc]);

  async function capture(kind: "camera" | "screen" | "mic") {
    try {
      stream?.getTracks().forEach((t) => t.stop());
      const s = kind === "screen"
        ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
        : await navigator.mediaDevices.getUserMedia(kind === "camera" ? { video: { width: 1920, height: 1080 }, audio: true } : { audio: true });
      setStream(s);
    } catch {
      toast.error("Permission denied or no device available");
    }
  }

  async function publish() {
    const input = whipInputs.find((i) => i.id === target);
    if (!stream || !input?.ingest_url) return;
    try {
      const conn = new RTCPeerConnection();
      stream.getTracks().forEach((t) => conn.addTransceiver(t, { direction: "sendonly", streams: [stream] }));
      conn.onconnectionstatechange = () => setPcState(conn.connectionState);
      const offer = await conn.createOffer();
      await conn.setLocalDescription(offer);
      const res = await fetch(input.ingest_url, { method: "POST", headers: { "content-type": "application/sdp", authorization: `Bearer ${input.stream_key}` }, body: offer.sdp ?? "" });
      if (!res.ok) throw new Error(`Ingest refused the connection (HTTP ${res.status})`);
      await conn.setRemoteDescription({ type: "answer", sdp: await res.text() });
      setPc(conn);
      toast.success("Publishing to playout engine");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not publish");
      setPcState("failed");
    }
  }

  return (
    <section className="panel">
      <div className="panel-header">Dashboard capture<span className="normal-case tracking-normal">{pc ? `WHIP: ${pcState}` : stream ? "Local preview only" : ""}</span></div>
      <div className="grid gap-3 p-3 md:grid-cols-[minmax(0,1fr)_260px]">
        <div className="monitor">{stream ? <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-contain" /> : <div className="grid h-full place-items-center label-caps">No local source</div>}</div>
        <div className="space-y-2 text-xs">
          <div className="flex flex-wrap gap-1.5">
            <Button size="xs" variant="panel" onClick={() => capture("camera")}><Camera />Camera</Button>
            <Button size="xs" variant="panel" onClick={() => capture("screen")}><MonitorUp />Screen</Button>
            <Button size="xs" variant="panel" onClick={() => capture("mic")}><Mic />Mic only</Button>
            {stream && <Button size="xs" variant="ghost" onClick={() => { stream.getTracks().forEach((t) => t.stop()); pc?.close(); setPc(null); setStream(null); setPcState("idle"); }}><Square />Stop</Button>}
          </div>
          {whipInputs.length ? (
            <>
              <select className="field" value={target} onChange={(e) => setTarget(e.target.value)}><option value="">Choose WebRTC input…</option>{whipInputs.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select>
              <Button size="xs" variant="program" disabled={!stream || !target || !!pc} onClick={publish}><Radio />Publish to engine</Button>
            </>
          ) : (
            <p className="text-muted-foreground">This preview is local to your browser and is <span className="text-foreground">not</span> sent to the broadcast. To send it, add a WebRTC (WHIP) input with the WHIP address exposed by your playout server.</p>
          )}
        </div>
      </div>
    </section>
  );
}
