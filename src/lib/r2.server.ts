import { AwsClient } from "aws4fetch";

/** Cloudflare R2 access (server-only). Credentials come from project secrets and never reach the browser. */
export function getR2() {
  const accountId = process.env["R2_ACCOUNT_ID"];
  const accessKeyId = process.env["R2_ACCESS_KEY_ID"];
  const secretAccessKey = process.env["R2_SECRET_ACCESS_KEY"];
  const bucket = process.env["R2_BUCKET"];
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  const client = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" });
  const base = `https://${accountId}.r2.cloudflarestorage.com/${bucket}`;
  const objectUrl = (key: string) => `${base}/${key.split("/").map(encodeURIComponent).join("/")}`;
  return { client, bucket, base, objectUrl };
}

export function requireR2() {
  const r2 = getR2();
  if (!r2) throw new Error("Media storage is not connected. Add the Cloudflare R2 credentials in Settings → Storage.");
  return r2;
}

export async function presign(url: string, method: "GET" | "PUT", expiresSeconds = 3600) {
  const r2 = requireR2();
  const u = new URL(url);
  u.searchParams.set("X-Amz-Expires", String(expiresSeconds));
  const signed = await r2.client.sign(new Request(u.toString(), { method }), { aws: { signQuery: true } });
  return signed.url;
}

export async function presignGet(key: string, expiresSeconds = 3600) {
  const r2 = requireR2();
  return presign(r2.objectUrl(key), "GET", expiresSeconds);
}

const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1] ?? null;

export async function createMultipart(key: string, contentType: string) {
  const r2 = requireR2();
  const res = await r2.client.fetch(`${r2.objectUrl(key)}?uploads`, { method: "POST", headers: { "content-type": contentType } });
  const body = await res.text();
  if (!res.ok) throw new Error(`Storage refused the upload [${res.status}]`);
  const uploadId = tag(body, "UploadId");
  if (!uploadId) throw new Error("Storage did not return an upload id");
  return uploadId;
}

export async function signParts(key: string, uploadId: string, partNumbers: number[]) {
  const r2 = requireR2();
  return Promise.all(
    partNumbers.map(async (n) => {
      const u = new URL(r2.objectUrl(key));
      u.searchParams.set("partNumber", String(n));
      u.searchParams.set("uploadId", uploadId);
      return { partNumber: n, url: await presign(u.toString(), "PUT", 6 * 3600) };
    }),
  );
}

export async function listParts(key: string, uploadId: string) {
  const r2 = requireR2();
  const res = await r2.client.fetch(`${r2.objectUrl(key)}?uploadId=${encodeURIComponent(uploadId)}`, { method: "GET" });
  const body = await res.text();
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Could not read upload progress [${res.status}]`);
  const parts: { partNumber: number; etag: string; size: number }[] = [];
  for (const m of body.matchAll(/<Part>([\s\S]*?)<\/Part>/g)) {
    parts.push({ partNumber: Number(tag(m[1], "PartNumber")), etag: tag(m[1], "ETag") ?? "", size: Number(tag(m[1], "Size")) });
  }
  return parts;
}

export async function completeMultipart(key: string, uploadId: string, parts: { partNumber: number; etag: string }[]) {
  const r2 = requireR2();
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
  await r2.client.fetch(`${r2.objectUrl(key)}?uploadId=${encodeURIComponent(uploadId)}`, { method: "DELETE" });
}

export async function deleteObject(key: string) {
  const r2 = requireR2();
  const res = await r2.client.fetch(r2.objectUrl(key), { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw new Error(`Storage could not delete the file [${res.status}]`);
}

export async function headObject(key: string) {
  const r2 = requireR2();
  const res = await r2.client.fetch(r2.objectUrl(key), { method: "HEAD" });
  return { ok: res.ok, status: res.status, size: Number(res.headers.get("content-length") ?? 0) };
}

export async function testBucket() {
  const r2 = requireR2();
  const res = await r2.client.fetch(`${r2.base}?list-type=2&max-keys=1`, { method: "GET" });
  return { ok: res.ok, status: res.status };
}
