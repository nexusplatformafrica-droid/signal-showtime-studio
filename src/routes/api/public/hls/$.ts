import { createFileRoute } from "@tanstack/react-router";
import { resolveRelayTarget, rewritePlaylist } from "@/lib/stream-url";

/**
 * Same-site HLS relay: lets the https website play an http-only origin (e.g. Wowza on port 1935).
 * Only files inside the channel's configured playlist folder can be fetched — never an open proxy.
 */

let cache: { slug: string; url: string | null; at: number } | null = null;

async function originFor(slug: string): Promise<string | null> {
  if (cache && cache.slug === slug && Date.now() - cache.at < 30_000) return cache.url;
  const { createRest } = await import("@/lib/db/rest");
  const { db } = createRest(null);
  const { data } = await db.from("channels").select("hls_url").eq("slug", slug).maybeSingle();
  cache = { slug, url: data?.hls_url ?? null, at: Date.now() };
  return cache.url;
}

const CORS = { "access-control-allow-origin": "*" };

export const Route = createFileRoute("/api/public/hls/$")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: { ...CORS, "access-control-allow-headers": "range" } }),
      GET: async ({ request, params }) => {
        const splat = params._splat ?? "";
        const slash = splat.indexOf("/");
        const slug = slash > 0 ? splat.slice(0, slash) : "";
        if (!/^[a-z0-9-]{1,60}$/.test(slug)) return new Response("Not found", { status: 404, headers: CORS });
        const hlsUrl = await originFor(slug);
        if (!hlsUrl) return new Response("Stream not configured", { status: 404, headers: CORS });
        const target = resolveRelayTarget(hlsUrl, splat.slice(slash + 1), new URL(request.url).search);
        if (!target) return new Response("Not found", { status: 404, headers: CORS });

        const range = request.headers.get("range");
        let upstream: Response;
        try {
          upstream = await fetch(target.toString(), { headers: { "user-agent": "MOVIE-MAX-Relay/1.0", ...(range ? { range } : {}) } });
        } catch {
          return new Response("Stream origin unreachable", { status: 502, headers: CORS });
        }
        if (!upstream.ok && upstream.status !== 206) {
          return new Response(upstream.status === 404 ? "Stream offline" : "Stream origin error", { status: upstream.status === 404 ? 404 : 502, headers: { ...CORS, "cache-control": "no-store" } });
        }
        const isPlaylist = target.pathname.toLowerCase().endsWith(".m3u8");
        if (isPlaylist) {
          const text = rewritePlaylist(await upstream.text(), hlsUrl);
          return new Response(text, { headers: { ...CORS, "content-type": "application/vnd.apple.mpegurl", "cache-control": "no-cache, no-store" } });
        }
        const headers = new Headers(CORS);
        for (const h of ["content-type", "content-length", "content-range", "accept-ranges"]) {
          const v = upstream.headers.get(h);
          if (v) headers.set(h, v);
        }
        headers.set("cache-control", "public, max-age=60");
        return new Response(upstream.body, { status: upstream.status, headers });
      },
    },
  },
});
