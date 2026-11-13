/** Browser-side media upload helpers: metadata probing, thumbnail capture and resumable multipart upload. */

export const PART_SIZE = 16 * 1024 * 1024;
const CONCURRENCY = 3;

export interface ProbeResult {
  duration: number | null;
  width: number | null;
  height: number | null;
  thumbnail: Blob | null;
}

const EMPTY: ProbeResult = { duration: null, width: null, height: null, thumbnail: null };

export function probeVideo(file: File): Promise<ProbeResult> {
  if (!file.type.startsWith("video/") && !/\.(mp4|mov|mkv|webm|m4v|ts|mxf)$/i.test(file.name)) return Promise.resolve(EMPTY);
  const url = URL.createObjectURL(file);
  return probeSrc(url, false).finally(() => URL.revokeObjectURL(url));
}

/** Reads duration, size and a thumbnail from a linked file. Thumbnails need the host to allow CORS; otherwise only metadata is read. */
export async function probeVideoUrl(url: string): Promise<ProbeResult> {
  const withCors = await probeSrc(url, true);
  if (withCors.duration != null) return withCors;
  return probeSrc(url, false);
}

function probeSrc(src: string, cors: boolean): Promise<ProbeResult> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    if (cors) v.crossOrigin = "anonymous";
    v.src = src;
    let done = false;
    const finish = (r: ProbeResult) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      v.removeAttribute("src");
      v.load();
      resolve(r);
    };
    const timer = setTimeout(() => finish(Number.isFinite(v.duration) ? { ...EMPTY, duration: v.duration, width: v.videoWidth || null, height: v.videoHeight || null } : EMPTY), 15000);
    v.onerror = () => finish(EMPTY);
    v.onloadedmetadata = () => {
      const duration = Number.isFinite(v.duration) ? v.duration : null;
      v.currentTime = Math.min(Math.max((duration ?? 10) * 0.1, 1), 120);
    };
    v.onseeked = () => {
      const w = v.videoWidth || null;
      const h = v.videoHeight || null;
      const meta = { duration: Number.isFinite(v.duration) ? v.duration : null, width: w, height: h };
      if (!w || !h) return finish({ ...meta, thumbnail: null });
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 480;
        canvas.height = Math.round((480 * h) / w);
        canvas.getContext("2d")?.drawImage(v, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((b) => finish({ ...meta, thumbnail: b }), "image/jpeg", 0.78);
      } catch {
        finish({ ...meta, thumbnail: null });
      }
    };
  });
}

export const fingerprintOf = (file: File) => `${file.size}:${file.name.toLowerCase()}`;
const resumeKey = (file: File) => `mm-upload:${file.name}:${file.size}:${file.lastModified}`;

export function getResumable(file: File): string | null {
  try {
    return localStorage.getItem(resumeKey(file));
  } catch {
    return null;
  }
}
export function setResumable(file: File, mediaId: string | null) {
  try {
    if (mediaId) localStorage.setItem(resumeKey(file), mediaId);
    else localStorage.removeItem(resumeKey(file));
  } catch {
    /* ignore */
  }
}

function putPart(url: string, blob: Blob, onProgress: (loaded: number) => void, signal: AbortSignal) {
  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag = xhr.getResponseHeader("ETag");
        if (!etag) reject(new Error("Storage did not expose the ETag header — check the bucket CORS settings (ExposeHeaders: ETag)."));
        else resolve(etag);
      } else reject(new Error(`Part upload failed (HTTP ${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload (check bucket CORS)"));
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(blob);
  });
}

export interface UploadFns {
  start: (a: { data: { mediaId: string; filename: string; contentType: string; replace?: boolean } }) => Promise<{ uploadId: string; key: string; parts: { partNumber: number; etag: string; size: number }[] }>;
  sign: (a: { data: { mediaId: string; partNumbers: number[] } }) => Promise<{ partNumber: number; url: string }[]>;
  complete: (a: { data: { mediaId: string; parts: { partNumber: number; etag: string }[] } }) => Promise<{ ok: boolean; size: number }>;
}

export async function uploadMultipart(opts: { file: File; mediaId: string; replace?: boolean | undefined; fns: UploadFns; onProgress: (pct: number) => void; signal: AbortSignal }) {
  const { file, mediaId, fns, onProgress, signal } = opts;
  const total = Math.max(1, Math.ceil(file.size / PART_SIZE));
  const started = await fns.start({ data: { mediaId, filename: file.name, contentType: file.type || "application/octet-stream", ...(opts.replace ? { replace: true } : {}) } });
  const done = new Map<number, string>();
  for (const p of started.parts) if (p.size === Math.min(PART_SIZE, file.size - (p.partNumber - 1) * PART_SIZE)) done.set(p.partNumber, p.etag);
  const progress = new Map<number, number>();
  for (const n of done.keys()) progress.set(n, Math.min(PART_SIZE, file.size - (n - 1) * PART_SIZE));
  const report = () => onProgress(Math.min(99, ([...progress.values()].reduce((a, b) => a + b, 0) / file.size) * 100));
  report();
  const pending = Array.from({ length: total }, (_, i) => i + 1).filter((n) => !done.has(n));
  let cursor = 0;
  async function worker() {
    while (cursor < pending.length) {
      if (signal.aborted) throw new Error("Upload paused");
      const batch = pending.slice(cursor, cursor + 1);
      cursor += 1;
      const signed = (await fns.sign({ data: { mediaId, partNumbers: batch } }))[0];
      if (!signed) throw new Error("Storage did not return an upload URL");
      const start = (signed.partNumber - 1) * PART_SIZE;
      const blob = file.slice(start, Math.min(start + PART_SIZE, file.size));
      let attempt = 0;
      for (;;) {
        try {
          const etag = await putPart(signed.url, blob, (l) => { progress.set(signed.partNumber, l); report(); }, signal);
          done.set(signed.partNumber, etag);
          break;
        } catch (e) {
          if (signal.aborted || ++attempt >= 3) throw e;
          await new Promise((r) => setTimeout(r, 1000 * attempt));
        }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pending.length || 1) }, worker));
  const res = await fns.complete({ data: { mediaId, parts: [...done.entries()].map(([partNumber, etag]) => ({ partNumber, etag })) } });
  onProgress(100);
  return res;
}

/** Uploads a picture (thumbnail, logo, card image) to the station's bucket and returns its public link. */
export async function uploadPicture(file: Blob, folder: "thumbnails" | "logos" | "brand"): Promise<string> {
  const { startImageUpload } = await import("@/lib/station.functions");
  const contentType = file.type || "image/jpeg";
  const { uploadUrl, publicUrl } = await startImageUpload({ data: { folder, filename: `picture.${contentType.split("/")[1] ?? "jpg"}`, contentType } });
  const res = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "content-type": contentType } });
  if (!res.ok) throw new Error(`The picture could not be uploaded (HTTP ${res.status}).`);
  return publicUrl;
}
