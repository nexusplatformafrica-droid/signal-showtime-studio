import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { authErrorMessage, getFirebase } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/brand/Wordmark";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — MOVIE MAX TV" },
      { name: "description", content: "Choose a new password for your MOVIE MAX TV staff account." },
      { property: "og:title", content: "Set a new password — MOVIE MAX TV" },
      { property: "og:description", content: "Choose a new password for your MOVIE MAX TV staff account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [code, setCode] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const ready = !!code;
  useEffect(() => {
    // Firebase reset links carry ?mode=resetPassword&oobCode=…
    setCode(new URLSearchParams(window.location.search).get("oobCode"));
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code) return;
    setBusy(true);
    try {
      const { auth, authMod } = await getFirebase();
      await authMod.confirmPasswordReset(auth, code, password);
      toast.success("Password updated — sign in with your new password");
      navigate({ to: "/auth" });
    } catch (err) {
      toast.error(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="theme-public public-bg relative isolate grid min-h-screen place-items-center px-4 text-foreground">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden><div className="orb orb-sun -right-40 -top-48 size-[34rem]" /></div>
      <div className="w-full max-w-sm">
        <Wordmark className="mb-6 text-2xl" />
        <form onSubmit={submit} className="glass space-y-3 rounded-[2rem] p-7">
          <h1 className="font-headline text-2xl font-semibold tracking-tight">Set a new password</h1>
          {!ready && <p className="text-xs text-muted-foreground">Open this page from the link in your password reset email.</p>}
          <label className="block space-y-1"><span className="label-caps">New password</span><input className="field h-10 rounded-xl bg-panel-raised" type="password" minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={!ready} /></label>
          <Button type="submit" variant="emerald" size="pill" className="w-full" disabled={!ready || busy}>Update password</Button>
        </form>
      </div>
    </div>
  );
}
