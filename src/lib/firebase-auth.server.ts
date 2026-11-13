import { createRemoteJWKSet, jwtVerify } from "jose";
import { FIREBASE_CONFIG, isOwnerIdentity } from "@/lib/firebase-config";

/** Server-only: checks a Firebase ID token (signature, project, expiry) and returns who it belongs to. */
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

export type VerifiedUser = { uid: string; email: string | null; emailVerified: boolean; isOwner: boolean };

export async function verifyIdToken(token: string): Promise<VerifiedUser> {
  jwks ??= createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));
  const { payload } = await jwtVerify(token, jwks, {
    issuer: `https://securetoken.google.com/${FIREBASE_CONFIG.projectId}`,
    audience: FIREBASE_CONFIG.projectId,
  });
  if (!payload.sub) throw new Error("Unauthorized");
  const email = typeof payload.email === "string" ? payload.email : null;
  const emailVerified = payload.email_verified === true;
  return { uid: payload.sub, email, emailVerified, isOwner: isOwnerIdentity(email, emailVerified) };
}

/** Signs in with email + password through Firebase's public sign-in API (used for playout-engine logins). */
export async function passwordSignIn(email: string, password: string): Promise<{ idToken: string; uid: string; expiresAt: number }> {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_CONFIG.apiKey}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const json = (await res.json().catch(() => ({}))) as { idToken?: string; localId?: string; expiresIn?: string };
  if (!res.ok || !json.idToken || !json.localId) throw new Error("Engine sign-in failed");
  return { idToken: json.idToken, uid: json.localId, expiresAt: Date.now() + (Number(json.expiresIn ?? 3600) - 120) * 1000 };
}
