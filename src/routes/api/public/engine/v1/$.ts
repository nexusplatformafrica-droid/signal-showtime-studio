import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * MOVIE MAX Playout Engine API (v1).
 * Called by the persistent playout server (FFmpeg/MediaMTX host), never by browsers.
 * Every request must carry `Authorization: Bearer mmx_eng_…` created in Settings → Playout engine.
 * See docs/PLAYOUT_ENGINE.md for the full contract.
 */

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

const heartbeatSchema = z.object({
  on_air: z.boolean(),
  source: z.enum(["none", "schedule", "live", "emergency", "standby"]),
  current_entry_id: z.string().uuid().nullable().optional(),
  current_media_id: z.string().uuid().nullable().optional(),
  current_title: z.string().max(200).nullable().optional(),
  next_title: z.string().max(200).nullable().optional(),
  position_seconds: z.number().min(0).nullable().optional(),
  duration_seconds: z.number().min(0).nullable().optional(),
  output_resolution: z.string().max(20).nullable().optional(),
  output_bitrate_kbps: z.number().int().min(0).max(200000).nullable().optional(),
  output_fps: z.number().min(0).max(240).nullable().optional(),
  encoder_status: z.string().max(60).nullable().optional(),
  destination_status: z.string().max(60).nullable().optional(),
  active_live_input_id: z.string().uuid().nullable().optional(),
  engine_version: z.string().max(40).nullable().optional(),
  engine_host: z.string().max(120).nullable().optional(),
  last_error: z.string().max(500).nullable().optional(),
  live_inputs: z
    .array(z.object({
      id: z.string().uuid(),
      connected: z.boolean(),
      bitrate_kbps: z.number().int().min(0).nullable().optional(),
      resolution: z.string().max(20).nullable().optional(),
      fps: z.number().min(0).max(240).nullable().optional(),
      audio_ok: z.boolean().nullable().optional(),
    }))
    .max(20)
    .optional(),
});

const eventsSchema = z.object({
  events: z
    .array(z.object({
      event_type: z.string().min(1).max(60),
      severity: z.enum(["info", "warning", "error", "critical"]).default("info"),
      message: z.string().min(1).max(500),
      details: z.record(z.unknown()).optional(),
      entry_id: z.string().uuid().nullable().optional(),
      media_id: z.string().uuid().nullable().optional(),
      occurred_at: z.string().datetime().optional(),
    }))
    .min(1)
    .max(100),
});

const resultSchema = z.object({ status: z.enum(["completed", "failed"]), result: z.string().max(500).optional() });

async function handle(request: Request, splat: string) {
  const { verifyEngineRequest } = await import("@/lib/engine-auth.server");
  const auth = await verifyEngineRequest(request);

  // Ingest auth hook (MediaMTX externalAuth / nginx-rtmp on_publish) authenticates with the stream key itself.
  if (splat === "ingest/auth" && request.method === "POST") {
    if (!auth) return json({ error: "unauthorized" }, 401);
    const body = await request.json().catch(() => ({}));
    const key = String(body.stream_key ?? body.password ?? body.name ?? "").trim();
    const action = String(body.action ?? "publish");
    if (action !== "publish") return json({ ok: true });
    if (!key) return json({ error: "missing stream key" }, 401);
    const { data } = await auth.db.from("live_inputs").select("id, enabled").eq("channel_id", auth.channelId).eq("stream_key", key).maybeSingle();
    if (!data || !data.enabled) return json({ error: "invalid stream key" }, 401);
    return json({ ok: true, live_input_id: data.id });
  }

  if (!auth) return json({ error: "unauthorized" }, 401);
  const db = auth.db;
  const channelId = auth.channelId;
  const url = new URL(request.url);

  if (splat === "config" && request.method === "GET") {
    const [{ data: channel }, { data: overlays }, { data: inputs }] = await Promise.all([
      db.from("channels").select("*").eq("id", channelId).single(),
      db.from("graphics_overlays").select("id, kind, name, enabled, config, show_from, show_until, published_at, updated_at").eq("channel_id", channelId).not("published_at", "is", null),
      db.from("live_inputs").select("id, name, protocol, ingest_url, stream_key, enabled").eq("channel_id", channelId),
    ]);
    let standby: unknown = null;
    if (channel?.standby_media_id) {
      const { data: m } = await db.from("media_assets").select("id, title, storage_key, duration_seconds, status").eq("id", channel.standby_media_id).maybeSingle();
      standby = m ? { ...m, url: await signed(m.storage_key) } : null;
    }
    return json({ channel, overlays: overlays ?? [], live_inputs: inputs ?? [], standby, server_time: new Date().toISOString() });
  }

  if (splat === "schedule" && request.method === "GET") {
    const from = url.searchParams.get("from") ?? new Date(Date.now() - 3600_000).toISOString();
    const to = url.searchParams.get("to") ?? new Date(Date.now() + 48 * 3600_000).toISOString();
    const { data: entries, error } = await db
      .from("schedule_entries")
      .select("id, title, category, mode, media_id, playlist_id, starts_at, ends_at, priority, is_commercial_break, updated_at")
      .eq("channel_id", channelId)
      .eq("status", "published")
      .gte("ends_at", from)
      .lte("starts_at", to)
      .order("starts_at")
      .limit(2000);
    if (error) return json({ error: "schedule query failed" }, 500);
    const mediaIds = new Set<string>();
    const playlistIds = new Set<string>();
    for (const e of entries ?? []) {
      if (e.media_id) mediaIds.add(e.media_id);
      if (e.playlist_id) playlistIds.add(e.playlist_id);
    }
    const { data: items } = playlistIds.size
      ? await db.from("playlist_items").select("playlist_id, media_id, position").in("playlist_id", [...playlistIds]).order("position")
      : { data: [] as { playlist_id: string; media_id: string; position: number }[] };
    for (const i of items ?? []) mediaIds.add(i.media_id);
    const { data: playlists } = playlistIds.size
      ? await db.from("playlists").select("id, name, kind, shuffle, repeat").in("id", [...playlistIds])
      : { data: [] as { id: string; name: string; kind: string; shuffle: boolean; repeat: boolean }[] };
    const { data: media } = mediaIds.size
      ? await db.from("media_assets").select("id, title, storage_key, duration_seconds, status, available, width, height").in("id", [...mediaIds])
      : { data: [] as never[] };
    const mediaOut = await Promise.all(
      (media ?? []).map(async (m) => ({ ...m, playable: m.status === "ready" && m.available && !!m.storage_key, url: m.status === "ready" ? await signed(m.storage_key, 6 * 3600) : null })),
    );
    return json({
      from, to, generated_at: new Date().toISOString(),
      entries: entries ?? [],
      playlists: (playlists ?? []).map((p) => ({ ...p, items: (items ?? []).filter((i) => i.playlist_id === p.id) })),
      media: mediaOut,
    });
  }

  if (splat === "heartbeat" && request.method === "POST") {
    const parsed = heartbeatSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return json({ error: "invalid heartbeat", issues: parsed.error.flatten() }, 400);
    const { live_inputs, ...hb } = parsed.data;
    const now = new Date().toISOString();
    const clean = Object.fromEntries(Object.entries(hb).filter(([, v]) => v !== undefined)) as typeof hb & { on_air: boolean };
    const { error } = await db.from("broadcast_status").upsert({ ...clean, channel_id: channelId, last_heartbeat_at: now, updated_at: now });
    if (error) return json({ error: "could not store heartbeat" }, 500);
    for (const li of live_inputs ?? []) {
      await db.from("live_inputs").update({
        connected: li.connected, bitrate_kbps: li.bitrate_kbps ?? null, resolution: li.resolution ?? null,
        fps: li.fps ?? null, audio_ok: li.audio_ok ?? null, ...(li.connected ? { last_seen_at: now } : {}),
      }).eq("id", li.id).eq("channel_id", channelId);
    }
    return json({ ok: true, server_time: now });
  }

  if (splat === "events" && request.method === "POST") {
    const parsed = eventsSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return json({ error: "invalid events", issues: parsed.error.flatten() }, 400);
    const rows = parsed.data.events.map((e) => ({
      channel_id: channelId, event_type: e.event_type, severity: e.severity, message: e.message,
      details: (e.details ?? {}) as never, entry_id: e.entry_id ?? null, media_id: e.media_id ?? null,
      occurred_at: e.occurred_at ?? new Date().toISOString(),
    }));
    const { error } = await db.from("broadcast_events").insert(rows);
    if (error) return json({ error: "could not store events" }, 500);
    return json({ ok: true, stored: rows.length });
  }

  if (splat === "commands" && request.method === "GET") {
    // Expire stale commands so an engine that reconnects later never replays old operator actions.
    await db.from("broadcast_commands").update({ status: "expired" }).eq("channel_id", channelId).eq("status", "queued").lt("created_at", new Date(Date.now() - 120_000).toISOString());
    const { data: queued } = await db.from("broadcast_commands").select("id").eq("channel_id", channelId).eq("status", "queued").order("created_at").limit(20);
    if (!queued?.length) return json({ commands: [] });
    // Claim atomically: only rows still queued are returned, preventing duplicate execution.
    const { data: claimed } = await db
      .from("broadcast_commands")
      .update({ status: "acknowledged", acknowledged_at: new Date().toISOString() })
      .in("id", queued.map((q) => q.id))
      .eq("status", "queued")
      .select("id, command, payload, created_at, issued_by");
    return json({ commands: (claimed ?? []).sort((a, b) => a.created_at.localeCompare(b.created_at)) });
  }

  const resultMatch = splat.match(/^commands\/([0-9a-f-]{36})\/result$/);
  if (resultMatch && request.method === "POST") {
    const parsed = resultSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return json({ error: "invalid result" }, 400);
    const { error } = await db
      .from("broadcast_commands")
      .update({ status: parsed.data.status, result: parsed.data.result ?? null, completed_at: new Date().toISOString() })
      .eq("id", resultMatch[1] ?? "")
      .eq("channel_id", channelId);
    if (error) return json({ error: "could not store result" }, 500);
    return json({ ok: true });
  }

  const mediaMatch = splat.match(/^media\/([0-9a-f-]{36})\/url$/);
  if (mediaMatch && request.method === "GET") {
    const { data: m } = await db.from("media_assets").select("id, storage_key, status").eq("id", mediaMatch[1] ?? "").eq("channel_id", channelId).maybeSingle();
    if (!m) return json({ error: "not found" }, 404);
    return json({ id: m.id, url: await signed(m.storage_key, 6 * 3600) });
  }

  return json({ error: "not found" }, 404);
}

async function signed(key: string | null | undefined, ttl = 3600) {
  if (!key) return null;
  const { getR2, presignGet } = await import("@/lib/r2.server");
  if (!getR2()) return null;
  return presignGet(key, ttl);
}

export const Route = createFileRoute("/api/public/engine/v1/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => handle(request, params._splat ?? ""),
      POST: async ({ request, params }) => handle(request, params._splat ?? ""),
    },
  },
});
