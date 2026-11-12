import { Link } from "@tanstack/react-router";
import { Wordmark } from "@/components/brand/Wordmark";
import { OnAirBadge } from "@/components/broadcast/status";

export function PublicHeader({ onAir, engineOnline, webLive = false }: { onAir: boolean; engineOnline: boolean; webLive?: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 md:px-6">
        <Link to="/" aria-label="MOVIE MAX home"><Wordmark className="text-xl" /></Link>
        <nav className="flex items-center gap-5 text-sm text-muted-foreground">
          <Link to="/watch" className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>Watch live</Link>
          <Link to="/guide" className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>TV guide</Link>
        </nav>
        <div className="ml-auto"><OnAirBadge onAir={onAir} engineOnline={engineOnline} webLive={webLive} /></div>
      </div>
    </header>
  );
}

export function PublicFooter({ description }: { description?: string | null | undefined }) {
  return (
    <footer className="mt-16 border-t border-border/70">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 text-sm text-muted-foreground md:grid-cols-[1.4fr_1fr_1fr] md:px-6">
        <div>
          <Wordmark className="text-lg" />
          <p className="mt-3 max-w-sm">{description ?? "Premium movies, series and entertainment, live 24 hours a day."}</p>
        </div>
        <div className="space-y-2">
          <div className="label-caps">Channel</div>
          <Link to="/watch" className="block hover:text-foreground">Watch live</Link>
          <Link to="/guide" className="block hover:text-foreground">7-day TV guide</Link>
        </div>
        <div className="space-y-2">
          <div className="label-caps">Station</div>
          <p>Broadcasting from Kampala · East Africa Time</p>
          <Link to="/auth" className="block hover:text-foreground">Staff sign in</Link>
        </div>
      </div>
      <div className="border-t border-border/70 py-4 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} MOVIE MAX</div>
    </footer>
  );
}
