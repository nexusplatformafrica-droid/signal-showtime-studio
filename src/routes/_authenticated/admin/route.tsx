import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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

function AdminLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const roles = useQuery({
    queryKey: ["my-roles", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as AppRole);
    },
  });
  const channel = useChannelQuery();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (roles.isLoading || channel.isLoading) {
    return <div className="grid min-h-screen place-items-center"><span className="label-caps">Loading control room…</span></div>;
  }
  if (roles.error || channel.error || !channel.data) {
    return <div className="grid min-h-screen place-items-center text-sm text-destructive">Could not load station data. Refresh to try again.</div>;
  }
  if (!roles.data?.length) {
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <div className="panel max-w-md p-6 text-center">
          <Wordmark className="text-xl" />
          <h1 className="mt-4 font-display text-lg font-bold uppercase">Access pending</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You are signed in as <span className="text-foreground">{user.email}</span>, but no station role has been assigned yet.
            Ask a Super Admin to grant you a role in Settings → Users &amp; roles.
          </p>
          <Button variant="panel" size="sm" className="mt-5" onClick={signOut}>Sign out</Button>
        </div>
      </div>
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
