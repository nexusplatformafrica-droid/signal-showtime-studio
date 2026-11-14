import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CalendarRange, ChevronRight, Maximize2, Play } from "lucide-react";
import { publicStationQuery, type PublicProgramme } from "@/components/public/station-query";
import { PublicShell } from "@/components/public/PublicChrome";
import { SITE_NAME } from "@/components/brand/Wordmark";
import { OnAirBadge } from "@/components/broadcast/status";
import { playbackUrl } from "@/lib/stream-url";
import { LivePlayer } from "@/components/public/LivePlayer";
import { useNow } from "@/hooks/use-station";
import { useWebPlayout } from "@/hooks/use-web-playout";
import { CATEGORY_LABELS, type MediaCategory } from "@/lib/labels";
import { addDays, durationMinutes, formatClock, formatDate, formatDuration, formatTime, isEngineOnline, isOnAir, toZoned } from "@/lib/broadcast";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MOVIE MAX TV — Watch Live TV" },
      { name: "description", content: "Watch MOVIE MAX TV live: premium movies, series and entertainment broadcasting 24 hours a day from Kampala." },
      { property: "og:title", content: "MOVIE MAX TV — Watch Live TV" },
      { property: "og:description", content: "Premium movies, series and entertainment on MOVIE MAX TV, live 24 hours a day." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(publicStationQuery()),
  component: Home,
});

/** Programme types that are station filler, not shows viewers browse for. */
const HIDDEN: MediaCategory[] = ["advertisement", "station_id", "emergency"];
const ROW_TITLES: Partial<Record<MediaCategory, string>> = {
  movie: "Movies", series: "Series", episode: "Episodes", music_video: "Music videos", news: "News",
  documentary: "Documentaries", trailer: "Trailers", promo: "Promos", other: "More shows",
};
const ROW_ORDER: MediaCategory[] = ["movie", "series", "episode", "news", "documentary", "music_video", "trailer", "promo", "other"];
const DEFAULT_TILES: MediaCategory[] = ["movie", "series", "news", "documentary", "music_video"];

function uniqueByTitle(list: PublicProgramme[]) {
  return [...new Map(list.map((p) => [p.title, p])).values()];
}

function Home() {
  const { data } = useSuspenseQuery(publicStationQuery());
  const now = useNow(1000);
  const ch = data.channel;
  const tz = ch?.timezone ?? "Africa/Kampala";
  const onAir = now != null && isOnAir(data.status, now);
  const online = now != null && isEngineOnline(data.status, now);
  const { web, pick } = useWebPlayout(now);
  // No engine on air: the website plays the published schedule itself.
  const webLive = !onAir && !!pick;
  const liveEntryId = onAir ? (data.status?.source === "schedule" ? data.status?.current_entry_id ?? null : null) : webLive ? pick?.entry.id ?? null : null;

  const shows = data.schedule.filter((p) => !p.is_commercial_break && !HIDDEN.includes(p.category));
  const confirmedCurrent = liveEntryId ? shows.find((p) => p.id === liveEntryId) ?? null : null;
  const nowTitle = onAir ? (confirmedCurrent?.title ?? data.status?.current_title ?? "Live broadcast") : webLive ? (pick?.title ?? null) : null;
  const nowDesc = confirmedCurrent?.description ?? ch?.description ?? null;

  const t = now ?? 0;
  const upcoming = shows.filter((p) => +new Date(p.starts_at) > t).sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));
  const notEnded = shows.filter((p) => +new Date(p.ends_at) > t);
  const heroCards = upcoming.slice(0, 2);
  const rows = ROW_ORDER.map((cat) => ({ cat, items: uniqueByTitle(notEnded.filter((p) => p.category === cat)) })).filter((r) => r.items.length > 0);
  const tileCats = rows.length ? rows.map((r) => r.cat) : DEFAULT_TILES;
  const tileImage = (cat: MediaCategory) => shows.find((p) => p.category === cat && p.thumbnail_url)?.thumbnail_url ?? null;

  const today = now != null ? toZoned(now, tz).date : null;
  const dayLabel = (iso: string) => {
    const d = toZoned(iso, tz).date;
    if (today && d === today) return "Today";
    if (today && d === addDays(today, 1)) return "Tomorrow";
    return formatDate(iso, tz, { weekday: "short" });
  };
  const cardProps = { tz, dayLabel, liveEntryId, liveLabel: onAir ? "On air" : "Live" };

  return (
    <PublicShell onAir={onAir} engineOnline={online} webLive={webLive} description={ch?.description}>
      <main className="mx-auto max-w-[90rem] px-4 md:px-8">
        {/* Live channel + the next two programmes */}
        <section className="grid gap-4 pt-2 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <div className="neon-frame neon-glow rounded-2xl [--glow:var(--neon-pink)]">
              <div className="theme-screen relative aspect-video overflow-hidden rounded-[14px] bg-inset">
                {ch && <LivePlayer channelId={ch.id} src={playbackUrl(ch.hls_url, ch.slug)} onAir={onAir} web={web} className="absolute inset-0" />}
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-border/70 bg-panel px-3 py-2.5">
              <OnAirBadge onAir={onAir} engineOnline={online} webLive={webLive} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{nowTitle ?? `${SITE_NAME} · Kampala`}</div>
                <div className="truncate text-xs text-muted-foreground">{nowTitle ? (nowDesc ?? "Now showing") : "Live TV, all day, every day."}</div>
              </div>
              <span className="timecode hidden rounded-full bg-panel-raised px-3 py-1 text-sm sm:inline">{now ? formatClock(now, tz).slice(0, 5) : "--:--"} EAT</span>
              <Link to="/watch" className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-neon-pink px-3.5 text-[13px] font-extrabold uppercase text-primary-foreground hover:brightness-110">
                <Maximize2 className="size-3.5" /><span className="hidden sm:inline">Full screen</span>
              </Link>
            </div>
          </div>
          <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 lg:col-span-4 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
            {heroCards.map((p, i) => <HeroCard key={p.id} p={p} label={i === 0 ? "Up next" : "Later"} tz={tz} dayLabel={dayLabel} />)}
            {heroCards.length < 2 && <PromoCard kind="guide" />}
            {heroCards.length < 1 && <PromoCard kind="screens" />}
          </div>
        </section>

        {/* Category tiles */}
        <section className="no-scrollbar -mx-4 mt-6 flex gap-3 overflow-x-auto px-4 pb-1">
          {tileCats.map((cat, i) => {
            const img = tileImage(cat);
            return (
              <Link key={cat} to="/guide" search={{ cat }} className={cn("tile group h-[5.5rem] w-48 shrink-0 rounded-xl sm:w-52", `tile-${i % 6}`)}>
                <div className="tile-fill relative flex h-full items-center overflow-hidden rounded-[10px] px-4">
                  {img && <img src={img} alt="" loading="lazy" className="absolute inset-y-0 right-0 h-full w-2/3 object-cover opacity-45 transition duration-500 [mask-image:linear-gradient(90deg,transparent,black_60%)] group-hover:scale-105" />}
                  <span className="relative text-[15px] font-black uppercase leading-tight tracking-wide drop-shadow">{ROW_TITLES[cat] ?? CATEGORY_LABELS[cat]}</span>
                </div>
              </Link>
            );
          })}
          <Link to="/guide" className="tile tile-5 group h-[5.5rem] w-48 shrink-0 rounded-xl sm:w-52">
            <div className="tile-fill flex h-full items-center gap-2 rounded-[10px] px-4 text-[15px] font-black uppercase tracking-wide"><CalendarRange className="size-5" />TV guide</div>
          </Link>
        </section>

        {upcoming.length > 0 ? (
          <Row title="Coming up" to={{ cat: undefined }}>
            {upcoming.slice(0, 14).map((p) => <ProgrammeCard key={p.id} p={p} {...cardProps} />)}
          </Row>
        ) : (
          <section className="mt-10 rounded-2xl border border-border/70 bg-panel p-8 text-center text-muted-foreground">
            The programme schedule will appear here soon.
          </section>
        )}

        {rows.map((r) => (
          <Row key={r.cat} title={ROW_TITLES[r.cat] ?? CATEGORY_LABELS[r.cat]} to={{ cat: r.cat }}>
            {r.items.slice(0, 14).map((p) => <ProgrammeCard key={p.id} p={p} {...cardProps} />)}
          </Row>
        ))}
      </main>
    </PublicShell>
  );
}

function Row({ title, to, children }: { title: string; to: { cat: MediaCategory | undefined }; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-end justify-between">
        <h2 className="text-xl font-extrabold tracking-tight">{title}</h2>
        <Link to="/guide" search={to} className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground">See all<ChevronRight className="size-4" /></Link>
      </div>
      <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-1">{children}</div>
    </section>
  );
}

function Thumb({ p, className }: { p: PublicProgramme; className?: string }) {
  return p.thumbnail_url
    ? <img src={p.thumbnail_url} alt="" loading="lazy" className={cn("h-full w-full object-cover", className)} />
    : <div className={cn("bg-hot grid h-full w-full place-items-center p-4 text-center text-lg font-black uppercase leading-tight text-primary-foreground", className)}>{p.title}</div>;
}

function HeroCard({ p, label, tz, dayLabel }: { p: PublicProgramme; label: string; tz: string; dayLabel: (iso: string) => string }) {
  return (
    <Link to="/guide" search={{ q: p.title }} className="neon-frame group w-[82%] shrink-0 snap-start rounded-2xl sm:w-[46%] lg:w-auto lg:flex-1">
      <div className="relative aspect-video h-full w-full overflow-hidden rounded-[14px] bg-panel lg:aspect-auto">
        <Thumb p={p} className="absolute inset-0 transition duration-500 group-hover:scale-105" />
        <div className="card-scrim absolute inset-0" />
        <span className="badge-hot absolute left-3 top-3 rounded-md px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide">{label} · {formatTime(p.starts_at, tz)}</span>
        <div className="absolute inset-x-3 bottom-3">
          <span className="inline rounded-md bg-background/85 px-2 py-0.5 text-base font-bold leading-relaxed [box-decoration-break:clone] sm:text-lg">{p.title}</span>
          <div className="mt-2 flex items-center gap-2">
            <span className="inline-flex h-7 items-center gap-1 rounded-md bg-neon-pink px-2.5 text-xs font-bold text-primary-foreground"><Play className="size-3 fill-current" />{dayLabel(p.starts_at)}</span>
            <span className="truncate text-xs text-foreground/85">{CATEGORY_LABELS[p.category]} · {formatDuration(durationMinutes(p.starts_at, p.ends_at) * 60)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function PromoCard({ kind }: { kind: "guide" | "screens" }) {
  const guide = kind === "guide";
  return (
    <Link to={guide ? "/guide" : "/watch"} className="neon-frame w-[82%] shrink-0 snap-start rounded-2xl [--frame:var(--gradient-ring)] sm:w-[46%] lg:w-auto lg:flex-1">
      <div className={cn("flex aspect-video h-full flex-col justify-end rounded-[14px] p-5 lg:aspect-auto", guide ? "bg-hot" : "bg-panel")}>
        <div className="text-xs font-extrabold uppercase tracking-[0.18em] opacity-80">{guide ? "7-day TV guide" : "Any screen"}</div>
        <div className="mt-1 text-xl font-extrabold leading-tight">{guide ? "See everything coming up this week" : "Phones, laptops and smart TVs — all in sync"}</div>
      </div>
    </Link>
  );
}

function ProgrammeCard({ p, tz, dayLabel, liveEntryId, liveLabel }: { p: PublicProgramme; tz: string; dayLabel: (iso: string) => string; liveEntryId: string | null; liveLabel: string }) {
  const live = liveEntryId === p.id;
  const series = p.category === "series" || p.category === "episode";
  return (
    <Link to="/guide" search={{ q: p.title }} className="group w-56 shrink-0 snap-start sm:w-64">
      <div className="relative aspect-video overflow-hidden rounded-lg bg-panel">
        <Thumb p={p} className="transition duration-500 group-hover:scale-105" />
        <span className={cn("absolute left-0 top-0 rounded-br-md px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide", live ? "bg-program text-program-foreground" : "badge-hot")}>
          {live ? liveLabel : `${dayLabel(p.starts_at)} ${formatTime(p.starts_at, tz)}`}
        </span>
        <span className={cn("absolute right-2 top-2 rounded px-1.5 py-0.5 text-[10px] font-extrabold uppercase", series ? "bg-neon-pink text-primary-foreground" : "bg-neon-gold text-neon-ink")}>{CATEGORY_LABELS[p.category]}</span>
        <span className="timecode absolute bottom-2 right-2 rounded bg-background/85 px-1.5 text-[11px] font-semibold">{formatDuration(durationMinutes(p.starts_at, p.ends_at) * 60)}</span>
      </div>
      <div className="mt-2 truncate text-sm font-medium text-foreground/90">{p.title}</div>
      <div className="truncate text-xs text-muted-foreground">{formatDate(p.starts_at, tz)} · {formatTime(p.starts_at, tz)}{p.description ? ` · ${p.description}` : ""}</div>
    </Link>
  );
}
