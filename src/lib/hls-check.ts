/** HLS stream validation used by the Streaming Endpoints health checker. Runs server-side (fetch only). */

export interface HlsCheckStep {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
}

export interface HlsCheckResult {
  status: "connected" | "offline" | "error" | "not_configured";
  steps: HlsCheckStep[];
  variants: { bandwidth: number | null; resolution: string | null; codecs: string | null; uri: string }[];
  hasVideo: boolean | null;
  hasAudio: boolean | null;
  resolution: string | null;
  targetDuration: number | null;
  mediaSequence: number | null;
  latencyMs: number | null;
}

const attr = (line: string, name: string) => {
  const m = line.match(new RegExp(`${name}=("([^"]*)"|[^,]*)`));
  return m ? (m[2] ?? m[1]) : null;
};

export function parseMaster(text: string, baseUrl: string) {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const variants: HlsCheckResult["variants"] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("#EXT-X-STREAM-INF")) {
      const uri = lines.slice(i + 1).find((l) => l && !l.startsWith("#"));
      if (uri) {
        variants.push({
          bandwidth: Number(attr(lines[i], "BANDWIDTH")) || null,
          resolution: attr(lines[i], "RESOLUTION"),
          codecs: attr(lines[i], "CODECS"),
          uri: new URL(uri, baseUrl).toString(),
        });
      }
    }
  }
  return variants;
}

export function parseMedia(text: string, baseUrl: string) {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const segments: string[] = [];
  let targetDuration: number | null = null;
  let mediaSequence: number | null = null;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith("#EXT-X-TARGETDURATION:")) targetDuration = Number(l.split(":")[1]);
    if (l.startsWith("#EXT-X-MEDIA-SEQUENCE:")) mediaSequence = Number(l.split(":")[1]);
    if (l.startsWith("#EXTINF")) {
      const uri = lines.slice(i + 1).find((x) => x && !x.startsWith("#"));
      if (uri) segments.push(new URL(uri, baseUrl).toString());
    }
  }
  return { segments, targetDuration, mediaSequence, ended: text.includes("#EXT-X-ENDLIST") };
}

async function timedFetch(url: string, init: RequestInit = {}, ms = 8000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctl.signal, headers: { "user-agent": "MOVIE-MAX-HealthCheck/1.0", ...(init.headers ?? {}) } });
  } finally {
    clearTimeout(t);
  }
}

export async function checkHlsStream(url: string | null | undefined): Promise<HlsCheckResult> {
  const result: HlsCheckResult = { status: "not_configured", steps: [], variants: [], hasVideo: null, hasAudio: null, resolution: null, targetDuration: null, mediaSequence: null, latencyMs: null };
  const step = (id: string, label: string, ok: boolean, detail: string) => result.steps.push({ id, label, ok, detail });
  if (!url) {
    step("configured", "Public HLS URL configured", false, "No HLS master playlist URL has been set.");
    return result;
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("bad protocol");
  } catch {
    result.status = "error";
    step("configured", "Public HLS URL configured", false, "The URL is not a valid http(s) address.");
    return result;
  }
  step("configured", "Public HLS URL configured", true, parsed.toString());

  const t0 = Date.now();
  let masterText = "";
  try {
    const res = await timedFetch(url);
    result.latencyMs = Date.now() - t0;
    masterText = await res.text();
    if (!res.ok) {
      result.status = "offline";
      step("master", "Master playlist reachable", false, `HTTP ${res.status}`);
      return result;
    }
  } catch (e) {
    result.status = "offline";
    step("master", "Master playlist reachable", false, e instanceof Error && e.name === "AbortError" ? "Timed out after 8s" : "Could not connect");
    return result;
  }
  if (!masterText.trimStart().startsWith("#EXTM3U")) {
    result.status = "error";
    step("master", "Master playlist reachable", false, "Response is not an HLS playlist (#EXTM3U missing)");
    return result;
  }
  step("master", "Master playlist reachable", true, `Responded in ${result.latencyMs} ms`);

  let mediaUrl = url;
  let mediaText = masterText;
  if (masterText.includes("#EXT-X-STREAM-INF")) {
    result.variants = parseMaster(masterText, url);
    const best = [...result.variants].sort((a, b) => (b.bandwidth ?? 0) - (a.bandwidth ?? 0))[0];
    result.resolution = best?.resolution ?? null;
    const codecs = result.variants.map((v) => v.codecs ?? "").join(",");
    if (codecs) {
      result.hasVideo = /avc1|avc3|hvc1|hev1|av01|vp09/i.test(codecs);
      result.hasAudio = /mp4a|ac-3|ec-3|opus/i.test(codecs);
    }
    if (!best) {
      result.status = "error";
      step("variants", "Renditions listed", false, "Master playlist lists no renditions");
      return result;
    }
    step("variants", "Renditions listed", true, result.variants.map((v) => v.resolution ?? `${Math.round((v.bandwidth ?? 0) / 1000)} kbps`).join(" · "));
    try {
      const res = await timedFetch(best.uri);
      mediaText = await res.text();
      if (!res.ok || !mediaText.includes("#EXTINF")) {
        result.status = "error";
        step("media", "Media playlist accessible", false, res.ok ? "Playlist has no segments" : `HTTP ${res.status}`);
        return result;
      }
      mediaUrl = best.uri;
    } catch {
      result.status = "error";
      step("media", "Media playlist accessible", false, "Could not load the rendition playlist");
      return result;
    }
  }
  const media = parseMedia(mediaText, mediaUrl);
  result.targetDuration = media.targetDuration;
  result.mediaSequence = media.mediaSequence;
  if (media.segments.length === 0) {
    result.status = "error";
    step("media", "Media playlist accessible", false, "No segments listed");
    return result;
  }
  step("media", "Media playlist accessible", true, `${media.segments.length} segments, target ${media.targetDuration ?? "?"}s`);
  if (media.ended) {
    result.status = "error";
    step("live", "Stream is live (not on-demand)", false, "Playlist has #EXT-X-ENDLIST — this is a finished recording, not a live channel");
    return result;
  }

  // Segment fetch + container sniff
  const last = media.segments[media.segments.length - 1];
  try {
    const res = await timedFetch(last, { headers: { range: "bytes=0-187" } });
    const buf = new Uint8Array(await res.arrayBuffer());
    if (!res.ok || buf.length === 0) throw new Error(String(res.status));
    const ascii = String.fromCharCode(...buf.slice(4, 8));
    const isTs = buf[0] === 0x47;
    const isFmp4 = ["ftyp", "styp", "moof", "sidx"].includes(ascii);
    step("segment", "Video segments downloadable", isTs || isFmp4, isTs ? "MPEG-TS segment" : isFmp4 ? "fMP4 segment" : "Unrecognised segment format");
    if (!isTs && !isFmp4) {
      result.status = "error";
      return result;
    }
  } catch {
    result.status = "error";
    step("segment", "Video segments downloadable", false, "Latest segment could not be downloaded");
    return result;
  }

  // Liveness: playlist must advance
  const wait = Math.min(Math.max((media.targetDuration ?? 4) * 1000, 2000), 6500);
  await new Promise((r) => setTimeout(r, wait));
  try {
    const res = await timedFetch(mediaUrl);
    const again = parseMedia(await res.text(), mediaUrl);
    const advanced =
      (again.mediaSequence != null && media.mediaSequence != null && again.mediaSequence > media.mediaSequence) ||
      again.segments[again.segments.length - 1] !== last;
    step("advancing", "New segments being generated", advanced, advanced ? `Playlist advanced within ${Math.round(wait / 1000)}s` : `No new segment after ${Math.round(wait / 1000)}s`);
    if (!advanced) {
      result.status = "error";
      return result;
    }
  } catch {
    result.status = "error";
    step("advancing", "New segments being generated", false, "Playlist refresh failed");
    return result;
  }

  step("tracks", "Contains video and audio", result.hasVideo !== false && result.hasAudio !== false,
    result.hasVideo == null ? "Codecs not declared in master playlist" : `video: ${result.hasVideo ? "yes" : "no"} · audio: ${result.hasAudio ? "yes" : "no"}`);
  result.status = "connected";
  return result;
}
