/** Engine tokens carry the engine's own Firebase login: `mmx_eng_<base64url(email)>.<password>`. */
const b64url = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64url = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));

export function encodeEngineToken(email: string, password: string) {
  return `mmx_eng_${b64url(email)}.${password}`;
}

export function decodeEngineToken(token: string): { email: string; password: string } | null {
  const m = token.match(/^mmx_eng_([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]{16,})$/);
  if (!m) return null;
  try {
    const email = unb64url(m[1]!);
    return /^[^@\s]+@[^@\s]+$/.test(email) ? { email, password: m[2]! } : null;
  } catch {
    return null;
  }
}
