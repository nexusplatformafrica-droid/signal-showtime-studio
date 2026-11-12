import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

export const CHANNEL_SLUG = "movie-max";

function publicClient() {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

/** Public channel data for the viewer website: channel, actual engine status and the published 7-day guide. */
export const getPublicStation = createServerFn({ method: "GET" }).handler(async () => {
  const db = publicClient();
  const { data: channel } = await db
    .from("channels")
    .select("id, slug, name, description, timezone, language, visibility, logo_url, hls_url, player_url, website_url")
    .eq("slug", CHANNEL_SLUG)
    .maybeSingle();
  if (!channel) return { channel: null, status: null, schedule: [] };
  const from = new Date(Date.now() - 6 * 3600_000).toISOString();
  const to = new Date(Date.now() + 8 * 86400_000).toISOString();
  const [{ data: status }, { data: schedule }] = await Promise.all([
    db.from("broadcast_status").select("on_air, source, current_entry_id, current_title, next_title, position_seconds, duration_seconds, output_resolution, last_heartbeat_at").eq("channel_id", channel.id).maybeSingle(),
    db
      .from("schedule_entries")
      .select("id, title, description, category, thumbnail_url, starts_at, ends_at, is_commercial_break")
      .eq("channel_id", channel.id)
      .eq("status", "published")
      .gte("ends_at", from)
      .lte("starts_at", to)
      .order("starts_at")
      .limit(1000),
  ]);
  return { channel, status: status ?? null, schedule: schedule ?? [] };
});

/** Player heartbeat from the public website — counts real concurrent viewers. */
export const viewerHeartbeat = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      sessionId: z.string().uuid(),
      channelId: z.string().uuid(),
      device: z.enum(["desktop", "mobile", "tablet", "tv", "unknown"]),
      platform: z.string().max(40),
      watchedSeconds: z.number().int().min(0).max(120),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const country = getRequestHeader("cf-ipcountry") ?? null;
    const { data: existing } = await supabaseAdmin.from("viewer_sessions").select("id, watch_seconds, channel_id").eq("id", data.sessionId).maybeSingle();
    if (existing) {
      if (existing.channel_id !== data.channelId) return { ok: false };
      await supabaseAdmin
        .from("viewer_sessions")
        .update({ last_seen_at: new Date().toISOString(), watch_seconds: existing.watch_seconds + data.watchedSeconds })
        .eq("id", data.sessionId);
    } else {
      const { data: ch } = await supabaseAdmin.from("channels").select("id").eq("id", data.channelId).maybeSingle();
      if (!ch) return { ok: false };
      await supabaseAdmin.from("viewer_sessions").insert({
        id: data.sessionId,
        channel_id: data.channelId,
        device: data.device,
        platform: data.platform,
        country: country && country !== "XX" ? country : null,
        watch_seconds: data.watchedSeconds,
      });
    }
    return { ok: true };
  });

/**
 * Website playout bundle: published programmes running now or in the next 6 hours, with a
 * playable link for each scheduled file. Only media referenced by published entries is exposed.
 */
export const getWebPlayout = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const serverTime = Date.now();
  const empty = { serverTime, entries: [], media: [], playlists: [] };
  const { data: channel } = await db.from("channels").select("id").eq("slug", CHANNEL_SLUG).maybeSingle();
  if (!channel) return empty;
  const { data: entries } = await db
    .from("schedule_entries")
    .select("id, title, media_id, playlist_id, starts_at, ends_at, priority")
    .eq("channel_id", channel.id)
    .eq("status", "published")
    .gt("ends_at", new Date(serverTime).toISOString())
    .lte("starts_at", new Date(serverTime + 6 * 3600_000).toISOString())
    .order("starts_at")
    .limit(200);
  if (!entries?.length) return empty;
  const playlistIds = [...new Set(entries.map((e) => e.playlist_id).filter((x): x is string => !!x))];
  const [{ data: playlists }, { data: items }] = playlistIds.length
    ? await Promise.all([
        db.from("playlists").select("id, repeat").in("id", playlistIds),
        db.from("playlist_items").select("playlist_id, media_id, position").in("playlist_id", playlistIds).order("position"),
      ])
    : [{ data: [] as { id: string; repeat: boolean }[] }, { data: [] as { playlist_id: string; media_id: string; position: number }[] }];
  const mediaIds = [...new Set([...entries.map((e) => e.media_id).filter((x): x is string => !!x), ...(items ?? []).map((i) => i.media_id)])];
  const { data: media } = mediaIds.length
    ? await db.from("media_assets").select("id, title, storage_key, source_url, duration_seconds, status, available").eq("channel_id", channel.id).in("id", mediaIds)
    : { data: [] as never[] };
  const { getR2, presignGet } = await import("@/lib/r2.server");
  const r2 = getR2();
  const mediaOut = await Promise.all(
    (media ?? []).map(async (m) => {
      const url = m.status !== "ready" || !m.available ? null : m.storage_key ? (r2 ? await presignGet(m.storage_key, 8 * 3600) : null) : m.source_url;
      return { id: m.id, title: m.title, duration_seconds: m.duration_seconds == null ? null : Number(m.duration_seconds), playable: !!url, url };
    }),
  );
  return {
    serverTime,
    entries,
    media: mediaOut,
    playlists: (playlists ?? []).map((p) => ({ id: p.id, repeat: p.repeat, items: (items ?? []).filter((i) => i.playlist_id === p.id).map((i) => ({ media_id: i.media_id })) })),
  };
});

/** Published, enabled on-screen graphics for the live output (drafts never appear here). */
export const getLiveGraphics = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data: channel } = await db.from("channels").select("id, timezone").eq("slug", CHANNEL_SLUG).maybeSingle();
  if (!channel) return { timezone: "Africa/Kampala", overlays: [] };
  const { data } = await db
    .from("graphics_overlays")
    .select("id, kind, name, published_config, show_from, show_until, published_at")
    .eq("channel_id", channel.id)
    .eq("published_enabled", true)
    .not("published_config", "is", null)
    .order("created_at");
  return {
    timezone: channel.timezone,
    overlays: (data ?? []).map((o) => ({ id: o.id, kind: o.kind, name: o.name, config: o.published_config as Record<string, string | number>, show_from: o.show_from, show_until: o.show_until, published_at: o.published_at })),
  };
});
