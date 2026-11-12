import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import "@lovable.dev/cloud-auth-js/styles.css";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/brand/Wordmark";

const search = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => search.parse(s),
  head: () => ({
    meta: [
      { title: "Staff sign in — MOVIE MAX" },
      { name: "description", content: "Sign in to the MOVIE MAX broadcast control system." },
      { property: "og:title", content: "Staff sign in — MOVIE MAX" },
      { property: "og:description", content: "Sign in to the MOVIE MAX broadcast control system." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

const safePath = (p?: string) => {
  if (!p) return "/admin";
  try {
    const u = new URL(p, "http://x");
    return u.pathname.startsWith("/") && !u.pathname.startsWith("//") ? u.pathname + u.search : "/admin";
  } catch {
    return "/admin";
  }
};

function GoogleG() {
  return (
    <svg aria-hidden="true" width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
  );
}

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const dest = safePath(redirect);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: dest, replace: true });
    });
    const { data } = supabase.auth.onAuthStateChange((e, session) => {
      if (e === "SIGNED_IN" && session) navigate({ to: dest, replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [dest, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin + dest, data: { display_name: name } },
        });
        if (error) throw error;
        if (!data.session) setNotice("Check your email to confirm your account, then sign in.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setNotice("If an account exists for that email, a reset link is on its way.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  async function oauth(provider: "google" | "lovable") {
    sessionStorage.setItem("mm-post-auth", dest);
    const res = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin + "/auth" });
    if (res.error) toast.error(res.error.message ?? "Sign in failed");
  }

  useEffect(() => {
    const stored = sessionStorage.getItem("mm-post-auth");
    if (!stored) return;
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        sessionStorage.removeItem("mm-post-auth");
        navigate({ to: safePath(stored), replace: true });
      }
    });
  }, [navigate]);

  return (
    <div className="theme-public public-bg relative isolate grid min-h-screen place-items-center px-4 text-foreground">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="orb orb-sun -right-40 -top-48 size-[34rem]" />
        <div className="orb orb-stone left-[8%] top-[18%] hidden size-32 md:block" />
        <div className="orb orb-peach bottom-[16%] right-[14%] size-10" />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-between">
          <Wordmark className="text-2xl" />
          <span className="rounded-full bg-panel-raised px-3 py-1 text-xs font-semibold text-muted-foreground shadow-sm">Broadcast Control</span>
        </div>
        <div className="glass rounded-[2rem] p-7">
          <h1 className="font-headline text-2xl font-semibold tracking-tight">
            {mode === "signin" ? "Staff sign in" : mode === "signup" ? "Create staff account" : "Reset password"}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {mode === "signup" ? "New accounts need a role from a Super Admin before they can operate the station." : "Access is restricted to authorised station personnel."}
          </p>
          {notice && <div className="mt-3 rounded-2xl border border-emerald/30 bg-emerald/10 px-3 py-2 text-xs text-emerald">{notice}</div>}
          <form onSubmit={submit} className="mt-4 space-y-3">
            {mode === "signup" && (
              <label className="block space-y-1"><span className="label-caps">Display name</span><input className="field h-10 rounded-xl bg-panel-raised" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} /></label>
            )}
            <label className="block space-y-1"><span className="label-caps">Email</span><input className="field h-10 rounded-xl bg-panel-raised" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
            {mode !== "forgot" && (
              <label className="block space-y-1"><span className="label-caps">Password</span><input className="field h-10 rounded-xl bg-panel-raised" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
            )}
            <Button type="submit" variant="emerald" size="pill" className="w-full" disabled={busy}>
              {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
            </Button>
          </form>
          {mode !== "forgot" && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
              <button type="button" onClick={() => oauth("google")} className="google-btn">
                <GoogleG /> Continue with Google
              </button>
              <button type="button" className="lovable-auth-button w-full" onClick={() => oauth("lovable")}>Continue with Lovable</button>
            </div>
          )}
          <div className="mt-4 flex justify-between text-xs text-muted-foreground">
            {mode === "signin" ? (
              <>
                <button className="hover:text-foreground" onClick={() => setMode("signup")}>Create account</button>
                <button className="hover:text-foreground" onClick={() => setMode("forgot")}>Forgot password?</button>
              </>
            ) : (
              <button className="hover:text-foreground" onClick={() => setMode("signin")}>Back to sign in</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
