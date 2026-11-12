/**
 * Website playout: the public site plays the published schedule itself, so viewers see the
 * scheduled programme without an external playout engine. Every viewer computes the same
 * position from the clock, so everyone watches the same moment — like television.
 * Mirrors `pickProgramme` in public/engine/movie-max-engine.mjs.
 */

export interface PlayoutMedia {
  id: string;
  title: string;
  duration_seconds: number | null;
  playable: boolean;
  url: string | null;
}
export interface PlayoutEntry {
  id: string;
  title: string;
  media_id: string | null;
  playlist_id: string | null;
  starts_at: string;
  ends_at: string;
  priority: number | null;
}
export interface PlayoutPlaylist {
  id: string;
  repeat: boolean;
  items: { media_id: string }[];
}
export interface PlayoutBundle {
  entries: PlayoutEntry[];
  media: PlayoutMedia[];
  playlists: PlayoutPlaylist[];
}
export interface PlayoutPick {
  key: string;
  entry: PlayoutEntry;
  media: PlayoutMedia & { url: string };
  /** Seconds into the media file that should be on screen right now. */
  offset: number;
  title: string;
  endsAt: string;
}

export function pickWebProgramme(bundle: PlayoutBundle | null | undefined, now: number): PlayoutPick | null {
  if (!bundle) return null;
  const media = new Map(bundle.media.map((m) => [m.id, m]));
  const playlists = new Map(bundle.playlists.map((p) => [p.id, p]));
  const live = bundle.entries
    .filter((e) => Date.parse(e.starts_at) <= now && now < Date.parse(e.ends_at))
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || Date.parse(b.starts_at) - Date.parse(a.starts_at));
  const ok = (m: PlayoutMedia | undefined): m is PlayoutMedia & { url: string } => !!m && m.playable && !!m.url;

  for (const entry of live) {
    const elapsed = (now - Date.parse(entry.starts_at)) / 1000;
    if (entry.media_id) {
      const m = media.get(entry.media_id);
      if (!ok(m)) continue;
      const dur = Number(m.duration_seconds) || 0;
      const loop = dur > 0 ? Math.floor(elapsed / dur) : 0;
      return { key: `${entry.id}:${m.id}:${loop}`, entry, media: m, offset: Math.max(0, dur > 0 ? elapsed - loop * dur : elapsed), title: entry.title || m.title, endsAt: entry.ends_at };
    }
    if (entry.playlist_id) {
      const pl = playlists.get(entry.playlist_id);
      const items = (pl?.items ?? []).map((i) => media.get(i.media_id)).filter((m): m is PlayoutMedia & { url: string } => ok(m) && Number(m.duration_seconds) > 0);
      const total = items.reduce((s, m) => s + Number(m.duration_seconds), 0);
      if (!pl || !items.length || total <= 0) continue;
      if (!pl.repeat && elapsed >= total) continue;
      const loop = Math.floor(elapsed / total);
      let pos = elapsed - loop * total;
      for (let i = 0; i < items.length; i++) {
        const m = items[i]!;
        const d = Number(m.duration_seconds);
        if (pos < d) return { key: `${entry.id}:${m.id}:${loop * 1000 + i}`, entry, media: m, offset: Math.max(0, pos), title: entry.title || m.title, endsAt: entry.ends_at };
        pos -= d;
      }
    }
  }
  return null;
}
