import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type { AppRole } from "@/lib/permissions";

/** Browser side: attach the signed-in person's Firebase ID token to every server function call. */
export const attachFirebaseAuth = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const { getIdToken } = await import("@/lib/firebase");
  const token = await getIdToken().catch(() => null);
  return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
});

/** Server side: verify the ID token and give the handler a database connection acting as that person. */
export const requireFirebaseAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const header = getRequest()?.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) throw new Error("Unauthorized: please sign in again.");
  const token = header.slice(7).trim();
  const { verifyIdToken } = await import("@/lib/firebase-auth.server");
  const who = await verifyIdToken(token).catch(() => {
    throw new Error("Unauthorized: please sign in again.");
  });
  const { createRest } = await import("@/lib/db/rest");
  const rest = createRest(token);
  const { data: roleRow } = await rest.db.from("user_roles").select("roles").eq("id", who.uid).maybeSingle();
  const roles: AppRole[] = [...((roleRow?.roles ?? []) as AppRole[])];
  if (who.isOwner && !roles.includes("super_admin")) roles.unshift("super_admin");
  return next({
    context: { userId: who.uid, email: who.email, isOwner: who.isOwner, roles, db: rest.db, rest },
  });
});
