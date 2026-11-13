import { AwsClient } from "aws4fetch";

/**
 * Cloudflare R2 access (server-only). Two ways to reach the bucket, both server-side so nothing secret reaches the browser:
 * - "direct": R2 keys stored as project secrets (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET).
 * - "worker": the station's own upload service on Cloudflare Workers (built in below; UPLOAD_WORKER_URL + UPLOAD_TOKEN
 *   override it), which signs uploads and serves files from the bucket's public address (R2_PUBLIC_BASE_URL).
 */
const DEFAULT_WORKER = {
  // The station's upload service on Cloudflare Workers. Kept in code (server-only file, never sent to
  // browsers) on purpose so every copy of this project uploads without re-entering settings.
  // Project secrets UPLOAD_WORKER_URL / UPLOAD_TOKEN override these when set.
  url: "https://moviemax-upload.nexusplatformafrica.workers.dev",
  token: "*",
  accountId: "84a2c76967d223897d4b8b7dfe46ca98",
  bucket: "moviemax",
  publicBase: "https://pub-12f7d967af73467f908bdcc926df41e7.r2.dev",
};

type Direct = { mode: "direct"; client: AwsClient; accountId: string; bucket: string; base: string; objectUrl: (key: string) => string };
type Worker = { mode: "worker"; workerUrl: string; token: string; accountId: string; bucket: string; publicBase: string };
export type R2 = Direct | Worker;

const encKey = (key: string) => key.split("/").map(encodeURIComponent).join("/");

export function getR2(): R2 | null {
  const accountId = process.env["R2_ACCOUNT_ID"];
  const accessKeyId = process.env["R2_ACCESS_KEY_ID"];
  const secretAccessKey = process.env["R2_SECRET_ACCESS_KEY"];
  const bucket = process.env["R2_BUCKET"];
  if (accountId && accessKeyId && secretAccessKey && bucket) {
    const client = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" });
    const base = `https://${accountId}.r2.cloudflarestorage.com/${bucket}`;
    return { mode: "direct", client, accountId, bucket, base, objectUrl: (key: string) => `${base}/${encKey(key)}` };
  }
  const workerUrl = process.env["UPLOAD_WORKER_URL"] || DEFAULT_WORKER.url;
  const token = process.env["UPLOAD_TOKEN"] || DEFAULT_WORKER.token;
  if (workerUrl && token) {
    return {
      mode: "worker",
      workerUrl: workerUrl.replace(/\/+$/, ""),
      token,
      accountId: process.env["R2_PUBLIC_ACCOUNT_ID"] || DEFAULT_WORKER.accountId,
      bucket: process.env["R2_PUBLIC_BUCKET"] || DEFAULT_WORKER.bucket,
      publicBase: (process.env["R2_PUBLIC_BASE_URL"] || DEFAULT_WORKER.publicBase).replace(/\/+$/, ""),
    };
  }
  return null;
}

export function requireR2() {
  const r2 = getR2();
  if (!r2) throw new Error("Media storage is not connected. Add the upload service or the Cloudflare R2 credentials in Settings → Storage.");
  return r2;
}

/** Calls the upload service. Errors keep the service's status and message so problems are easy to diagnose. */
export async function workerCall<T>(r2: Worker, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${r2.workerUrl}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${r2.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Upload service ${path} failed [${res.status}]: ${text.slice(0, 500)}`);
    if (res.status === 401) throw new Error("The upload service refused the upload token. Make sure UPLOAD_TOKEN matches the one set on the Cloudflare worker.");
    throw new Error(`Upload service error [${res.status}]: ${text.slice(0, 300)}`);
  }
  return JSON.parse(text) as T;
}

export async function presign(url: string, method: "GET" | "PUT", expiresSeconds = 3600) {
  const r2 = requireR2();
  if (r2.mode !== "direct") throw new Error("Signing raw links needs the direct R2 credentials.");
  const u = new URL(url);
  u.searchParams.set("X-Amz-Expires", String(expiresSeconds));
  const signed = await r2.client.sign(new Request(u.toString(), { method }), { aws: { signQuery: true } });
  return signed.url;
}

/** A link that plays the file: a short-lived signed link (direct) or the bucket's public address (upload service). */
export async function presignGet(key: string, expiresSeconds = 3600) {
  const r2 = requireR2();
  if (r2.mode === "worker") return `${r2.publicBase}/${encKey(key)}`;
  return presign(r2.objectUrl(key), "GET", expiresSeconds);
}

const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1] ?? null;

/** Starts a resumable upload. `folder` is where the file goes; the final key is returned (the upload service picks its own). */
export async function createMultipart(folder: string, filename: string, contentType: string) {
  const r2 = requireR2();
  if (r2.mode === "worker") {
    const r = await workerCall<{ key: string; uploadId: string }>(r2, "/uploads/create", { folder, filename });
    if (!r.key || !r.uploadId) throw new Error("The upload service did not return an upload id");
    return { key: r.key, uploadId: r.uploadId };
  }
  const key = `${folder}/${Date.now()}-${filename}`;
  const res = await r2.client.fetch(`${r2.objectUrl(key)}?uploads`, { method: "POST", headers: { "content-type": contentType } });
  const body = await res.text();
  if (!res.ok) throw new Error(`Storage refused the upload [${res.status}]`);
  const uploadId = tag(body, "UploadId");
  if (!uploadId) throw new Error("Storage did not return an upload id");
  return { key, uploadId };
}

export async function signParts(key: string, uploadId: string, partNumbers: number[]) {
  const r2 = requireR2();
  if (r2.mode === "worker") {
    const r = await workerCall<{ urls: { partNumber: number; url: string }[] }>(r2, "/uploads/sign", { key, uploadId, partNumbers });
    return r.urls;
  }
  return Promise.all(
    partNumbers.map(async (n) => {
      const u = new URL(r2.objectUrl(key));
      u.searchParams.set("partNumber", String(n));
      u.searchParams.set("uploadId", uploadId);
      return { partNumber: n, url: await presign(u.toString(), "PUT", 6 * 3600) };
    }),
  );
}

/** Parts already uploaded (for resuming). The upload service can't list parts, so a paused upload restarts from the beginning. */
export async function listParts(key: string, uploadId: string) {
  const r2 = requireR2();
  if (r2.mode === "worker") return null;
  const res = await r2.client.fetch(`${r2.objectUrl(key)}?uploadId=${encodeURIComponent(uploadId)}`, { method: "GET" });
  const body = await res.text();
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Could not read upload progress [${res.status}]`);
  const parts: { partNumber: number; etag: string; size: number }[] = [];
  for (const m of body.matchAll(/<Part>([\s\S]*?)<\/Part>/g)) {
    const inner = m[1] ?? "";
    parts.push({ partNumber: Number(tag(inner, "PartNumber")), etag: tag(inner, "ETag") ?? "", size: Number(tag(inner, "Size")) });
  }
  return parts;
}

export async function completeMultipart(key: string, uploadId: string, parts: { partNumber: number; etag: string }[]) {
  const r2 = requireR2();
  if (r2.mode === "worker") {
    await workerCall(r2, "/uploads/complete", { key, uploadId, parts });
    return;
  }
  const xml =
    "<CompleteMultipartUpload>" +
    parts
      .sort((a, b) => a.partNumber - b.partNumber)
      .map((p) => `<Part><PartNumber>${p.partNumber}</PartNumber><ETag>${p.etag.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</ETag></Part>`)
      .join("") +
    "</CompleteMultipartUpload>";
  const res = await r2.client.fetch(`${r2.objectUrl(key)}?uploadId=${encodeURIComponent(uploadId)}`, {
    method: "POST",
    headers: { "content-type": "application/xml" },
    body: xml,
  });
  const body = await res.text();
  if (!res.ok || body.includes("<Error>")) throw new Error(`Storage could not finish the upload [${res.status}]`);
}

export async function abortMultipart(key: string, uploadId: string) {
  const r2 = requireR2();
  if (r2.mode === "worker") {
    await workerCall(r2, "/uploads/abort", { key, uploadId });
    return;
  }
  await r2.client.fetch(`${r2.objectUrl(key)}?uploadId=${encodeURIComponent(uploadId)}`, { method: "DELETE" });
}

export async function deleteObject(key: string) {
  const r2 = requireR2();
  if (r2.mode === "worker") {
    await workerCall(r2, "/uploads/delete", { key });
    return;
  }
  const res = await r2.client.fetch(r2.objectUrl(key), { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw new Error(`Storage could not delete the file [${res.status}]`);
}

export async function headObject(key: string) {
  const r2 = requireR2();
  if (r2.mode === "worker") {
    const res = await fetch(`${r2.publicBase}/${encKey(key)}`, { method: "HEAD" });
    return { ok: res.ok, status: res.status, size: Number(res.headers.get("content-length") ?? 0) };
  }
  const res = await r2.client.fetch(r2.objectUrl(key), { method: "HEAD" });
  return { ok: res.ok, status: res.status, size: Number(res.headers.get("content-length") ?? 0) };
}

export async function testBucket() {
  const r2 = requireR2();
  if (r2.mode === "worker") {
    const health = await fetch(`${r2.workerUrl}/health`);
    const h = (await health.json().catch(() => ({}))) as { configured?: boolean };
    if (!health.ok || !h.configured) return { ok: false, status: health.status };
    // Signing a throwaway upload link proves the token is accepted; nothing is uploaded.
    await workerCall(r2, "/uploads/single", { folder: "health-check", filename: "probe.txt" });
    return { ok: true, status: 200 };
  }
  const res = await r2.client.fetch(`${r2.base}?list-type=2&max-keys=1`, { method: "GET" });
  return { ok: res.ok, status: res.status };
}

/** One-shot upload link for small files (thumbnails, logos, card pictures). Returns where to PUT and the public link. */
export async function signSingleUpload(folder: string, filename: string) {
  const r2 = requireR2();
  if (r2.mode === "worker") {
    const r = await workerCall<{ key: string; url: string; publicUrl: string }>(r2, "/uploads/single", { folder, filename });
    return { key: r.key, uploadUrl: r.url, publicUrl: r.publicUrl };
  }
  const key = `${folder}/${Date.now()}-${filename}`;
  return { key, uploadUrl: await presign(r2.objectUrl(key), "PUT", 3600), publicUrl: null as string | null };
}
