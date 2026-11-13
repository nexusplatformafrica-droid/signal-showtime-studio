/**
 * MOVIE MAX Firebase project. These values are public by design (Firebase web config) and are
 * kept in code so every copy of this project connects to the same station data.
 * Security comes from firestore.rules, not from hiding this config.
 */
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDkk3rUUTq7wqKLUrLSHKtk120fJ3_jS00",
  authDomain: "moviemax-tv.firebaseapp.com",
  projectId: "moviemax-tv",
  storageBucket: "moviemax-tv.firebasestorage.app",
  messagingSenderId: "729012744104",
  appId: "1:729012744104:web:262d80dff8ff7086d5779d",
  measurementId: "G-WZE5Z9QTEZ",
} as const;

/** The only Super Admin. Only this person (with a verified email) can give or remove staff roles. */
export const OWNER_EMAIL = "mainplatform.nexus@gmail.com";

export function isOwnerIdentity(email: string | null | undefined, emailVerified: boolean | null | undefined) {
  return !!email && email.toLowerCase() === OWNER_EMAIL && emailVerified === true;
}
