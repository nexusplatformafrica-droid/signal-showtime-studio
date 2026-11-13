import type { Db } from "@/lib/db/core";
import { FIREBASE_CONFIG } from "@/lib/firebase-config";
import { encodeEngineToken } from "@/lib/engine-token";

const rand = (n: number) => {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return [...a].map((b) => "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[b % 62]).join("");
};

/**
 * Super Admin only (browser): makes a Firebase login for a playout engine without signing the
 * Super Admin out (a separate, throwaway Firebase instance creates it), gives it the playout_engine
 * role and returns the token to paste into the engine. The token is shown once.
 */
export async function createEngineLogin(db: Db, opts: { channelId: string; label: string; createdBy: string }) {
  const [appMod, authMod] = await Promise.all([import("firebase/app"), import("firebase/auth")]);
  const app2 = appMod.initializeApp(FIREBASE_CONFIG, `engine-maker-${Date.now()}`);
  const email = `engine-${rand(10).toLowerCase()}@moviemax-tv.firebaseapp.com`;
  const password = rand(32);
  let uid: string;
  try {
    const auth2 = authMod.initializeAuth(app2, { persistence: authMod.inMemoryPersistence });
    const cred = await authMod.createUserWithEmailAndPassword(auth2, email, password);
    uid = cred.user.uid;
    await authMod.signOut(auth2);
  } finally {
    await appMod.deleteApp(app2).catch(() => undefined);
  }
  const token = encodeEngineToken(email, password);
  const r1 = await db.from("user_roles").insert({ user_id: uid, email, roles: ["playout_engine"] });
  if (r1.error) throw new Error(r1.error.message);
  const r2 = await db.from("engine_tokens").insert({
    id: uid,
    channel_id: opts.channelId,
    label: opts.label,
    email,
    token_hash: "firebase-login",
    token_prefix: token.slice(0, 14),
    created_by: opts.createdBy,
  });
  if (r2.error) throw new Error(r2.error.message);
  return { token };
}

/** Cuts an engine off at once: its role is removed, so the database refuses it. */
export async function revokeEngineLogin(db: Db, id: string) {
  await db.from("user_roles").delete().eq("id", id);
  await db.from("engine_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", id);
}
