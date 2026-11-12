import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/brand/Wordmark";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — MOVIE MAX" },
      { name: "description", content: "Choose a new password for your MOVIE MAX staff account." },
      { property: "og:title", content: "Set a new password — MOVIE MAX" },
      { property: "og:description", content: "Choose a new password for your MOVIE MAX staff account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (window.location.hash.includes("type=recovery")) setReady(true);
    const { data } = supabase.auth.onAuthStateChange((e) => {
      if (e === "PASSWORD_RECOVERY") setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated");
    navigate({ to: "/admin" });
  }
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-sm">
        <Wordmark className="mb-6 text-2xl" />
        <form onSubmit={submit} className="panel space-y-3 p-5">
          <h1 className="font-display text-lg font-bold uppercase tracking-wide">Set a new password</h1>
          {!ready && <p className="text-xs text-muted-foreground">Open this page from the link in your password reset email.</p>}
          <label className="block space-y-1"><span className="label-caps">New password</span><input className="field" type="password" minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={!ready} /></label>
          <Button type="submit" variant="brand" className="w-full" disabled={!ready || busy}>Update password</Button>
        </form>
      </div>
    </div>
  );
}
