import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { CalendarRange, House, Info, LogIn, Mail, Play, Search, Tv } from "lucide-react";
import { SITE_NAME, Wordmark } from "@/components/brand/Wordmark";
import { OnAirBadge } from "@/components/broadcast/status";
import { trueDate } from "@/lib/clock";
import { cn } from "@/lib/utils";

/** Faint neon glow behind the public pages. Purely decorative. */
export function PublicBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className="absolute -top-40 left-1/2 h-80 w-[60rem] -translate-x-1/2 rounded-full bg-neon-purple/10 blur-3xl" />
    </div>
  );
}

/** Page frame shared by every public page: top bar, side rail (desktop), tab bar (phone), footer. */
export function PublicShell({ onAir, engineOnline, webLive = false, description, children, footer = true }: {
  onAir: boolean; engineOnline: boolean; webLive?: boolean; description?: string | null | undefined; children: ReactNode; footer?: boolean;
}) {
  return (
    <div className="theme-public public-bg relative isolate min-h-screen overflow-x-hidden text-foreground">
      <PublicHeader onAir={onAir} engineOnline={engineOnline} webLive={webLive} />
      <PublicRail />
      <div className="pb-24 pt-[4.5rem] lg:pb-0 lg:pl-[4.75rem]">
        {children}
        {footer && <PublicFooter description={description} />}
      </div>
      <PublicTabBar />
    </div>
  );
}

const MAIN_NAV: { to: "/" | "/watch" | "/contact" | "/about"; label: string }[] = [
  { to: "/", label: "Home" },
  { to: "/watch", label: "Watch" },
  { to: "/contact", label: "Contact" },
  { to: "/about", label: "About" },
];

const pill = "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-extrabold uppercase tracking-wide transition";

export function PublicHeader({ onAir, engineOnline, webLive = false }: { onAir: boolean; engineOnline: boolean; webLive?: boolean }) {
  return (
    <header className="fixed inset-x-0 top-2 z-40 flex items-center justify-center gap-3 px-2 lg:pl-[4.75rem]">
      <div className="neon-ring neon-glow flex h-12 min-w-0 items-center gap-1 rounded-full p-1 [--glow:var(--neon-green)]">
        <Link to="/" aria-label={`${SITE_NAME} home`} className="flex shrink-0 items-center px-1.5 sm:px-2">
          <Wordmark neon className="text-[15px]" nameClassName="hidden sm:inline" />
        </Link>
        <nav className="hidden items-center gap-0.5 md:flex" aria-label="Main">
          {MAIN_NAV.map((n) => (
            <Link key={n.to} to={n.to} className={cn(pill, "text-foreground/85 hover:text-foreground")} activeOptions={{ exact: true, includeSearch: false }} activeProps={{ className: "bg-neon-pink text-primary-foreground" }}>{n.label}</Link>
          ))}
        </nav>
        <span className="hidden px-1 lg:inline-flex"><OnAirBadge onAir={onAir} engineOnline={engineOnline} webLive={webLive} /></span>
        <Link to="/guide" aria-label="Search programmes" className={cn(pill, "w-8 justify-center bg-panel-raised px-0 text-foreground min-[1380px]:hidden")}><Search className="size-4" /></Link>
        <Link to="/watch" className={cn(pill, "bg-neon-blue text-primary-foreground hover:brightness-110 md:hidden")}><Play className="size-3.5 fill-current" />Watch</Link>
        <Link to="/auth" aria-label="Staff login" className={cn(pill, "bg-foreground text-background hover:bg-foreground/90 max-sm:w-8 max-sm:justify-center max-sm:px-0")}><LogIn className="size-3.5" /><span className="hidden sm:inline">Login</span></Link>
      </div>
      <SearchPill className="hidden min-[1380px]:flex" />
    </header>
  );
}

export function SearchPill({ className, initial = "", autoFocus }: { className?: string; initial?: string; autoFocus?: boolean }) {
  const navigate = useNavigate();
  const [q, setQ] = useState(initial);
  return (
    <form
      role="search"
      onSubmit={(e) => { e.preventDefault(); navigate({ to: "/guide", search: { q: q.trim() || undefined } }); }}
      className={cn("neon-ring h-11 w-72 items-center gap-2 rounded-full px-4 [--ring-gradient:var(--gradient-search)]", className)}
    >
      <Search className="size-4 shrink-0 text-neon-purple" />
      <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus={autoFocus} aria-label="Search programmes" placeholder="Search movies and series" className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
    </form>
  );
}

const RAIL: { to: "/" | "/watch" | "/guide"; label: string; icon: typeof House }[] = [
  { to: "/", label: "Home", icon: House },
  { to: "/watch", label: "TV", icon: Tv },
  { to: "/guide", label: "Guide", icon: CalendarRange },
];

/** Short side rail, centred top-to-bottom on desktop. */
function PublicRail() {
  return (
    <aside className="neon-ring fixed left-1.5 top-1/2 z-30 hidden w-[3.6rem] -translate-y-1/2 flex-col items-center gap-2 rounded-2xl py-3 shadow-[0_0_22px_-6px_var(--neon-pink)] [--ring-gradient:linear-gradient(180deg,var(--neon-purple),var(--neon-pink))] lg:flex" aria-label="Sections">
      {RAIL.map((r) => (
        <Link
          key={r.label}
          to={r.to}
          title={r.label}
          aria-label={r.label}
          activeOptions={{ exact: true, includeSearch: false }}
          className="relative flex w-12 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-bold uppercase tracking-wide text-foreground/75 transition hover:bg-panel-raised hover:text-foreground"
          activeProps={{ className: "bg-panel-raised !text-foreground before:absolute before:-left-[0.35rem] before:top-1/2 before:h-6 before:w-1 before:-translate-y-1/2 before:rounded-full before:bg-neon-pink" }}
        >
          <r.icon className="size-5" />
          {r.label}
        </Link>
      ))}
    </aside>
  );
}

const TABS: { to: "/" | "/watch" | "/guide" | "/about" | "/contact"; label: string; icon: typeof House }[] = [
  { to: "/", label: "Home", icon: House },
  { to: "/watch", label: "TV", icon: Tv },
  { to: "/guide", label: "Guide", icon: CalendarRange },
  { to: "/about", label: "About", icon: Info },
  { to: "/contact", label: "Contact", icon: Mail },
];

function PublicTabBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border/70 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Sections">
      {TABS.map((t) => (
        <Link
          key={t.label}
          to={t.to}
          activeOptions={{ exact: true, includeSearch: false }}
          className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-muted-foreground"
          activeProps={{ className: "!text-foreground [&_svg]:text-neon-pink" }}
        >
          <t.icon className="size-5" />
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

export function PublicFooter({ description }: { description?: string | null | undefined }) {
  return (
    <footer className="mx-auto mt-16 max-w-[90rem] px-4 pb-8 md:px-8">
      <div className="flex flex-col gap-6 border-t border-border/70 pt-8 text-sm text-muted-foreground md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <Wordmark neon className="text-base" />
          <p className="mt-3 leading-relaxed">{description ?? "Premium movies, series and entertainment, live 24 hours a day."}</p>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-2">
          <Link to="/watch" className="hover:text-foreground">Watch live</Link>
          <Link to="/guide" className="hover:text-foreground">7-day TV guide</Link>
          <Link to="/about" className="hover:text-foreground">About</Link>
          <Link to="/contact" className="hover:text-foreground">Contact</Link>
          <Link to="/auth" className="hover:text-foreground">Staff login</Link>
          <span>Kampala · East Africa Time</span>
        </div>
      </div>
      <div className="pt-6 text-xs text-muted-foreground">© {trueDate().getFullYear()} {SITE_NAME}</div>
    </footer>
  );
}
