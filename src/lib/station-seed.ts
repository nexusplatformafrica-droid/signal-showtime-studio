import type { Db } from "@/lib/db/core";
import type { Json } from "@/lib/db-types";

/** Fixed id for the MOVIE MAX channel so every copy of the app points at the same station. */
export const MOVIE_MAX_CHANNEL_ID = "6d0c1f5e-3b7a-4c55-9a8e-6f2d1b9c4a01";

const OVERLAYS: { kind: string; name: string; enabled: boolean; config: Record<string, unknown> }[] = [
  { kind: "logo", name: "Channel logo / watermark", enabled: true, config: { position: "top-right", size: 12, opacity: 0.85, text: "MOVIE MAX" } },
  { kind: "on_air", name: "ON AIR indicator", enabled: false, config: { position: "top-left", size: 6, opacity: 1, color: "#e5322d", text: "ON AIR" } },
  { kind: "now_showing", name: "Now showing", enabled: false, config: { position: "bottom-left", size: 30, opacity: 0.95, duration: 10 } },
  { kind: "next_programme", name: "Next programme", enabled: false, config: { position: "bottom-left", size: 30, opacity: 0.95, duration: 10 } },
  { kind: "clock", name: "Local time", enabled: false, config: { position: "top-left", size: 8, opacity: 0.9 } },
  { kind: "ticker", name: "Scrolling ticker", enabled: false, config: { position: "bottom", size: 100, opacity: 0.95, text: "Welcome to MOVIE MAX", speed: 60, color: "#e5322d" } },
  { kind: "breaking_news", name: "Breaking news banner", enabled: false, config: { position: "bottom", size: 100, opacity: 1, text: "BREAKING NEWS", color: "#e5322d" } },
  { kind: "lower_third", name: "Lower third", enabled: false, config: { position: "bottom-left", size: 40, opacity: 0.95, title: "Name", subtitle: "Role", color: "#e5322d" } },
  {
    kind: "ad_banner",
    name: "Pop-up card",
    enabled: false,
    config: { position: "bottom-left", opacity: 1, size: 44, design: "step-left", badge: "STEP\n01", kicker: "DID YOU KNOW", title: "Your message here", duration: 15, show_mode: "once" },
  },
];

/** First-time setup of an empty Firebase project (run by the Super Admin): channel, Wowza destination, default graphics. */
export async function seedStation(db: Db) {
  const { data: existing } = await db.from("channels").select("id").eq("slug", "movie-max").maybeSingle();
  const channelId = existing?.id ?? MOVIE_MAX_CHANNEL_ID;
  if (!existing) {
    const { error } = await db.from("channels").insert({
      id: channelId,
      slug: "movie-max",
      name: "MOVIE MAX",
      description: "MOVIE MAX — premium movies, series and entertainment, broadcasting 24 hours a day.",
      hls_url: "https://5caf24a595d94.streamlock.net:1937/sykapjxrcp/sykapjxrcp/playlist.m3u8",
      streaming_provider: "Wowza Streaming Engine",
    });
    if (error) throw new Error(error.message);
  }
  const { data: dest } = await db.from("stream_destinations").select("id").eq("channel_id", channelId).maybeSingle();
  if (!dest) {
    await db.from("stream_destinations").insert({
      channel_id: channelId,
      provider: "Wowza Streaming Engine",
      rtmp_url: "rtmp://www.wowzacontrol.com:1935/sykapjxrcp",
      stream_name: "sykapjxrcp",
      username: "sykapjxrcp",
    });
  }
  const { data: overlays } = await db.from("graphics_overlays").select("id").eq("channel_id", channelId).limit(1);
  if (!overlays?.length) {
    const base = Date.now();
    await db.from("graphics_overlays").insert(
      OVERLAYS.map((o, i) => ({
        channel_id: channelId,
        kind: o.kind as never,
        name: o.name,
        enabled: o.enabled,
        config: o.config as Json,
        created_at: new Date(base + i).toISOString(),
      })),
    );
  }
  return channelId;
}
