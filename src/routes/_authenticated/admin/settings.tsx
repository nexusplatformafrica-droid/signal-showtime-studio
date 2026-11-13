import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { toast } from "sonner";
import { Copy, Download, KeyRound, Plus, X } from "lucide-react";
import { db } from "@/lib/db";
import type { Tables } from "@/lib/db-types";
import { useStation } from "@/components/admin/station-context";
import { useBroadcastStatus, useNow } from "@/hooks/use-station";
import { getStorageStatus, testStorage } from "@/lib/station.functions";
import { createEngineLogin, revokeEngineLogin } from "@/lib/engine-login";
import { OWNER_EMAIL } from "@/lib/firebase-config";
import { PageHeader, EmptyState } from "@/components/admin/PageHeader";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { StatusChip } from "@/components/broadcast/status";
import { Button } from "@/components/ui/button";
import { MediaPicker } from "@/components/schedule/MediaPicker";
import { ASSIGNABLE_ROLES, ROLE_LABELS, type AppRole } from "@/lib/permissions";
import { formatBytes, formatDate, formatTime, isEngineOnline } from "@/lib/broadcast";
import { copyText } from "@/lib/clipboard";
import { cn } from "@/lib/utils";
import FIRESTORE_RULES from "../../../../firestore.rules?raw";

const TABS = ["channel", "broadcast", "engine", "storage", "firebase", "users", "audit"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABELS: Record<Tab, string> = { channel: "Channel", broadcast: "Broadcast output", engine: "Playout engine", storage: "Storage", firebase: "Firebase", users: "Users & roles", audit: "Audit log" };

export const Route = createFileRoute("/_authenticated/admin/settings")({
  validateSearch: (s) => z.object({ tab: z.enum(TABS).optional() }).parse(s),
  component: SettingsPage,
});

function SettingsPage() {
  const { tab = "channel" } = Route.useSearch();
  const navigate = useNavigate();
  return (
    <div>
      <PageHeader title="Settings">
        <div className="flex gap-0.5 border-t border-border px-3">
          {TABS.map((t) => (
            <button key={t} onClick={() => navigate({ to: "/admin/settings", search: { tab: t } })} className={cn("relative h-8 px-3 text-xs", tab === t ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {TAB_LABELS[t]}{tab === t && <span className="absolute inset-x-2 bottom-0 h-0.5 bg-program" />}
            </button>
          ))}
        </div>
      </PageHeader>
      <div className="p-3">
        {tab === "channel" && <ChannelTab />}
        {tab === "broadcast" && <BroadcastTab />}
        {tab === "engine" && <EngineTab />}
        {tab === "storage" && <StorageTab />}
        {tab === "firebase" && <FirebaseTab />}
        {tab === "users" && <UsersTab />}
        {tab === "audit" && <AuditTab />}
      </div>
    </div>
  );
}

function useSaveChannel() {
  const { channel } = useStation();
  const qc = useQueryClient();
  return async (patch: Partial<Tables<"channels">>) => {
    const { error } = await db.from("channels").update(patch).eq("id", channel.id);
    if (error) toast.error(error.message.includes("check") ? "One of the values is out of range" : error.message);
    else {
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["channel"] });
    }
  };
}

const TIMEZONES = ["Africa/Kampala", "Africa/Nairobi", "Africa/Dar_es_Salaam", "Africa/Kigali", "Africa/Lagos", "Africa/Johannesburg", "Europe/London", "UTC"];

function ChannelTab() {
  const { channel, can } = useStation();
  const save = useSaveChannel();
  const [f, setF] = useState({ name: channel.name, description: channel.description ?? "", timezone: channel.timezone, language: channel.language, visibility: channel.visibility, default_quality: channel.default_quality });
  const standby = useQuery({
    queryKey: ["standby", channel.standby_media_id],
    enabled: !!channel.standby_media_id,
    queryFn: async () => (await db.from("media_assets").select("id, title").eq("id", channel.standby_media_id!).maybeSingle()).data,
  });
  return (
    <fieldset disabled={!can("settings")} className="panel grid max-w-3xl gap-3 p-4 text-sm md:grid-cols-2">
      <label className="space-y-1"><span className="label-caps">Channel name</span><input className="field" value={f.name} maxLength={80} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <label className="space-y-1"><span className="label-caps">Timezone</span><select className="field" value={f.timezone} onChange={(e) => setF({ ...f, timezone: e.target.value })}>{TIMEZONES.map((t) => <option key={t}>{t}</option>)}</select></label>
      <label className="space-y-1 md:col-span-2"><span className="label-caps">Description</span><textarea className="field" rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
      <label className="space-y-1"><span className="label-caps">Language</span><select className="field" value={f.language} onChange={(e) => setF({ ...f, language: e.target.value })}><option value="en">English</option><option value="lg">Luganda</option><option value="sw">Swahili</option><option value="fr">French</option></select></label>
      <label className="space-y-1"><span className="label-caps">Visibility</span>
        <select className="field" value={f.visibility} onChange={(e) => setF({ ...f, visibility: e.target.value as typeof f.visibility })}><option value="public">Public</option><option value="registration">Registration required</option><option value="private">Private / invitation only</option></select>
      </label>
      <label className="space-y-1"><span className="label-caps">Default video quality</span><select className="field" value={f.default_quality} onChange={(e) => setF({ ...f, default_quality: e.target.value })}><option value="auto">Auto (adaptive)</option><option value="1080p">1080p</option><option value="720p">720p</option><option value="480p">480p</option></select></label>
      <div className="space-y-1">
        <span className="label-caps">Default standby video</span>
        <div className="text-xs text-muted-foreground">Current: <span className="text-foreground">{standby.data?.title ?? "None"}</span></div>
        <MediaPicker channelId={channel.id} placeholder="Choose standby media…" onPick={(m) => save({ standby_media_id: m.id })} />
      </div>
      <div className="md:col-span-2"><Button type="button" size="sm" variant="brand" onClick={() => save({ ...f, description: f.description || null })}>Save channel</Button></div>
    </fieldset>
  );
}

function BroadcastTab() {
  const { channel, can } = useStation();
  const save = useSaveChannel();
  const [f, setF] = useState({ output_resolution: channel.output_resolution, output_fps: channel.output_fps, video_bitrate_kbps: channel.video_bitrate_kbps, audio_bitrate_kbps: channel.audio_bitrate_kbps, hls_segment_seconds: channel.hls_segment_seconds, auto_restart: channel.auto_restart, live_return_behaviour: channel.live_return_behaviour });
  return (
    <fieldset disabled={!can("settings")} className="panel grid max-w-3xl gap-3 p-4 text-sm md:grid-cols-3">
      <label className="space-y-1"><span className="label-caps">Resolution</span><select className="field" value={f.output_resolution} onChange={(e) => setF({ ...f, output_resolution: e.target.value })}><option>1920x1080</option><option>1280x720</option><option>3840x2160</option></select></label>
      <label className="space-y-1"><span className="label-caps">Frame rate</span><select className="field" value={f.output_fps} onChange={(e) => setF({ ...f, output_fps: +e.target.value })}>{[25, 30, 50, 60].map((v) => <option key={v} value={v}>{v} fps</option>)}</select></label>
      <label className="space-y-1"><span className="label-caps">HLS segment length (s)</span><input type="number" min={1} max={12} className="field" value={f.hls_segment_seconds} onChange={(e) => setF({ ...f, hls_segment_seconds: +e.target.value })} /></label>
      <label className="space-y-1"><span className="label-caps">Video bitrate (kbps)</span><input type="number" min={300} max={50000} className="field" value={f.video_bitrate_kbps} onChange={(e) => setF({ ...f, video_bitrate_kbps: +e.target.value })} /></label>
      <label className="space-y-1"><span className="label-caps">Audio bitrate (kbps)</span><input type="number" min={32} max={512} className="field" value={f.audio_bitrate_kbps} onChange={(e) => setF({ ...f, audio_bitrate_kbps: +e.target.value })} /></label>
      <label className="mt-5 flex items-center gap-2 text-xs"><input type="checkbox" checked={f.auto_restart} onChange={(e) => setF({ ...f, auto_restart: e.target.checked })} />Restart playout automatically after failure</label>
      <label className="space-y-1 md:col-span-3"><span className="label-caps">After live broadcasts</span>
        <select className="field" value={f.live_return_behaviour} onChange={(e) => setF({ ...f, live_return_behaviour: e.target.value })}>
          <option value="resume_programme">Resume interrupted programme from its position</option><option value="skip_next">Skip to the next programme</option><option value="resume_schedule">Join the published schedule at the current time</option>
        </select>
      </label>
      <p className="text-[11px] text-muted-foreground md:col-span-3">The playout engine reads these values from its configuration endpoint and applies them on its next restart or refresh. The fallback source is the default standby video set on the Channel tab.</p>
      <div className="md:col-span-3"><Button type="button" size="sm" variant="brand" onClick={() => save(f)}>Save broadcast settings</Button></div>
    </fieldset>
  );
}

function EngineTab() {
  const { channel, can, user } = useStation();
  const qc = useQueryClient();
  const now = useNow(5000);
  const { data: status } = useBroadcastStatus(channel.id);
  const online = now != null && isEngineOnline(status, now);
  const [label, setLabel] = useState("Primary playout server");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const tokens = useQuery({
    queryKey: ["engine-tokens", channel.id],
    enabled: can("engine"),
    queryFn: async () => (await db.from("engine_tokens").select("id, label, token_prefix, created_at, last_used_at, revoked_at").eq("channel_id", channel.id).order("created_at", { ascending: false })).data ?? [],
  });
  const gen = useMutation({
    mutationFn: () => createEngineLogin(db, { channelId: channel.id, label: label.trim(), createdBy: user.id }),
    onSuccess: (r) => { setNewToken(r.token); qc.invalidateQueries({ queryKey: ["engine-tokens", channel.id] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const base = `${origin}/api/public/engine/v1`;
  const endpoints = [
    ["GET", "/config", "Channel output settings, published graphics, live inputs, standby media"],
    ["GET", "/schedule?from=&to=", "Published schedule with signed media URLs and playlist items"],
    ["POST", "/heartbeat", "Report on-air state, current item, output stats (every 5–10 s)"],
    ["POST", "/events", "Report programme started/completed, live input changes, errors"],
    ["GET", "/commands", "Claim queued operator commands (each command is delivered once)"],
    ["POST", "/commands/{id}/result", "Report completed or failed command"],
    ["POST", "/ingest/auth", "Validate a stream key on publish (MediaMTX / nginx-rtmp hook)"],
    ["GET", "/media/{id}/url", "Fresh signed download URL for a media file"],
  ];
  return (
    <div className="grid max-w-5xl gap-3 lg:grid-cols-2">
      <section className="panel">
        <div className="panel-header">Engine connection<StatusChip tone={online ? "preview" : "off"}>{online ? "Online" : "Offline"}</StatusChip></div>
        <dl className="grid grid-cols-[130px_1fr] gap-y-1 p-3 text-xs">
          <dt className="text-muted-foreground">Last heartbeat</dt><dd className="timecode">{status?.last_heartbeat_at ? `${formatDate(status.last_heartbeat_at, channel.timezone)} ${formatTime(status.last_heartbeat_at, channel.timezone)}` : "never"}</dd>
          <dt className="text-muted-foreground">Host</dt><dd>{status?.engine_host ?? "—"}</dd>
          <dt className="text-muted-foreground">Version</dt><dd>{status?.engine_version ?? "—"}</dd>
          <dt className="text-muted-foreground">API base URL</dt><dd className="flex items-center gap-1"><code className="timecode truncate">{base}</code><button aria-label="Copy API URL" onClick={() => copyText(base, "API URL copied")}><Copy className="size-3.5" /></button></dd>
        </dl>
        <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">The engine runs on a dedicated server (FFmpeg + an RTMP/SRT ingest server). It must not run inside this web app. See <code>docs/PLAYOUT_ENGINE.md</code> in the project for the full contract.</p>
      </section>

      <section className="panel">
        <div className="panel-header">Engine access tokens</div>
        {!can("engine") ? <EmptyState title="Super Admin only" /> : (
          <div className="space-y-2 p-3 text-xs">
            <div className="flex gap-1.5"><input className="field h-7" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} /><Button size="xs" variant="brand" disabled={gen.isPending || !label.trim()} onClick={() => gen.mutate()}><KeyRound />Generate</Button></div>
            {newToken && (
              <div className="rounded-sm border border-preview/40 bg-preview/10 p-2">
                <div className="mb-1 font-semibold text-preview">Copy this token now — it will not be shown again.</div>
                <div className="flex items-center gap-1"><code className="timecode flex-1 break-all">{newToken}</code><button aria-label="Copy token" onClick={() => copyText(newToken, "Token copied")}><Copy className="size-3.5" /></button></div>
              </div>
            )}
            {tokens.data?.map((t) => (
              <div key={t.id} className="flex items-center gap-2 border-t border-border/60 pt-1.5">
                <div className="min-w-0 flex-1"><div className="truncate">{t.label}</div><div className="timecode text-[10px] text-muted-foreground">{t.token_prefix}… · {t.last_used_at ? `used ${formatTime(t.last_used_at, channel.timezone)}` : "never used"}</div></div>
                {t.revoked_at ? <StatusChip tone="off">Revoked</StatusChip> : (
                  <ConfirmButton size="xs" variant="ghost" destructive title="Revoke token?" description="The playout server using it will be disconnected immediately." confirmLabel="Revoke" onConfirm={async () => { await revokeEngineLogin(db, t.id); qc.invalidateQueries({ queryKey: ["engine-tokens", channel.id] }); }}>Revoke</ConfirmButton>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <RunEngineGuide origin={origin} lastError={status?.last_error ?? null} />

      <section className="panel lg:col-span-2">
        <div className="panel-header">Engine API · Authorization: Bearer &lt;token&gt;</div>
        <table className="data-table w-full"><tbody>
          {endpoints.map(([m, p, d]) => <tr key={p}><td className="timecode w-16 text-info">{m}</td><td className="timecode w-64">{p}</td><td className="text-muted-foreground">{d}</td></tr>)}
        </tbody></table>
      </section>
    </div>
  );
}

function StorageTab() {
  const { channel, can } = useStation();
  const statusFn = useServerFn(getStorageStatus);
  const testFn = useServerFn(testStorage);
  const status = useQuery({ queryKey: ["storage-status"], queryFn: () => statusFn() });
  const usage = useQuery({
    queryKey: ["storage-usage", channel.id],
    queryFn: async () => {
      const { data } = await db.from("media_assets").select("file_size").eq("channel_id", channel.id).limit(10000);
      return { bytes: (data ?? []).reduce((a, m) => a + (m.file_size ?? 0), 0), count: data?.length ?? 0 };
    },
  });
  const test = useMutation({ mutationFn: () => testFn(), onSuccess: (r) => (r.ok ? toast.success(r.message) : toast.error(r.message)) });
  const cors = `[
  {
    "AllowedOrigins": ["${typeof window === "undefined" ? "https://your-site" : window.location.origin}"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]`;
  return (
    <div className="grid max-w-5xl gap-3 lg:grid-cols-2">
      <section className="panel">
        <div className="panel-header">Cloudflare R2<StatusChip tone={status.data?.configured ? "preview" : "warn"}>{status.data?.configured ? "Connected" : "Not connected"}</StatusChip></div>
        <dl className="grid grid-cols-[130px_1fr] gap-y-1 p-3 text-xs">
          <dt className="text-muted-foreground">Connected through</dt><dd>{status.data?.mode === "worker" ? "Your upload service on Cloudflare Workers" : status.data?.mode === "direct" ? "R2 access keys" : "—"}</dd>
          {status.data?.service && (<><dt className="text-muted-foreground">Upload service</dt><dd className="truncate">{status.data.service}</dd></>)}
          <dt className="text-muted-foreground">Bucket</dt><dd>{status.data?.bucket ?? "—"}</dd>
          <dt className="text-muted-foreground">Media stored</dt><dd className="timecode">{formatBytes(usage.data?.bytes)} · {usage.data?.count ?? 0} assets</dd>
          <dt className="text-muted-foreground">Upload limit</dt><dd>Up to 160 GB per file (16 MB resumable parts)</dd>
          <dt className="text-muted-foreground">Retention</dt><dd>Kept until deleted; archived assets stay in storage</dd>
        </dl>
        <div className="border-t border-border p-3">
          <Button size="xs" variant="panel" disabled={!can("settings") || !status.data?.configured || test.isPending} onClick={() => test.mutate()}>Test connection</Button>
        </div>
        {!status.data?.configured && (
          <div className="border-t border-border p-3 text-xs text-muted-foreground">
            Your upload service address and token are built into the app's server code, so every copy of this project uploads without re-entering them. They never reach the browser.
          </div>
        )}
      </section>
      <section className="panel">
        <div className="panel-header">Required bucket CORS policy<button aria-label="Copy CORS policy" onClick={() => copyText(cors, "CORS policy copied")}><Copy className="size-3.5" /></button></div>
        <pre className="timecode overflow-x-auto p-3 text-[11px] text-muted-foreground">{cors}</pre>
        <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">Browsers upload directly to R2 using short-lived signed URLs. Without <code>ExposeHeaders: ETag</code>, large uploads cannot be completed.</p>
      </section>
    </div>
  );
}

function UsersTab() {
  const { can } = useStation();
  const qc = useQueryClient();
  const data = useQuery({
    queryKey: ["staff"],
    enabled: can("users"),
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        db.from("profiles").select("id, email, display_name, created_at").order("created_at"),
        db.from("user_roles").select("*"),
      ]);
      const byUser = new Map((roles ?? []).map((r) => [r.user_id, (r.roles ?? []) as AppRole[]]));
      return (profiles ?? []).map((p) => ({ ...p, isOwner: p.email?.toLowerCase() === OWNER_EMAIL, roles: byUser.get(p.id) ?? [] }));
    },
  });
  if (!can("users")) return <EmptyState title="Super Admin only">Only the Super Admin ({OWNER_EMAIL}) can manage staff accounts and roles.</EmptyState>;
  async function save(userId: string, email: string | null, roles: AppRole[]) {
    const { error } = await db.from("user_roles").upsert({ user_id: userId, email, roles });
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["staff"] });
  }
  return (
    <section className="panel max-w-5xl">
      <div className="panel-header">Staff accounts<span className="normal-case tracking-normal">New staff sign up at /auth, then receive roles here.</span></div>
      <table className="data-table w-full">
        <thead><tr><th>User</th><th>Roles</th><th className="w-48">Grant role</th></tr></thead>
        <tbody>
          {data.data?.map((p) => (
            <tr key={p.id}>
              <td><div className="font-medium">{p.display_name ?? p.email}</div><div className="text-[11px] text-muted-foreground">{p.email}</div></td>
              <td>
                <div className="flex flex-wrap gap-1">
                  {p.isOwner && <StatusChip tone="preview">{ROLE_LABELS.super_admin}</StatusChip>}
                  {!p.isOwner && p.roles.length === 0 && <StatusChip tone="warn">No access</StatusChip>}
                  {!p.isOwner && p.roles.map((r) => (
                    <span key={r} className="inline-flex items-center gap-1 rounded-sm bg-accent px-1.5 py-0.5 text-[11px]">
                      {ROLE_LABELS[r]}
                      <button aria-label={`Remove ${ROLE_LABELS[r]}`} onClick={() => save(p.id, p.email, p.roles.filter((x) => x !== r))}><X className="size-3" /></button>
                    </span>
                  ))}
                </div>
              </td>
              <td>
                {p.isOwner ? <span className="text-[11px] text-muted-foreground">Has every permission</span> : (
                  <select className="field h-7" value="" onChange={(e) => e.target.value && save(p.id, p.email, [...p.roles, e.target.value as AppRole])}>
                    <option value="">Add role…</option>
                    {ASSIGNABLE_ROLES.filter((r) => !p.roles.includes(r)).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-1 border-t border-border px-3 py-2 text-[11px] text-muted-foreground"><Plus className="size-3" />Roles take effect on the user's next page load. Only {OWNER_EMAIL} can be Super Admin.</div>
    </section>
  );
}

function FirebaseTab() {
  const { can } = useStation();
  if (!can("users")) return <EmptyState title="Super Admin only">Only the Super Admin ({OWNER_EMAIL}) can see the Firebase setup.</EmptyState>;
  const steps = [
    "Open console.firebase.google.com and choose the project moviemax-tv.",
    "Firestore Database → Rules: delete everything there, paste the rules below, then press Publish.",
    "Authentication → Sign-in method: switch on Email/Password and Google.",
    "Authentication → Settings → Authorised domains: add this website's address (and your published address).",
  ];
  return (
    <div className="grid max-w-5xl gap-3">
      <section className="panel">
        <div className="panel-header">Firebase setup · project moviemax-tv</div>
        <ol className="list-decimal space-y-1 p-3 pl-8 text-xs">{steps.map((t) => <li key={t}>{t}</li>)}</ol>
        <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">Until the rules are published your database is open to anyone (Firebase "test mode"), and test mode stops working after 30 days. The rules make {OWNER_EMAIL} the only Super Admin and give everyone else only the access their role allows.</p>
      </section>
      <section className="panel">
        <div className="panel-header">Security rules<Button size="xs" variant="brand" onClick={() => copyText(FIRESTORE_RULES, "Rules copied — paste them in Firestore → Rules")}><Copy />Copy rules</Button></div>
        <pre className="timecode max-h-[420px] overflow-auto p-3 text-[11px] leading-relaxed text-muted-foreground">{FIRESTORE_RULES}</pre>
      </section>
    </div>
  );
}

function AuditTab() {
  const { channel, can } = useStation();
  const logs = useQuery({
    queryKey: ["audit"],
    enabled: can("audit"),
    queryFn: async () => {
      const [{ data: rows }, { data: profiles }] = await Promise.all([
        db.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200),
        db.from("profiles").select("id, email"),
      ]);
      const names = new Map((profiles ?? []).map((p) => [p.id, p.email]));
      return (rows ?? []).map((r) => ({ ...r, actor: r.actor_id ? names.get(r.actor_id) ?? "Staff member" : "System / engine" }));
    },
  });
  if (!can("audit")) return <EmptyState title="Restricted">Audit logs are visible to Super Admins and Station Managers.</EmptyState>;
  return (
    <section className="panel">
      <div className="panel-header">Latest 200 changes</div>
      <table className="data-table w-full">
        <thead><tr><th className="w-40">When</th><th className="w-56">Who</th><th className="w-24">Action</th><th className="w-40">Area</th><th>Item</th></tr></thead>
        <tbody>
          {logs.data?.map((l) => {
            const d = (l.details && typeof l.details === "object" && !Array.isArray(l.details) ? l.details : {}) as { label?: string; status?: string };
            return (
              <tr key={l.id}>
                <td className="timecode text-muted-foreground">{formatDate(l.created_at, channel.timezone)} {formatTime(l.created_at, channel.timezone)}</td>
                <td className="truncate">{l.actor}</td>
                <td>{l.action}</td>
                <td className="text-muted-foreground">{l.entity.replace(/_/g, " ")}</td>
                <td className="max-w-0 truncate">{d.label ?? l.entity_id}{d.status ? <span className="text-muted-foreground"> · {d.status}</span> : null}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!logs.data?.length && <EmptyState title="No changes recorded yet" />}
    </section>
  );
}


function CommandBlock({ title, code }: { title: string; code: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between"><span className="label-caps">{title}</span><button className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground" onClick={() => copyText(code, "Commands copied")}><Copy className="size-3" />Copy</button></div>
      <pre className="overflow-x-auto rounded-sm border border-border bg-inset p-2 font-mono text-[11px] leading-relaxed">{code}</pre>
    </div>
  );
}

/** Railway start command for the stock node image: installs FFmpeg, fetches the newest engine from this site, runs it. */
function railwayStartCommand(origin: string): string {
  return `/bin/sh -c "apt-get update -qq && apt-get install -y -qq ffmpeg curl ca-certificates && curl -fsSLo /tmp/movie-max-engine.mjs ${origin}/engine/movie-max-engine.mjs && exec node /tmp/movie-max-engine.mjs"`;
}

/** Step-by-step setup for the downloadable playout engine (public/engine/movie-max-engine.mjs). */
function RunEngineGuide({ origin, lastError }: { origin: string; lastError: string | null }) {
  const [os, setOs] = useState<"railway" | "linux" | "windows">("railway");
  const isPreview = /id-preview--|lovableproject\.com|localhost/.test(origin);
  const api = `${origin}/api/public/engine/v1`;
  const file = `${origin}/engine/movie-max-engine.mjs`;
  const railwayVars = [
    `MMX_API=${api}`,
    "MMX_TOKEN=mmx_eng_PASTE_YOUR_TOKEN",
    "MMX_OUTPUT=rtmp",
    "MMX_HOST=railway",
  ].join("\n");
  const railwayStart = railwayStartCommand(origin);
  const linux = [
    "# 1) Install Node.js 20 and FFmpeg (Ubuntu/Debian)",
    "curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -",
    "sudo apt-get install -y nodejs ffmpeg",
    "",
    "# 2) Download the engine",
    "sudo mkdir -p /opt/moviemax && cd /opt/moviemax",
    `sudo curl -fsSLo movie-max-engine.mjs ${file}`,
    "",
    "# 3) Save your settings (paste your engine token)",
    "sudo tee /opt/moviemax/engine.env >/dev/null <<'ENV'",
    `MMX_API=${api}`,
    "MMX_TOKEN=mmx_eng_PASTE_YOUR_TOKEN",
    "MMX_OUTPUT=rtmp",
    "ENV",
    "",
    "# 4) Keep it running 24/7 (starts again after reboots and crashes)",
    "sudo tee /etc/systemd/system/moviemax-engine.service >/dev/null <<'UNIT'",
    "[Unit]",
    "Description=MOVIE MAX playout engine",
    "After=network-online.target",
    "[Service]",
    "EnvironmentFile=/opt/moviemax/engine.env",
    "ExecStart=/usr/bin/node /opt/moviemax/movie-max-engine.mjs",
    "Restart=always",
    "RestartSec=5",
    "[Install]",
    "WantedBy=multi-user.target",
    "UNIT",
    "sudo systemctl daemon-reload && sudo systemctl enable --now moviemax-engine",
    "",
    "# Watch what it is doing",
    "journalctl -u moviemax-engine -f",
  ].join("\n");
  const windows = [
    "# 1) Install Node.js and FFmpeg (PowerShell)",
    "winget install OpenJS.NodeJS.LTS Gyan.FFmpeg",
    "# close and reopen PowerShell after installing",
    "",
    "# 2) Download and start the engine (the channel stays live while this window is open)",
    "mkdir C:\\moviemax; cd C:\\moviemax",
    `curl.exe -fsSLo movie-max-engine.mjs ${file}`,
    `$env:MMX_API="${api}"`,
    '$env:MMX_TOKEN="mmx_eng_PASTE_YOUR_TOKEN"',
    "node movie-max-engine.mjs",
  ].join("\n");
  return (
    <section className="panel lg:col-span-2">
      <div className="panel-header">Run the playout engine
        <span className="flex items-center gap-1">
          {(["railway", "linux", "windows"] as const).map((o) => <button key={o} onClick={() => setOs(o)} className={cn("rounded-sm px-2 py-0.5 text-[11px]", os === o ? "bg-accent text-foreground" : "text-muted-foreground")}>{o === "railway" ? "Railway (24/7)" : o === "linux" ? "Linux server (24/7)" : "Windows PC (testing)"}</button>)}
          <a href="/engine/movie-max-engine.mjs" download className="ml-1 flex items-center gap-1 rounded-sm px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"><Download className="size-3" />Download</a>
        </span>
      </div>
      <div className="space-y-3 p-3 text-xs">
        <p className="text-muted-foreground">This small program plays your published schedule with FFmpeg and sends it to your streaming server (HostHerb). HostHerb only receives and delivers the stream, so the engine must run somewhere that never switches off. Generate a token above, then follow the steps.</p>
        {isPreview && <div className="rounded-sm border border-warn/40 bg-warn/10 p-2 text-warn">Publish the site first, then open this page on your published address — the steps below will use it automatically. The preview address is not reachable from your server.</div>}
        {lastError && <div className="rounded-sm border border-program/40 bg-program/10 p-2 text-program">Engine reported: {lastError}</div>}
        {os === "railway" ? (
          <>
            <ol className="list-decimal space-y-1 pl-4 text-muted-foreground">
              <li>Sign in at <a className="text-foreground underline" href="https://railway.com" target="_blank" rel="noreferrer">railway.com</a>. The trial credit is enough to test; for 24/7 you need the Hobby plan (paid by usage).</li>
              <li><b className="text-foreground">New Project → Empty Project</b>, then <b className="text-foreground">Create → Docker Image</b> and type <code>node:20-bookworm-slim</code>.</li>
              <li>Open the new service → <b className="text-foreground">Variables → Raw Editor</b>, paste the variables below and put your engine token in place of <code>mmx_eng_PASTE_YOUR_TOKEN</code>.</li>
              <li><b className="text-foreground">Settings → Deploy → Custom Start Command</b>: paste the start command below. Set <b className="text-foreground">Restart Policy</b> to <i>Always</i> and leave <i>Serverless / sleep</i> off.</li>
              <li>Press <b className="text-foreground">Deploy</b>. In <b className="text-foreground">Deploy Logs</b> you should see "Pushing to rtmps://source.hostherb.com…". This page then shows the engine <i>Online</i> and the control room shows ON AIR.</li>
            </ol>
            <CommandBlock title="Railway variables" code={railwayVars} />
            <CommandBlock title="Railway custom start command" code={railwayStart} />
            <p className="text-muted-foreground">No public domain or port is needed — the engine only sends out. It downloads the newest engine every time it starts, so a redeploy picks up updates.</p>
          </>
        ) : (
          <CommandBlock title={os === "linux" ? "Ubuntu / Debian server" : "Windows PowerShell"} code={os === "linux" ? linux : windows} />
        )}
        <p className="text-muted-foreground">The HostHerb server address and stream key are sent to the engine automatically from Streaming Endpoints — you never type them on the server. Only if a streaming server asks for a login, add <code>MMX_PUBLISH_USER</code> and <code>MMX_PUBLISH_PASS</code>.</p>
      </div>
    </section>
  );
}
