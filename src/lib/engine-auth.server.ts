/** Server-only: verify playout-engine bearer tokens (stored as SHA-256 hashes). */
export async function sha256Hex(input: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomToken(prefix: string, bytes = 24) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  const b64 = btoa(String.fromCharCode(...arr)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${prefix}${b64}`;
}

export async function verifyEngineRequest(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token.startsWith("mmx_eng_") || token.length < 30) return null;
  const hash = await sha256Hex(token);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("engine_tokens")
    .select("id, channel_id, revoked_at")
    .eq("token_hash", hash)
    .maybeSingle();
  if (!data || data.revoked_at) return null;
  await supabaseAdmin.from("engine_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return { tokenId: data.id, channelId: data.channel_id, db: supabaseAdmin };
}
