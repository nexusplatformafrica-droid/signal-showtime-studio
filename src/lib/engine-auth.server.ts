/**
 * Server-only: playout-engine sign-in. An engine token is a Firebase login made for the engine
 * (`mmx_eng_<base64url email>.<password>`), created by the Super Admin in Settings → Playout engine.
 * The API signs in with it and talks to the database as that engine, so firestore.rules decide what it may do.
 */
import { decodeEngineToken } from "@/lib/engine-token";

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

// Signed-in engine sessions, kept for the life of this server instance so the engine is not signed in on every request.
const sessions = new Map<string, { idToken: string; uid: string; channelId: string; expiresAt: number; touchedAt: number }>();

export async function verifyEngineRequest(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const creds = decodeEngineToken(token);
  if (!creds) return null;
  const { createRest } = await import("@/lib/db/rest");
  const cacheKey = await sha256Hex(token);
  let s = sessions.get(cacheKey);
  if (!s || s.expiresAt < Date.now()) {
    const { passwordSignIn } = await import("@/lib/firebase-auth.server");
    const login = await passwordSignIn(creds.email, creds.password).catch(() => null);
    if (!login) return null;
    const rest = createRest(login.idToken);
    const { data: tokenRow } = await rest.db.from("engine_tokens").select("id, channel_id, revoked_at").eq("id", login.uid).maybeSingle();
    if (!tokenRow || tokenRow.revoked_at) return null;
    s = { idToken: login.idToken, uid: login.uid, channelId: tokenRow.channel_id, expiresAt: Math.min(login.expiresAt, Date.now() + 10 * 60_000), touchedAt: 0 };
    if (sessions.size > 50) sessions.clear();
    sessions.set(cacheKey, s);
  }
  const rest = createRest(s.idToken);
  if (Date.now() - s.touchedAt > 60_000) {
    s.touchedAt = Date.now();
    await rest.db.from("engine_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", s.uid);
  }
  return { tokenId: s.uid, channelId: s.channelId, db: rest.db, rest };
}
