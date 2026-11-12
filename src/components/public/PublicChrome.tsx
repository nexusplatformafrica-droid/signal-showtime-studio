import { Link } from "@tanstack/react-router";
import { Play } from "lucide-react";
import { Wordmark } from "@/components/brand/Wordmark";
import { OnAirBadge } from "@/components/broadcast/status";
import { Button } from "@/components/ui/button";

/** Soft pebbles and sun glow behind the public pages. Purely decorative. */
export function PublicBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className="orb orb-sun -right-40 -top-48 size-[34rem] opacity-90" />
      <div className="orb orb-stone left-[3%] top-40 hidden size-36 md:block" />
      <div className="orb orb-stone -right-16 top-[42rem] hidden size-56 lg:block" />
      <div className="orb orb-peach bottom-[18%] left-[6%] hidden size-10 md:block" />
      <div className="orb orb-peach right-[12%] top-[30rem] size-6" />
    </div>
  );
}

export function PublicHeader({ onAir, engineOnline, webLive = false }: { onAir: boolean; engineOnline: boolean; webLive?: boolean }) {
  return (
    <header className="sticky top-3 z-30 px-3 md:px-6">
      <div className="glass mx-auto flex h-14 max-w-7xl items-center gap-4 rounded-full pl-5 pr-2 md:gap-6">
        <Link to="/" aria-label="MOVIE MAX home"><Wordmark className="text-lg" /></Link>
        <nav className="hidden items-center gap-1 text-sm font-medium text-muted-foreground sm:flex">
          <Link to="/" className="rounded-full px-3 py-1.5 hover:text-foreground" activeOptions={{ exact: true }} activeProps={{ className: "bg-panel-raised text-foreground shadow-sm" }}>Home</Link>
          <Link to="/watch" className="rounded-full px-3 py-1.5 hover:text-foreground" activeProps={{ className: "bg-panel-raised text-foreground shadow-sm" }}>Watch live</Link>
          <Link to="/guide" className="rounded-full px-3 py-1.5 hover:text-foreground" activeProps={{ className: "bg-panel-raised text-foreground shadow-sm" }}>TV guide</Link>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <OnAirBadge onAir={onAir} engineOnline={engineOnline} webLive={webLive} />
          <Button asChild variant="emerald" size="pill-sm" className="hidden sm:inline-flex"><Link to="/watch"><Play />Watch</Link></Button>
          <Link to="/guide" className="rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground sm:hidden">Guide</Link>
        </div>
      </div>
    </header>
  );
}

export function PublicFooter({ description }: { description?: string | null | undefined }) {
  return (
    <footer className="mx-auto mt-20 max-w-7xl px-4 pb-8 md:px-6">
      <div className="glass grid gap-8 rounded-[2rem] p-8 text-sm text-muted-foreground md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Wordmark className="text-lg" />
          <p className="mt-3 max-w-sm leading-relaxed">{description ?? "Premium movies, series and entertainment, live 24 hours a day."}</p>
        </div>
        <div className="space-y-2">
          <div className="font-headline text-xs font-semibold uppercase tracking-[0.18em] text-foreground">Channel</div>
          <Link to="/watch" className="block hover:text-foreground">Watch live</Link>
          <Link to="/guide" className="block hover:text-foreground">7-day TV guide</Link>
        </div>
        <div className="space-y-2">
          <div className="font-headline text-xs font-semibold uppercase tracking-[0.18em] text-foreground">Station</div>
          <p>Broadcasting from Kampala · East Africa Time</p>
          <Link to="/auth" className="block hover:text-foreground">Staff sign in</Link>
        </div>
      </div>
      <div className="pt-5 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} MOVIE MAX</div>
    </footer>
  );
}
