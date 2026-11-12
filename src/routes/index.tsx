import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CalendarRange, Play, Tv } from "lucide-react";
import { publicStationQuery } from "@/components/public/station-query";
import { PublicBackdrop, PublicFooter, PublicHeader } from "@/components/public/PublicChrome";
import { playbackUrl } from "@/lib/stream-url";
import { LivePlayer } from "@/components/public/LivePlayer";
import { useNow } from "@/hooks/use-station";
import { useWebPlayout } from "@/hooks/use-web-playout";
import { CATEGORY_LABELS } from "@/lib/labels";
import { findNowNext, formatDate, formatTime, isEngineOnline, isOnAir } from "@/lib/broadcast";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MOVIE MAX — Watch Live TV" },
      { name: "description", content: "Watch MOVIE MAX live: premium movies, series and entertainment broadcasting 24 hours a day from Kampala." },
      { property: "og:title", content: "MOVIE MAX — Watch Live TV" },
      { property: "og:description", content: "Premium movies, series and entertainment, live 24 hours a day." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(publicStationQuery()),
  component: Home,
});

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
  const schedule = data.schedule.filter((p) => !p.is_commercial_break);
  const { current, next } = findNowNext(schedule, now ?? 0);
  // Only call it "now showing" when the engine confirms the scheduled programme is what is on air.
  const confirmedCurrent = onAir && data.status?.source === "schedule" ? schedule.find((p) => p.id === data.status?.current_entry_id) ?? null : null;
  const webCurrent = webLive ? schedule.find((p) => p.id === pick?.entry.id) ?? null : null;
  const nowTitle = onAir ? (confirmedCurrent?.title ?? data.status?.current_title ?? "Live broadcast") : webLive ? (pick?.title ?? null) : null;
  const upcoming = schedule.filter((p) => now != null && +new Date(p.starts_at) > now).slice(0, 8);
  const featured = [...new Map(schedule.filter((p) => p.thumbnail_url).map((p) => [p.title, p])).values()].slice(0, 6);

  const nextIn = next && now != null ? Math.max(0, Math.round((+new Date(next.starts_at) - now) / 60000)) : null;

  return (
    <div className="theme-public public-bg relative isolate min-h-screen overflow-x-hidden text-foreground">
      <PublicBackdrop />
      <PublicHeader onAir={onAir} engineOnline={online} webLive={webLive} />
      <main className="mx-auto max-w-7xl px-4 md:px-6">
        {/* Hero bento: big glass intro card + the live screen */}
        <section className="grid gap-5 pt-8 lg:grid-cols-12 lg:pt-12">
          <div className="glass flex flex-col justify-between rounded-[2rem] p-7 md:p-9 lg:col-span-5">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-panel-raised px-3 py-1 text-xs font-semibold text-muted-foreground shadow-sm">
                <span className={onAir || webLive ? "size-1.5 rounded-full bg-program animate-tally" : "size-1.5 rounded-full bg-muted-foreground/50"} />
                {onAir || webLive ? "Now on MOVIE MAX" : "MOVIE MAX · Kampala"}
              </span>
              <h1 className="mt-6 font-headline text-4xl font-semibold leading-[1.05] tracking-tight md:text-5xl">
                {nowTitle ?? "Live TV, all day, every day."}
              </h1>
              <p className="mt-5 max-w-md leading-relaxed text-muted-foreground">
                {onAir ? (confirmedCurrent?.description ?? ch?.description) : webLive ? (webCurrent?.description ?? ch?.description) : current ? `Scheduled now: ${current.title}. The channel is not broadcasting at the moment.` : ch?.description}
              </p>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="cream" size="pill"><Link to="/guide"><CalendarRange />TV guide</Link></Button>
              <Button asChild variant="emerald" size="pill"><Link to="/watch"><Play />Watch live</Link></Button>
            </div>
          </div>
          <div className="theme-screen relative overflow-hidden rounded-[2rem] bg-inset shadow-[var(--shadow-soft)] ring-1 ring-foreground/5 lg:col-span-7">
            <div className="relative aspect-video w-full">
              {ch && <LivePlayer channelId={ch.id} src={playbackUrl(ch.hls_url, ch.slug)} onAir={onAir} web={web} className="absolute inset-0" />}
            </div>
          </div>
        </section>

        {/* Second row: up next (sun), any screen (emerald), small facts */}
        <section className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-12">
          <div className="sun-card silk flex min-h-56 flex-col justify-between rounded-[2rem] p-7 lg:col-span-4">
            <div className="font-headline text-xs font-semibold uppercase tracking-[0.2em] opacity-75">Up next{next ? ` · ${formatTime(next.starts_at, tz)}` : ""}</div>
            <div>
              <div className="font-headline text-2xl font-semibold leading-tight">{next?.title ?? "More great TV is on the way"}</div>
              <div className="mt-2 text-sm opacity-80">{next ? `${CATEGORY_LABELS[next.category]}${nextIn != null ? ` · starts in ${nextIn < 60 ? `${nextIn} min` : `${Math.round(nextIn / 60)} h`}` : ""}` : "Check the TV guide for the full week."}</div>
            </div>
          </div>
          <div className="emerald-card silk relative flex min-h-56 flex-col justify-between rounded-[2rem] p-7 lg:col-span-4">
            <div className="font-headline text-xs font-semibold uppercase tracking-[0.2em] opacity-75">Any screen</div>
            <div className="absolute right-7 top-7 grid size-12 place-items-center rounded-full bg-panel-raised/95 text-emerald shadow-lg"><Tv className="size-5" /></div>
            <div>
              <div className="font-headline text-2xl font-semibold leading-tight">Phones, laptops and smart TVs.</div>
              <div className="mt-2 text-sm opacity-80">Everyone watches the same live channel, in sync.</div>
            </div>
          </div>
          <div className="grid gap-5 md:col-span-2 md:grid-cols-2 lg:col-span-4 lg:grid-cols-1">
            <div className="glass rounded-[1.75rem] p-6">
              <div className="font-headline text-lg font-semibold">One channel</div>
              <p className="mt-1 text-sm text-muted-foreground">A continuous live broadcast — just like television.</p>
            </div>
            <div className="glass rounded-[1.75rem] p-6">
              <div className="font-headline text-lg font-semibold">East Africa Time</div>
              <p className="mt-1 text-sm text-muted-foreground">All programme times are shown in Kampala time (UTC+3).</p>
            </div>
          </div>
        </section>

        <section className="pt-16">
          <div className="flex items-end justify-between">
            <h2 className="font-headline text-3xl font-semibold tracking-tight">Coming up</h2>
            <Link to="/guide" className="rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-panel-raised hover:text-foreground">Full guide →</Link>
          </div>
          {upcoming.length ? (
            <div className="glass mt-6 grid gap-2 rounded-[2rem] p-3 md:grid-cols-2">
              {upcoming.map((p) => (
                <div key={p.id} className="flex items-center gap-4 rounded-[1.25rem] bg-panel-raised/80 px-4 py-3 shadow-sm">
                  <div className="timecode grid h-12 w-16 shrink-0 place-items-center rounded-2xl bg-cream text-base font-semibold">{formatTime(p.starts_at, tz)}</div>
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{p.title}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(p.starts_at, tz, { weekday: "short", day: "numeric", month: "short" })} · {CATEGORY_LABELS[p.category]}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="glass mt-6 rounded-[2rem] p-8 text-muted-foreground">The programme schedule will appear here soon.</p>}
        </section>

        {featured.length > 0 && (
          <section className="pt-16">
            <h2 className="font-headline text-3xl font-semibold tracking-tight">Featured on MOVIE MAX</h2>
            <div className="mt-6 grid grid-cols-2 gap-5 md:grid-cols-3">
              {featured.map((p) => (
                <div key={p.id} className="glass group rounded-[1.75rem] p-2.5">
                  <div className="aspect-video overflow-hidden rounded-[1.25rem] bg-inset"><img src={p.thumbnail_url ?? ""} alt={p.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" /></div>
                  <div className="px-2 pb-1.5 pt-3">
                    <div className="truncate font-semibold">{p.title}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(p.starts_at, tz)} · {formatTime(p.starts_at, tz)}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
      <PublicFooter description={ch?.description} />
    </div>
  );
}
