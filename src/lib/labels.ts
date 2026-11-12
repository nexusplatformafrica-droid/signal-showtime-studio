import type { Database } from "@/integrations/supabase/types";

export type MediaCategory = Database["public"]["Enums"]["media_category"];
export type PlaylistKind = Database["public"]["Enums"]["playlist_kind"];

export const CATEGORY_LABELS: Record<MediaCategory, string> = {
  movie: "Movie", series: "Series", episode: "Episode", music_video: "Music video", news: "News",
  documentary: "Documentary", advertisement: "Advertisement", trailer: "Trailer", promo: "Promo",
  station_id: "Station ID", emergency: "Emergency standby", other: "Other",
};
export const CATEGORIES = Object.keys(CATEGORY_LABELS) as MediaCategory[];

export const PLAYLIST_KIND_LABELS: Record<PlaylistKind, string> = {
  morning: "Morning", afternoon: "Afternoon", prime_time: "Prime time", night: "Night", marathon: "Movie marathon",
  music: "Music", advertisement: "Advertisement", emergency: "Emergency", standby: "Standby", custom: "Custom",
};
export const PLAYLIST_KINDS = Object.keys(PLAYLIST_KIND_LABELS) as PlaylistKind[];

export const CLASSIFICATIONS = ["G", "PG", "13", "16", "18"];

/** Accent token per category for timeline blocks. */
export const CATEGORY_TONE: Partial<Record<MediaCategory, string>> = {
  movie: "border-l-program", series: "border-l-info", episode: "border-l-info", news: "border-l-warn",
  advertisement: "border-l-gold", promo: "border-l-gold", trailer: "border-l-gold", music_video: "border-l-preview",
  documentary: "border-l-preview",
};
