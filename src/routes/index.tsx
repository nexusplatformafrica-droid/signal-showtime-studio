import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CalendarRange, Play } from "lucide-react";
import { publicStationQuery } from "@/components/public/station-query";
import { PublicFooter, PublicHeader } from "@/components/public/PublicChrome";
import { LivePlayer } from "@/components/public/LivePlayer";
import { useNow } from "@/hooks/use-station";
import { CATEGORY_LABELS } from "@/lib/labels";
import { findNowNext, formatDate, formatTime, isEngineOnline, isOnAir } from "@/lib/broadcast";
import { Button } from "@/components/ui/button";
import slate from "@/assets/standby-slate.jpg";

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
  const schedule = data.schedule.filter((p) => !p.is_commercial_break);
  const { current, next } = findNowNext(schedule, now ?? 0);
  // Only call it "now showing" when the engine confirms the scheduled programme is what is on air.
  const confirmedCurrent = onAir && (data.status?.source === "schedule" ? schedule.find((p) => p.id === data.status?.current_entry_id) ?? null : null);
  const nowTitle = onAir ? (confirmedCurrent?.title ?? data.status?.current_title ?? "Live broadcast") : null;
  const upcoming = schedule.filter((p) => now != null && +new Date(p.starts_at) > now).slice(0, 8);
  const featured = [...new Map(schedule.filter((p) => p.thumbnail_url).map((p) => [p.title, p])).values()].slice(0, 6);

  return (
    <div className="theme-public min-h-screen bg-background text-foreground">
      <PublicHeader onAir={onAir} engineOnline={online} />
      <main>
        <section className="relative overflow-hidden border-b border-border/70">
          <img src={slate} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" width={1920} height={1088} />
          <div className="absolute inset-0 hero-scrim" />
          <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-10 md:px-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:py-14">
            <div className="monitor rounded-sm shadow-2xl" data-tally={onAir ? "program" : undefined}>
              {ch && <LivePlayer channelId={ch.id} src={ch.hls_url} onAir={onAir} className="absolute inset-0" />}
            </div>
            <div className="flex flex-col justify-center">
              <div className="label-caps text-gold">{onAir ? "Now on MOVIE MAX" : "MOVIE MAX"}</div>
              <h1 className="mt-2 font-display text-4xl font-black uppercase leading-[0.95] tracking-tight md:text-5xl" style={{ fontStretch: "85%" }}>
                {nowTitle ?? "Live TV, all day, every day"}
              </h1>
              <p className="mt-4 max-w-md text-muted-foreground">
                {onAir ? (confirmedCurrent?.description ?? ch?.description) : current ? `Scheduled now: ${current.title}. The channel is not broadcasting at the moment.` : ch?.description}
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Button asChild variant="brand" size="lg"><Link to="/watch"><Play />Watch live</Link></Button>
                <Button asChild variant="panel" size="lg"><Link to="/guide"><CalendarRange />TV guide</Link></Button>
              </div>
              {next && (
                <div className="mt-8 border-l-2 border-program pl-4">
                  <div className="label-caps">Up next · {formatTime(next.starts_at, tz)}</div>
                  <div className="mt-1 text-lg font-semibold">{next.title}</div>
                  <div className="text-sm text-muted-foreground">{CATEGORY_LABELS[next.category]}</div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pt-12 md:px-6">
          <div className="flex items-end justify-between">
            <h2 className="font-display text-2xl font-black uppercase tracking-tight">Coming up</h2>
            <Link to="/guide" className="text-sm text-muted-foreground hover:text-foreground">Full guide →</Link>
          </div>
          {upcoming.length ? (
            <div className="mt-5 divide-y divide-border/70 border-y border-border/70">
              {upcoming.map((p) => (
                <div key={p.id} className="grid grid-cols-[72px_1fr] items-center gap-4 py-3 sm:grid-cols-[90px_120px_1fr]">
                  <div className="timecode text-lg font-semibold">{formatTime(p.starts_at, tz)}</div>
                  <div className="hidden text-xs uppercase tracking-wider text-muted-foreground sm:block">{formatDate(p.starts_at, tz, { weekday: "short", day: "numeric", month: "short" })}</div>
                  <div className="min-w-0"><div className="truncate font-semibold">{p.title}</div><div className="text-xs text-muted-foreground">{CATEGORY_LABELS[p.category]}</div></div>
                </div>
              ))}
            </div>
          ) : <p className="mt-5 text-muted-foreground">The programme schedule will appear here soon.</p>}
        </section>

        {featured.length > 0 && (
          <section className="mx-auto max-w-7xl px-4 pt-12 md:px-6">
            <h2 className="font-display text-2xl font-black uppercase tracking-tight">Featured on MOVIE MAX</h2>
            <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3">
              {featured.map((p) => (
                <div key={p.id} className="group">
                  <div className="aspect-video overflow-hidden rounded-sm bg-inset"><img src={p.thumbnail_url ?? ""} alt={p.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" /></div>
                  <div className="mt-2 truncate font-semibold">{p.title}</div>
                  <div className="text-xs text-muted-foreground">{formatDate(p.starts_at, tz)} · {formatTime(p.starts_at, tz)}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mx-auto max-w-7xl px-4 pt-12 md:px-6">
          <div className="grid gap-6 border-t border-border/70 pt-10 md:grid-cols-3">
            <div><div className="label-caps">One channel</div><p className="mt-2 text-sm text-muted-foreground">Every viewer watches the same continuous live broadcast — just like television.</p></div>
            <div><div className="label-caps">Any screen</div><p className="mt-2 text-sm text-muted-foreground">Phones, laptops, smart TVs and Android TV with adaptive quality.</p></div>
            <div><div className="label-caps">East Africa Time</div><p className="mt-2 text-sm text-muted-foreground">All programme times are shown in Kampala time (EAT, UTC+3).</p></div>
          </div>
        </section>
      </main>
      <PublicFooter description={ch?.description} />
    </div>
  );
}
