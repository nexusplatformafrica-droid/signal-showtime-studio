import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity, Bell, CalendarRange, ChevronsLeft, ChevronsRight, Clapperboard, Film, LayoutDashboard, ListVideo,
  LogOut, Radio, Search, Settings, Share2, Layers, ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStation } from "@/components/admin/station-context";
import { useBroadcastStatus, useNow, useRealtimeInvalidate } from "@/hooks/use-station";
import { formatClock, formatDate, isEngineOnline, isOnAir, VIEWER_ACTIVE_MS } from "@/lib/broadcast";
import { ROLE_LABELS } from "@/lib/permissions";
import { OnAirBadge, Tally } from "@/components/broadcast/status";
import { useWebPlayout } from "@/hooks/use-web-playout";
import { Wordmark } from "@/components/brand/Wordmark";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

type NavTo = "/admin" | "/admin/control" | "/admin/live" | "/admin/schedule" | "/admin/playlists" | "/admin/media" | "/admin/graphics" | "/admin/endpoints" | "/admin/settings";
interface NavItem { to: NavTo; label: string; icon: typeof LayoutDashboard; exact?: boolean }

const NAV: { group: string; items: NavItem[] }[] = [
  { group: "Operations", items: [
    { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
    { to: "/admin/control", label: "Control Room", icon: Clapperboard },
    { to: "/admin/live", label: "Live Inputs", icon: Radio },
  ] },
  { group: "Programming", items: [
    { to: "/admin/schedule", label: "Schedule", icon: CalendarRange },
    { to: "/admin/playlists", label: "Playlists", icon: ListVideo },
    { to: "/admin/media", label: "Media Library", icon: Film },
  ] },
  { group: "Presentation", items: [{ to: "/admin/graphics", label: "Graphics", icon: Layers }] },
  { group: "Distribution", items: [{ to: "/admin/endpoints", label: "Streaming Endpoints", icon: Share2 }] },
  { group: "System", items: [{ to: "/admin/settings", label: "Settings", icon: Settings }] },
];

export function AdminShell({ children, onSignOut }: { children: React.ReactNode; onSignOut: () => void }) {
  const { channel, user, roles } = useStation();
  const [collapsed, setCollapsed] = useState(false);
  const [palette, setPalette] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const now = useNow(1000);
  const { data: status } = useBroadcastStatus(channel.id);
  const onAir = now != null && isOnAir(status, now);
  const online = now != null && isEngineOnline(status, now);
  const { pick } = useWebPlayout(now);
  const webLive = !onAir && !!pick;

  useEffect(() => {
    setCollapsed(localStorage.getItem("mm-sidebar") === "1");
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const viewers = useQuery({
    queryKey: ["viewers-live", channel.id],
    refetchInterval: 15000,
    queryFn: async () => {
      const { count } = await supabase.from("viewer_sessions").select("id", { count: "exact", head: true }).eq("channel_id", channel.id).gte("last_seen_at", new Date(Date.now() - VIEWER_ACTIVE_MS).toISOString());
      return count ?? 0;
    },
  });

  const toggle = () => {
    setCollapsed((c) => {
      localStorage.setItem("mm-sidebar", c ? "0" : "1");
      return !c;
    });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <aside className={cn("flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width]", collapsed ? "w-12" : "w-52")}>
        <div className="flex h-11 items-center justify-between border-b border-sidebar-border px-3">
          <Link to="/admin" aria-label="MOVIE MAX overview"><Wordmark compact={collapsed} className="text-[15px]" /></Link>
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {NAV.map((g) => (
            <div key={g.group} className="mb-2">
              {!collapsed && <div className="px-3 pb-1 pt-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">{g.group}</div>}
              {g.items.map((item) => {
                const active = item.exact ? pathname === item.to || pathname === item.to + "/" : pathname.startsWith(item.to);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "relative mx-1.5 flex h-8 items-center gap-2.5 rounded-sm px-2 text-[13px] text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      active && "bg-sidebar-accent text-sidebar-accent-foreground",
                    )}
                  >
                    {active && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-program" />}
                    <Icon className="size-4 shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-1.5">
          <a href="/" target="_blank" rel="noreferrer" className="flex h-8 items-center gap-2.5 rounded-sm px-2 text-[13px] text-sidebar-foreground hover:bg-sidebar-accent" title="Public website">
            <ExternalLink className="size-4 shrink-0" />{!collapsed && "Public website"}
          </a>
          <button onClick={toggle} className="flex h-8 w-full items-center gap-2.5 rounded-sm px-2 text-[13px] text-sidebar-foreground hover:bg-sidebar-accent" aria-label="Toggle sidebar">
            {collapsed ? <ChevronsRight className="size-4" /> : <><ChevronsLeft className="size-4" />Collapse</>}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Broadcast status bar */}
        <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border bg-panel px-3">
          <OnAirBadge onAir={onAir} engineOnline={online} webLive={webLive} />
          <div className="flex min-w-0 items-center gap-2 text-[13px]">
            <span className="label-caps hidden sm:inline">{onAir ? (status?.source === "live" ? "Live" : status?.source === "emergency" ? "Emergency" : "Program") : "Program"}</span>
            <span className="truncate font-medium">{onAir ? status?.current_title ?? "Untitled" : webLive ? `${pick?.title} · website playout` : online ? "Engine idle" : "Nothing scheduled right now"}</span>
          </div>
          <div className="flex-1" />
          <button onClick={() => setPalette(true)} className="hidden h-7 items-center gap-2 rounded-sm border border-border bg-inset px-2 text-xs text-muted-foreground hover:text-foreground md:flex">
            <Search className="size-3.5" /> Search <kbd className="timecode rounded-sm border border-border px-1 text-[10px]">Ctrl K</kbd>
          </button>
          <div className="hidden items-center gap-1.5 text-xs lg:flex" title="Playout engine heartbeat">
            <Tally tone={online ? "preview" : "off"} pulse={online} />
            <span className="text-muted-foreground">Engine</span>
            <span className="timecode">{online ? "online" : "offline"}</span>
          </div>
          <div className="hidden items-center gap-1.5 text-xs lg:flex" title="Viewers with an active player in the last minute">
            <Activity className="size-3.5 text-muted-foreground" />
            <span className="timecode">{viewers.data ?? "—"}</span>
            <span className="text-muted-foreground">watching</span>
          </div>
          <div className="text-right leading-tight">
            <div className="timecode text-sm font-semibold">{now ? formatClock(now, channel.timezone) : "--:--:--"}</div>
            <div className="text-[10px] text-muted-foreground">{now ? formatDate(now, channel.timezone) : ""} · EAT</div>
          </div>
          <Notifications />
          <Popover>
            <PopoverTrigger className="grid size-7 place-items-center rounded-sm bg-panel-raised text-xs font-semibold uppercase" aria-label="Account">
              {(user.email ?? "?").slice(0, 1)}
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-3">
              <div className="truncate text-sm font-medium">{user.email}</div>
              <div className="mt-1 flex flex-wrap gap-1">{roles.map((r) => <span key={r} className="rounded-sm bg-accent px-1.5 py-0.5 text-[10px]">{ROLE_LABELS[r]}</span>)}</div>
              <button onClick={onSignOut} className="mt-3 flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"><LogOut className="size-4" />Sign out</button>
            </PopoverContent>
          </Popover>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>

      <CommandPalette
        open={palette}
        onOpenChange={setPalette}
        onNavigate={(to) => { setPalette(false); navigate({ to }); }}
        onOpenMedia={(title) => { setPalette(false); navigate({ to: "/admin/media", search: { q: title } }); }}
      />
    </div>
  );
}

function Notifications() {
  const { channel } = useStation();
  useRealtimeInvalidate("broadcast_events", [["alerts", channel.id], ["events", channel.id]], `channel_id=eq.${channel.id}`);
  const { data } = useQuery({
    queryKey: ["alerts", channel.id],
    queryFn: async () => {
      const { data } = await supabase.from("broadcast_events").select("id, severity, message, occurred_at, event_type").eq("channel_id", channel.id).in("severity", ["warning", "error", "critical"]).order("occurred_at", { ascending: false }).limit(25);
      return data ?? [];
    },
  });
  const [seen, setSeen] = useState<string | null>(null);
  useEffect(() => setSeen(localStorage.getItem("mm-alerts-seen")), []);
  const unread = (data ?? []).filter((a) => !seen || a.occurred_at > seen).length;
  return (
    <Popover onOpenChange={(o) => { if (o && data?.[0]) { localStorage.setItem("mm-alerts-seen", data[0].occurred_at); setSeen(data[0].occurred_at); } }}>
      <PopoverTrigger className="relative grid size-7 place-items-center rounded-sm hover:bg-accent" aria-label="Notifications">
        <Bell className="size-4" />
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-program px-0.5 text-[9px] font-bold text-program-foreground">{unread}</span>}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="panel-header">System alerts</div>
        <div className="max-h-80 overflow-y-auto">
          {!data?.length && <div className="p-4 text-xs text-muted-foreground">No alerts reported by the playout engine.</div>}
          {data?.map((a) => (
            <div key={a.id} className="flex gap-2 border-b border-border/60 px-3 py-2 text-xs">
              <Tally tone={a.severity === "warning" ? "warn" : "program"} className="mt-1" />
              <div className="min-w-0"><div>{a.message}</div><div className="timecode text-[10px] text-muted-foreground">{new Date(a.occurred_at).toLocaleString("en-GB", { timeZone: channel.timezone })}</div></div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CommandPalette({ open, onOpenChange, onNavigate, onOpenMedia }: { open: boolean; onOpenChange: (o: boolean) => void; onNavigate: (to: NavTo) => void; onOpenMedia: (title: string) => void }) {
  const { channel } = useStation();
  const [q, setQ] = useState("");
  const media = useQuery({
    queryKey: ["palette-media", q],
    enabled: open && q.trim().length > 1,
    queryFn: async () => {
      const { data } = await supabase.from("media_assets").select("id, title, category").eq("channel_id", channel.id).ilike("title", `%${q.trim()}%`).limit(8);
      return data ?? [];
    },
  });
  const pages = useMemo(() => NAV.flatMap((g) => g.items), []);
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Jump to a page or search media…" value={q} onValueChange={setQ} />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Pages">
          {pages.map((p) => (
            <CommandItem key={p.to} onSelect={() => onNavigate(p.to)}><p.icon className="mr-2 size-4" />{p.label}</CommandItem>
          ))}
        </CommandGroup>
        {!!media.data?.length && (
          <CommandGroup heading="Media">
            {media.data.map((m) => (
              <CommandItem key={m.id} value={`media-${m.title}-${m.id}`} onSelect={() => onOpenMedia(m.title)}>
                <Film className="mr-2 size-4" />{m.title}<span className="ml-auto text-[10px] uppercase text-muted-foreground">{m.category}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
