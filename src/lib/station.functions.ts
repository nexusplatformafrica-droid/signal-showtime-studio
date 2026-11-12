import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { checkHlsStream } from "@/lib/hls-check";

type AppRole = Database["public"]["Enums"]["app_role"];
type Ctx = { supabase: import("@supabase/supabase-js").SupabaseClient<Database>; userId: string };

async function assertRoles(ctx: Ctx, roles: AppRole[]) {
  const { data, error } = await ctx.supabase.rpc("has_any_role", { _user_id: ctx.userId, _roles: roles });
  if (error || !data) throw new Error("You do not have permission for this action.");
}

const MEDIA_ROLES: AppRole[] = ["super_admin", "station_manager", "media_manager", "advertising_manager"];
const LIVE_ROLES: AppRole[] = ["super_admin", "station_manager", "broadcast_operator"];

const sanitize = (name: string) => name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 120) || "file";

// ------------------------------------------------------------------ storage

export const getStorageStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { getR2 } = await import("@/lib/r2.server");
    const r2 = getR2();
    return { configured: !!r2, bucket: r2?.bucket ?? null };
  });

export const testStorage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertRoles(context, ["super_admin", "station_manager"]);
    const { getR2, testBucket } = await import("@/lib/r2.server");
    if (!getR2()) return { ok: false, message: "R2 credentials are not set." };
    try {
      const r = await testBucket();
      return { ok: r.ok, message: r.ok ? "Bucket reachable with the configured credentials." : `Bucket responded with HTTP ${r.status}. Check the bucket name and key permissions.` };
    } catch {
      return { ok: false, message: "Could not reach Cloudflare R2." };
    }
  });

export const startMediaUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ mediaId: z.string().uuid(), filename: z.string().min(1).max(255), contentType: z.string().max(120), replace: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertRoles(context, MEDIA_ROLES);
    const { data: row, error } = await context.supabase.from("media_assets").select("id, channel_id, upload_id, storage_key").eq("id", data.mediaId).single();
    if (error || !row) throw new Error("Media record not found");
    const r2 = await import("@/lib/r2.server");
    if (row.upload_id && row.storage_key && !data.replace) {
      const parts = await r2.listParts(row.storage_key, row.upload_id);
      if (parts) return { uploadId: row.upload_id, key: row.storage_key, parts };
    }
    const key = `channels/${row.channel_id}/media/${row.id}/${Date.now()}-${sanitize(data.filename)}`;
    const uploadId = await r2.createMultipart(key, data.contentType || "application/octet-stream");
    const { getR2 } = r2;
    await context.supabase
      .from("media_assets")
      .update({ upload_id: uploadId, storage_key: key, storage_bucket: getR2()?.bucket ?? null, status: "uploading" })
      .eq("id", row.id);
    return { uploadId, key, parts: [] as { partNumber: number; etag: string; size: number }[] };
  });

export const signMediaParts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ mediaId: z.string().uuid(), partNumbers: z.array(z.number().int().min(1).max(10000)).min(1).max(50) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertRoles(context, MEDIA_ROLES);
    const { data: row } = await context.supabase.from("media_assets").select("upload_id, storage_key").eq("id", data.mediaId).single();
    if (!row?.upload_id || !row.storage_key) throw new Error("Upload has not been started");
    const { signParts } = await import("@/lib/r2.server");
    return signParts(row.storage_key, row.upload_id, data.partNumbers);
  });

export const completeMediaUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ mediaId: z.string().uuid(), parts: z.array(z.object({ partNumber: z.number().int().min(1), etag: z.string().min(1).max(200) })).min(1).max(10000) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertRoles(context, MEDIA_ROLES);
    const { data: row } = await context.supabase.from("media_assets").select("upload_id, storage_key").eq("id", data.mediaId).single();
    if (!row?.upload_id || !row.storage_key) throw new Error("Upload has not been started");
    const r2 = await import("@/lib/r2.server");
    await r2.completeMultipart(row.storage_key, row.upload_id, data.parts);
    const head = await r2.headObject(row.storage_key);
    await context.supabase
      .from("media_assets")
      .update({ upload_id: null, status: head.ok ? "ready" : "failed", ...(head.size ? { file_size: head.size } : {}) })
      .eq("id", data.mediaId);
    return { ok: head.ok, size: head.size };
  });

export const abortMediaUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ mediaId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertRoles(context, MEDIA_ROLES);
    const { data: row } = await context.supabase.from("media_assets").select("upload_id, storage_key").eq("id", data.mediaId).single();
    if (row?.upload_id && row.storage_key) {
      const { abortMultipart } = await import("@/lib/r2.server");
      await abortMultipart(row.storage_key, row.upload_id).catch(() => undefined);
    }
    await context.supabase.from("media_assets").update({ upload_id: null, status: "failed" }).eq("id", data.mediaId);
    return { ok: true };
  });

export const getMediaPlaybackUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ mediaId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase.from("media_assets").select("storage_key, status").eq("id", data.mediaId).single();
    if (!row?.storage_key || row.status !== "ready") return { url: null as string | null };
    const { getR2, presignGet } = await import("@/lib/r2.server");
    if (!getR2()) return { url: null as string | null };
    return { url: await presignGet(row.storage_key, 3600) };
  });

export const deleteMediaAssets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ids: z.array(z.string().uuid()).min(1).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertRoles(context, ["super_admin", "station_manager", "media_manager"]);
    const { data: rows } = await context.supabase.from("media_assets").select("id, storage_key, upload_id").in("id", data.ids);
    const r2 = await import("@/lib/r2.server");
    const configured = !!r2.getR2();
    let storageErrors = 0;
    for (const row of rows ?? []) {
      if (!configured || !row.storage_key) continue;
      try {
        if (row.upload_id) await r2.abortMultipart(row.storage_key, row.upload_id);
        else await r2.deleteObject(row.storage_key);
      } catch {
        storageErrors++;
      }
    }
    const { error } = await context.supabase.from("media_assets").delete().in("id", data.ids);
    if (error) throw new Error("Could not delete media records");
    return { deleted: rows?.length ?? 0, storageErrors };
  });

// ------------------------------------------------------------------ streaming

export const runStreamHealthCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ channelId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertRoles(context, ["super_admin", "station_manager", "broadcast_operator"]);
    const { data: channel } = await context.supabase.from("channels").select("id, hls_url").eq("id", data.channelId).single();
    if (!channel) throw new Error("Channel not found");
    const result = await checkHlsStream(channel.hls_url);
    const { data: status } = await context.supabase.from("broadcast_status").select("on_air, last_heartbeat_at").eq("channel_id", channel.id).maybeSingle();
    const fresh = !!status?.last_heartbeat_at && Date.now() - new Date(status.last_heartbeat_at).getTime() <= 30_000;
    const finalStatus = result.status === "connected" && fresh && status?.on_air ? "on_air" : result.status;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("stream_health_checks").insert({
      channel_id: channel.id,
      url: channel.hls_url ?? "",
      status: finalStatus,
      details: JSON.parse(JSON.stringify({ ...result, engineOnAir: !!status?.on_air && fresh })),
      checked_by: context.userId,
    });
    return { ...result, status: finalStatus, engineOnAir: !!status?.on_air && fresh };
  });

// ------------------------------------------------------------------ engine + ingest credentials

export const createEngineToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ channelId: z.string().uuid(), label: z.string().trim().min(1).max(60) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertRoles(context, ["super_admin"]);
    const { randomToken, sha256Hex } = await import("@/lib/engine-auth.server");
    const token = randomToken("mmx_eng_", 32);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("engine_tokens").insert({
      channel_id: data.channelId,
      label: data.label,
      token_hash: await sha256Hex(token),
      token_prefix: token.slice(0, 14),
      created_by: context.userId,
    });
    if (error) throw new Error("Could not create the engine token");
    return { token };
  });

export const createLiveInput = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      channelId: z.string().uuid(),
      name: z.string().trim().min(1).max(80),
      protocol: z.enum(["rtmp", "rtmps", "srt", "webrtc"]),
      ingestUrl: z.string().trim().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertRoles(context, LIVE_ROLES);
    const { randomToken } = await import("@/lib/engine-auth.server");
    const { error } = await context.supabase.from("live_inputs").insert({
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
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ inputId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertRoles(context, LIVE_ROLES);
    const { randomToken } = await import("@/lib/engine-auth.server");
    const { error } = await context.supabase.from("live_inputs").update({ stream_key: randomToken("mmx_live_", 18) }).eq("id", data.inputId);
    if (error) throw new Error("Could not regenerate the stream key");
    return { ok: true };
  });
