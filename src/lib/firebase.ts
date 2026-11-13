import type { FirebaseApp } from "firebase/app";
import type { Auth, User } from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import { FIREBASE_CONFIG, isOwnerIdentity } from "@/lib/firebase-config";

/**
 * Browser-only Firebase. The SDK is loaded lazily on first use (never during server rendering),
 * so pages render on the server without touching it.
 */
export type FirebaseKit = {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  authMod: typeof import("firebase/auth");
  fsMod: typeof import("firebase/firestore");
};

let kit: Promise<FirebaseKit> | null = null;

export function getFirebase(): Promise<FirebaseKit> {
  if (typeof window === "undefined") return Promise.reject(new Error("Firebase is only available in the browser"));
  kit ??= (async () => {
    const [appMod, authMod, fsMod] = await Promise.all([import("firebase/app"), import("firebase/auth"), import("firebase/firestore")]);
    const existing = appMod.getApps().find((a) => a.name === "[DEFAULT]");
    const app = existing ?? appMod.initializeApp(FIREBASE_CONFIG);
    const auth = authMod.getAuth(app);
    let db: Firestore;
    try {
      db = fsMod.initializeFirestore(app, { ignoreUndefinedProperties: true });
    } catch {
      db = fsMod.getFirestore(app);
    }
    return { app, auth, db, authMod, fsMod };
  })();
  return kit;
}

/** The signed-in person, in the shape the app uses everywhere. */
export type AppUser = { id: string; email: string | null; emailVerified: boolean; displayName: string | null; isOwner: boolean };

export function toAppUser(u: User): AppUser {
  return { id: u.uid, email: u.email, emailVerified: u.emailVerified, displayName: u.displayName, isOwner: isOwnerIdentity(u.email, u.emailVerified) };
}

export async function currentUser(): Promise<AppUser | null> {
  const { auth } = await getFirebase();
  await auth.authStateReady();
  return auth.currentUser ? toAppUser(auth.currentUser) : null;
}

export async function getIdToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const { auth } = await getFirebase();
  await auth.authStateReady();
  return auth.currentUser ? auth.currentUser.getIdToken() : null;
}

export async function signOutUser() {
  const { auth, authMod } = await getFirebase();
  await authMod.signOut(auth);
}

/** Calls back with the signed-in person (or null) now and whenever it changes. */
export function watchAuth(cb: (u: AppUser | null) => void): () => void {
  let unsub: (() => void) | null = null;
  let cancelled = false;
  getFirebase().then(({ auth, authMod }) => {
    if (cancelled) return;
    unsub = authMod.onIdTokenChanged(auth, (u) => cb(u ? toAppUser(u) : null));
  });
  return () => {
    cancelled = true;
    unsub?.();
  };
}

/** Plain-language messages for Firebase sign-in errors. */
export function authErrorMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  const map: Record<string, string> = {
    "auth/invalid-credential": "Wrong email or password.",
    "auth/wrong-password": "Wrong email or password.",
    "auth/user-not-found": "No account with that email. Create one first.",
    "auth/email-already-in-use": "An account with that email already exists. Sign in instead.",
    "auth/weak-password": "Use a password with at least 8 characters.",
    "auth/invalid-email": "That email address does not look right.",
    "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
    "auth/popup-closed-by-user": "The Google window was closed before signing in.",
    "auth/unauthorized-domain": "Google sign-in is not allowed on this web address yet. Add it in Firebase → Authentication → Settings → Authorised domains, or use email and password.",
    "auth/operation-not-allowed": "This sign-in method is switched off in Firebase → Authentication → Sign-in method.",
    "auth/network-request-failed": "No connection. Check your internet and try again.",
  };
  return map[code] ?? (e instanceof Error ? e.message.replace(/^Firebase: /, "") : "Sign in failed");
}
