/**
 * Playback URL rules. Browsers on the https website block http:// streams (mixed content), so an
 * http origin (e.g. Wowza on :1935) is served through the same-site relay at /api/public/hls/{slug}/…
 */

export const RELAY_PREFIX = "/api/public/hls";

/** Directory the relay may read from: the origin playlist's folder. */
export function relayBase(hlsUrl: string): URL {
  return new URL(".", hlsUrl);
}

/** URL a browser player should load. https origins are used directly; http origins go through the relay. */
export function playbackUrl(hlsUrl: string | null | undefined, slug: string, origin = ""): string | null {
  if (!hlsUrl) return null;
  let u: URL;
  try {
    u = new URL(hlsUrl);
  } catch {
    return null;
  }
  if (u.protocol === "https:") return hlsUrl;
  const file = u.pathname.split("/").pop() || "playlist.m3u8";
  return `${origin}${RELAY_PREFIX}/${slug}/${file}${u.search}`;
}

const ALLOWED = /\.(m3u8|ts|aac|m4s|mp4|m4a|vtt|key)$/i;

/** Resolves a relay sub-path against the origin folder; null when it escapes the folder or isn't a stream file. */
export function resolveRelayTarget(hlsUrl: string, subPath: string, search = ""): URL | null {
  if (!subPath || !ALLOWED.test(subPath) || subPath.includes("\\")) return null;
  const base = relayBase(hlsUrl);
  let target: URL;
  try {
    target = new URL(subPath + search, base);
  } catch {
    return null;
  }
  if (target.origin !== base.origin || !target.pathname.startsWith(base.pathname)) return null;
  return target;
}

/** Makes absolute URIs that point inside the origin folder relative, so every request stays on the relay. */
export function rewritePlaylist(text: string, hlsUrl: string): string {
  const base = relayBase(hlsUrl).href;
  const rel = (uri: string) => (uri.startsWith(base) ? uri.slice(base.length) : uri);
  return text
    .split(/\r?\n/)
    .map((line) => {
      if (!line.startsWith("#")) return line.trim() ? rel(line.trim()) : line;
      return line.replace(/URI="([^"]+)"/g, (_m, u: string) => `URI="${rel(u)}"`);
    })
    .join("\n");
}
