import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { db } from "@/lib/db";
import { getFirebase, signOutUser } from "@/lib/firebase";
import { OWNER_EMAIL } from "@/lib/firebase-config";
import { seedStation } from "@/lib/station-seed";
import { ensureStationDestination } from "@/lib/station.functions";
import { StationProvider } from "@/components/admin/station-context";
import { AdminShell } from "@/components/admin/AdminShell";
import { useChannelQuery } from "@/hooks/use-station";
import { Wordmark } from "@/components/brand/Wordmark";
import { Button } from "@/components/ui/button";
import type { AppRole } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Broadcast Control — MOVIE MAX" },
      { name: "description", content: "MOVIE MAX station management, scheduling and broadcast control." },
      { property: "og:title", content: "Broadcast Control — MOVIE MAX" },
      { property: "og:description", content: "MOVIE MAX station management, scheduling and broadcast control." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLayout,
});

function Gate({ title, children, onSignOut }: { title: string; children: React.ReactNode; onSignOut: () => void }) {
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="panel max-w-md p-6 text-center">
        <Wordmark className="text-xl" />
        <h1 className="mt-4 font-display text-lg font-bold uppercase">{title}</h1>
        <div className="mt-2 space-y-3 text-sm text-muted-foreground">{children}</div>
        <Button variant="panel" size="sm" className="mt-5" onClick={onSignOut}>Sign out</Button>
      </div>
    </div>
  );
}

function AdminLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [sent, setSent] = useState(false);
  const ownerEmail = user.email?.toLowerCase() === OWNER_EMAIL;

  const roles = useQuery({
    queryKey: ["my-roles", user.id],
    queryFn: async () => {
      // Keep the person's profile (email + name) current so the Super Admin can find them in Users & roles.
      await db.from("profiles").upsert({ id: user.id, email: user.email, display_name: user.displayName }).then(() => undefined);
      const { data, error } = await db.from("user_roles").select("roles").eq("id", user.id).maybeSingle();
      if (error) throw error;
      const list = [...((data?.roles ?? []) as AppRole[])];
      if (user.isOwner) list.unshift("super_admin");
      return list;
    },
  });
  const channel = useChannelQuery();
  const seed = useQuery({
    queryKey: ["seed-station"],
    enabled: user.isOwner && channel.isSuccess && !channel.data,
    queryFn: async () => {
      await seedStation(db);
      await qc.invalidateQueries({ queryKey: ["channel"] });
      return true;
    },
  });

  // Point the channel at the built-in broadcast server (runs quietly; the stream key stays on the server).
  const canManageStation = !!roles.data?.some((r) => r === "super_admin" || r === "station_manager");
  useQuery({
    queryKey: ["ensure-destination", channel.data?.id],
    enabled: canManageStation && !!channel.data?.id,
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      const r = await ensureStationDestination({ data: { channelId: channel.data!.id } });
      if (r.updated) {
        await qc.invalidateQueries({ queryKey: ["stream-destination"] });
        await qc.invalidateQueries({ queryKey: ["channel"] });
      }
      return r;
    },
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await signOutUser();
    navigate({ to: "/auth", replace: true });
  }

  async function sendVerification() {
    const { auth, authMod } = await getFirebase();
    if (!auth.currentUser) return;
    try {
      await authMod.sendEmailVerification(auth.currentUser);
      setSent(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message.replace(/^Firebase: /, "") : "Could not send the email");
    }
  }

  if (ownerEmail && !user.emailVerified) {
    return (
      <Gate title="Confirm your email" onSignOut={signOut}>
        <p>
          You are signed in as <span className="text-foreground">{user.email}</span>. Super Admin opens only after this email is confirmed, so nobody else can
          claim it.
        </p>
        <p>Signing in with Google confirms it straight away. Or send yourself a link, open it, then come back and sign in again.</p>
        <Button variant="emerald" size="sm" onClick={sendVerification} disabled={sent}>{sent ? "Link sent — check your inbox" : "Send confirmation link"}</Button>
      </Gate>
    );
  }
  if (roles.isLoading || channel.isLoading || seed.isFetching) {
    return <div className="grid min-h-screen place-items-center"><span className="label-caps">Loading control room…</span></div>;
  }
  if (roles.error || channel.error || seed.error) {
    const msg = (roles.error ?? channel.error ?? seed.error) as Error;
    return (
      <Gate title="Could not load the station" onSignOut={signOut}>
        <p>{msg.message.includes("permission") ? "The database refused access. The Firebase security rules may not be published yet (Settings → Firebase), or your role was removed." : msg.message}</p>
      </Gate>
    );
  }
  if (!roles.data?.length) {
    return (
      <Gate title="Access pending" onSignOut={signOut}>
        <p>
          You are signed in as <span className="text-foreground">{user.email}</span>, but no station role has been given to you yet. Ask the Super Admin to add you in
          Settings → Users &amp; roles.
        </p>
      </Gate>
    );
  }
  if (!channel.data) {
    return (
      <Gate title="Station not set up yet" onSignOut={signOut}>
        <p>The Super Admin ({OWNER_EMAIL}) needs to sign in once to set up the MOVIE MAX station.</p>
      </Gate>
    );
  }
  return (
    <StationProvider value={{ user, roles: roles.data, channel: channel.data }}>
      <AdminShell onSignOut={signOut}>
        <Outlet />
      </AdminShell>
    </StationProvider>
  );
}
