import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireFirebaseAuth } from "@/lib/auth-middleware";
import type { Database } from "@/lib/db-types";
import type { AppRole } from "@/lib/permissions";
import { checkHlsStream } from "@/lib/hls-check";

type Ctx = { roles: AppRole[] };

function assertRoles(ctx: Ctx, roles: AppRole[]) {
  if (!ctx.roles.some((r) => r === "super_admin" || roles.includes(r))) throw new Error("You do not have permission for this action.");
}

const MEDIA_ROLES: AppRole[] = ["super_admin", "station_manager", "media_manager", "advertising_manager"];
const LIVE_ROLES: AppRole[] = ["super_admin", "station_manager", "broadcast_operator"];
const GRAPHICS_ROLES: AppRole[] = ["super_admin", "station_manager", "graphics_designer"];

const sanitize = (name: string) => name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 120) || "file";

// ------------------------------------------------------------------ storage

export const getStorageStatus = createServerFn({ method: "GET" })
  .middleware([requireFirebaseAuth])
  .handler(async () => {
    const { getR2 } = await import("@/lib/r2.server");
    const r2 = getR2();
    return { configured: !!r2, bucket: r2?.bucket ?? null, mode: r2?.mode ?? null, service: r2?.mode === "worker" ? r2.workerUrl : null };
  });

export const testStorage = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .handler(async ({ context }) => {
    assertRoles(context, ["super_admin", "station_manager"]);
    const { getR2, testBucket } = await import("@/lib/r2.server");
    const r2 = getR2();
    if (!r2) return { ok: false, message: "Storage is not connected." };
    try {
      const r = await testBucket();
      if (r2.mode === "worker") return { ok: r.ok, message: r.ok ? "Upload service is online and accepted the upload token." : `Upload service is not ready (HTTP ${r.status}). Check its settings on Cloudflare.` };
      return { ok: r.ok, message: r.ok ? "Bucket reachable with the configured credentials." : `Bucket responded with HTTP ${r.status}. Check the bucket name and key permissions.` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Could not reach Cloudflare R2." };
    }
  });

/** Upload link for a picture (thumbnail, logo, card image). The browser PUTs the file there; the link it returns plays publicly. */
export const startImageUpload = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((d) => z.object({ folder: z.enum(["thumbnails", "logos", "brand"]), filename: z.string().min(1).max(200), contentType: z.string().regex(/^image\//).max(60) }).parse(d))
  .handler(async ({ data, context }) => {
    assertRoles(context, [...MEDIA_ROLES, ...GRAPHICS_ROLES]);
    const { signSingleUpload } = await import("@/lib/r2.server");
    const ext = data.contentType.includes("png") ? "png" : data.contentType.includes("webp") ? "webp" : "jpg";
    const r = await signSingleUpload(`images/${data.folder}`, `${crypto.randomUUID()}.${ext}`);
    if (!r.publicUrl) throw new Error("Pictures need the upload service (its files have a public address).");
    return { uploadUrl: r.uploadUrl, publicUrl: r.publicUrl };
  });

export const startMediaUpload = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((d) => z.object({ mediaId: z.string().uuid(), filename: z.string().min(1).max(255), contentType: z.string().max(120), replace: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    assertRoles(context, MEDIA_ROLES);
    const { data: row, error } = await context.db.from("media_assets").select("id, channel_id, upload_id, storage_key").eq("id", data.mediaId).single();
    if (error || !row) throw new Error("Media record not found");
    const r2 = await import("@/lib/r2.server");
    if (row.upload_id && row.storage_key && !data.replace) {
      const parts = await r2.listParts(row.storage_key, row.upload_id);
      if (parts) return { uploadId: row.upload_id, key: row.storage_key, parts };
    }
    const { key, uploadId } = await r2.createMultipart(`channels/${row.channel_id}/media/${row.id}`, sanitize(data.filename), data.contentType || "application/octet-stream");
    await context.db
      .from("media_assets")
      .update({ upload_id: uploadId, storage_key: key, storage_bucket: r2.getR2()?.bucket ?? null, status: "uploading" })
      .eq("id", row.id);
    return { uploadId, key, parts: [] as { partNumber: number; etag: string; size: number }[] };
  });

export const signMediaParts = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((d) => z.object({ mediaId: z.string().uuid(), partNumbers: z.array(z.number().int().min(1).max(10000)).min(1).max(50) }).parse(d))
  .handler(async ({ data, context }) => {
    assertRoles(context, MEDIA_ROLES);
    const { data: row } = await context.db.from("media_assets").select("upload_id, storage_key").eq("id", data.mediaId).single();
    if (!row?.upload_id || !row.storage_key) throw new Error("Upload has not been started");
    const { signParts } = await import("@/lib/r2.server");
    return signParts(row.storage_key, row.upload_id, data.partNumbers);
  });

export const completeMediaUpload = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((d) => z.object({ mediaId: z.string().uuid(), parts: z.array(z.object({ partNumber: z.number().int().min(1), etag: z.string().min(1).max(200) })).min(1).max(10000) }).parse(d))
  .handler(async ({ data, context }) => {
    assertRoles(context, MEDIA_ROLES);
    const { data: row } = await context.db.from("media_assets").select("upload_id, storage_key").eq("id", data.mediaId).single();
    if (!row?.upload_id || !row.storage_key) throw new Error("Upload has not been started");
    const r2 = await import("@/lib/r2.server");
    await r2.completeMultipart(row.storage_key, row.upload_id, data.parts);
    const head = await r2.headObject(row.storage_key);
    await context.db
      .from("media_assets")
      .update({ upload_id: null, status: head.ok ? "ready" : "failed", ...(head.size ? { file_size: head.size } : {}) })
      .eq("id", data.mediaId);
    return { ok: head.ok, size: head.size };
  });

export const abortMediaUpload = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((d) => z.object({ mediaId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    assertRoles(context, MEDIA_ROLES);
    const { data: row } = await context.db.from("media_assets").select("upload_id, storage_key").eq("id", data.mediaId).single();
    if (row?.upload_id && row.storage_key) {
      const { abortMultipart } = await import("@/lib/r2.server");
      await abortMultipart(row.storage_key, row.upload_id).catch(() => undefined);
    }
    await context.db.from("media_assets").update({ upload_id: null, status: "failed" }).eq("id", data.mediaId);
    return { ok: true };
  });

export const getMediaPlaybackUrl = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((d) => z.object({ mediaId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.db.from("media_assets").select("storage_key, source_url, status").eq("id", data.mediaId).single();
    if (!row || row.status !== "ready") return { url: null as string | null };
    const { getR2, presignGet } = await import("@/lib/r2.server");
    if (row.storage_key && getR2()) return { url: await presignGet(row.storage_key, 3600) };
    return { url: row.storage_key ? null : row.source_url };
  });

/** Adds a library entry for a file that is already in R2 (pasted link) — nothing is uploaded or copied. */
export const importMediaLink = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((d) =>
    z.object({
      channelId: z.string().uuid(),
      url: z.string().min(8).max(2000),
      title: z.string().max(200).optional(),
      category: z.string().max(40),
      folderId: z.string().uuid().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    assertRoles(context, MEDIA_ROLES);
    const { getR2, headObject } = await import("@/lib/r2.server");
    const { parseMediaLink } = await import("@/lib/media-link");
    const r2 = getR2();
    const link = parseMediaLink(data.url, r2 ? { accountId: r2.accountId, bucket: r2.bucket } : null);
    if (!link.ok) throw new Error(link.error);

    let size: number | null = null;
    let mime: string | null = null;
    if (link.kind === "bucket") {
      const head = await headObject(link.key);
      if (!head.ok) throw new Error(head.status === 404 ? "That file was not found in the R2 bucket. Check the link." : `R2 refused access to the file [${head.status}].`);
      size = head.size || null;
    } else {
      let res: Response | null = null;
      try {
        res = await fetch(link.url, { method: "HEAD", redirect: "follow" });
        if (!res.ok) res = await fetch(link.url, { method: "GET", headers: { range: "bytes=0-0" }, redirect: "follow" });
      } catch {
        throw new Error("Could not reach that link. Make sure the file is public (R2 public bucket or custom domain).");
      }
      if (!res.ok) throw new Error(res.status === 404 ? "No file at that link (404). Check the link." : `The link is not publicly readable [HTTP ${res.status}]. Turn on public access for the bucket or use its custom domain.`);
      const range = res.headers.get("content-range")?.split("/")[1];
      size = Number(range ?? res.headers.get("content-length") ?? 0) || null;
      mime = res.headers.get("content-type");
      await res.body?.cancel().catch(() => undefined);
      if (mime && /^(text\/html|application\/json)/i.test(mime)) throw new Error("That link opens a web page, not a video file. Paste the direct link to the file.");
    }

    const { data: dupes } = await context.db.from("media_assets").select("title, status").eq("channel_id", data.channelId).eq("source_url", link.url).neq("status", "archived");
    if (dupes?.length) throw new Error(`This file is already in the library as "${dupes[0]!.title}".`);

    const { data: row, error } = await context.db
      .from("media_assets")
      .insert({
        channel_id: data.channelId,
        folder_id: data.folderId,
        title: data.title?.trim() || link.title,
        category: data.category as Database["public"]["Enums"]["media_category"],
        status: "ready",
        source_url: link.url,
        storage_key: link.kind === "bucket" ? link.key : null,
        storage_bucket: link.kind === "bucket" ? r2?.bucket ?? null : null,
        file_size: size,
        mime_type: mime && !/octet-stream/i.test(mime) ? mime.split(";")[0] ?? null : null,
        original_filename: link.filename,
        container: link.filename.split(".").pop()?.toLowerCase() ?? null,
        fingerprint: size ? `${size}:${link.filename.toLowerCase()}` : null,
        created_by: context.userId,
      })
      .select("id, title")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Could not add the media");
    return { id: row.id, title: row.title, playUrl: link.kind === "public" ? link.url : null };
  });

export const deleteMediaAssets = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((d) => z.object({ ids: z.array(z.string().uuid()).min(1).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    assertRoles(context, ["super_admin", "station_manager", "media_manager"]);
    const { data: rows } = await context.db.from("media_assets").select("id, storage_key, upload_id, source_url").in("id", data.ids);
    const r2 = await import("@/lib/r2.server");
    const configured = !!r2.getR2();
    let storageErrors = 0;
    for (const row of rows ?? []) {
      // Linked files (pasted R2 links) belong to the user's bucket; removing the entry never deletes them.
      if (!configured || !row.storage_key || row.source_url) continue;
      try {
        if (row.upload_id) await r2.abortMultipart(row.storage_key, row.upload_id);
        else await r2.deleteObject(row.storage_key);
      } catch {
        storageErrors++;
      }
    }
    const { error } = await context.db.from("media_assets").delete().in("id", data.ids);
    if (error) throw new Error("Could not delete media records");
    return { deleted: rows?.length ?? 0, storageErrors };
  });

// ------------------------------------------------------------------ streaming

export const runStreamHealthCheck = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((d) => z.object({ channelId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    assertRoles(context, ["super_admin", "station_manager", "broadcast_operator"]);
    const { data: channel } = await context.db.from("channels").select("id, hls_url").eq("id", data.channelId).single();
    if (!channel) throw new Error("Channel not found");
    const result = await checkHlsStream(channel.hls_url);
    const { data: status } = await context.db.from("broadcast_status").select("on_air, last_heartbeat_at").eq("channel_id", channel.id).maybeSingle();
    const fresh = !!status?.last_heartbeat_at && Date.now() - new Date(status.last_heartbeat_at).getTime() <= 30_000;
    const finalStatus = result.status === "connected" && fresh && status?.on_air ? "on_air" : result.status;
    await context.db.from("stream_health_checks").insert({
      channel_id: channel.id,
      url: channel.hls_url ?? "",
      status: finalStatus,
      details: JSON.parse(JSON.stringify({ ...result, engineOnAir: !!status?.on_air && fresh })),
      checked_by: context.userId,
    });
    return { ...result, status: finalStatus, engineOnAir: !!status?.on_air && fresh };
  });

// ------------------------------------------------------------------ ingest credentials

export const createLiveInput = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((d) =>
    z.object({
      channelId: z.string().uuid(),
      name: z.string().trim().min(1).max(80),
      protocol: z.enum(["rtmp", "rtmps", "srt", "webrtc"]),
      ingestUrl: z.string().trim().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    assertRoles(context, LIVE_ROLES);
    const { randomToken } = await import("@/lib/engine-auth.server");
    const { error } = await context.db.from("live_inputs").insert({
      channel_id: data.channelId,
      name: data.name,
      protocol: data.protocol,
      ingest_url: data.ingestUrl || null,
      stream_key: randomToken("mmx_live_", 18),
    });
    if (error) throw new Error("Could not create the live input");
    return { ok: true };
  });

export const regenerateStreamKey = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((d) => z.object({ inputId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    assertRoles(context, LIVE_ROLES);
    const { randomToken } = await import("@/lib/engine-auth.server");
    const { error } = await context.db.from("live_inputs").update({ stream_key: randomToken("mmx_live_", 18) }).eq("id", data.inputId);
    if (error) throw new Error("Could not regenerate the stream key");
    return { ok: true };
  });
