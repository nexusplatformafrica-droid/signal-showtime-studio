/** Understands links to media files that were uploaded to Cloudflare R2 outside the app (pure, browser-safe). */

export type MediaLink =
  | { ok: true; kind: "bucket"; key: string; url: string; filename: string; title: string }
  | { ok: true; kind: "public"; url: string; filename: string; title: string }
  | { ok: false; error: string };

const VIDEO_EXT = /\.(mp4|m4v|mov|mkv|webm|ts|mxf|avi|mpg|mpeg|flv|wmv|3gp)$/i;

export function titleFromFilename(name: string) {
  return name.replace(/\.[^.]+$/, "").replace(/[._]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 200) || "Untitled";
}

/**
 * Accepts a public R2 link (r2.dev or custom domain) or an R2 S3 endpoint link
 * (https://ACCOUNT.r2.cloudflarestorage.com/BUCKET/key, or BUCKET.ACCOUNT.r2… style).
 * S3 endpoint links that point at the connected bucket are turned into an object key,
 * so the app can sign fresh access links instead of relying on an expiring one.
 */
export function parseMediaLink(raw: string, r2?: { accountId: string; bucket: string } | null): MediaLink {
  const text = raw.trim();
  if (!text) return { ok: false, error: "Paste a link to the media file." };
  let u: URL;
  try {
    u = new URL(text);
  } catch {
    return { ok: false, error: "That is not a valid link. It should start with https://" };
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return { ok: false, error: "The link must start with https://" };
  if (u.username || u.password) return { ok: false, error: "Remove the username/password from the link." };

  const segments = u.pathname.split("/").filter(Boolean).map((s) => {
    try { return decodeURIComponent(s); } catch { return s; }
  });
  const filename = segments[segments.length - 1] ?? "";
  if (!filename) return { ok: false, error: "The link must point to a file, not a folder." };
  if (!VIDEO_EXT.test(filename)) return { ok: false, error: "The link must point to a video file (for example .mp4, .mov, .mkv, .ts)." };

  const host = u.hostname.toLowerCase();
  const signedLink = u.searchParams.has("X-Amz-Signature") || u.searchParams.has("X-Amz-Credential");
  const s3 = host.endsWith(".r2.cloudflarestorage.com");

  if (s3) {
    const sub = host.slice(0, -".r2.cloudflarestorage.com".length).split(".");
    // path style: ACCOUNT.r2… /BUCKET/key   ·   virtual host style: BUCKET.ACCOUNT.r2… /key
    const [account, bucket, keyParts] = sub.length === 1 ? [sub[0], segments[0], segments.slice(1)] : [sub[1], sub[0], segments];
    const matches = !!r2 && account === r2.accountId.toLowerCase() && bucket === r2.bucket;
    if (matches && keyParts.length) {
      const clean = new URL(u.origin + u.pathname);
      return { ok: true, kind: "bucket", key: keyParts.join("/"), url: clean.toString(), filename, title: titleFromFilename(filename) };
    }
    if (!r2) return { ok: false, error: "This is a private R2 link. Connect R2 in Settings → Storage first, or paste the file's public link (r2.dev or your custom domain)." };
    return { ok: false, error: `This link is for a different R2 bucket. The connected bucket is "${r2.bucket}".` };
  }

  if (signedLink) return { ok: false, error: "This is a temporary signed link that will stop working. Paste the file's public link instead." };
  return { ok: true, kind: "public", url: u.toString(), filename, title: titleFromFilename(filename) };
}
