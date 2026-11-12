import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { publicStationQuery } from "@/components/public/station-query";
import { playbackUrl } from "@/lib/stream-url";
import { LivePlayer } from "@/components/public/LivePlayer";
import { Wordmark } from "@/components/brand/Wordmark";
import { OnAirBadge } from "@/components/broadcast/status";
import { PublicBackdrop } from "@/components/public/PublicChrome";
import { useNow } from "@/hooks/use-station";
import { useWebPlayout } from "@/hooks/use-web-playout";
import { findNowNext, formatClock, formatTime, isEngineOnline, isOnAir } from "@/lib/broadcast";

export const Route = createFileRoute("/watch")({
  head: () => ({
    meta: [
      { title: "Watch MOVIE MAX Live" },
      { name: "description", content: "Full-screen live player for the MOVIE MAX television channel." },
      { property: "og:title", content: "Watch MOVIE MAX Live" },
      { property: "og:description", content: "Full-screen live player for the MOVIE MAX television channel." },
      { property: "og:type", content: "video.other" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(publicStationQuery()),
  component: Watch,
});

function Watch() {
  const { data } = useSuspenseQuery(publicStationQuery());
  const now = useNow(1000);
  const ch = data.channel;
  const tz = ch?.timezone ?? "Africa/Kampala";
  const onAir = now != null && isOnAir(data.status, now);
  const online = now != null && isEngineOnline(data.status, now);
  const { web, pick } = useWebPlayout(now);
  const webLive = !onAir && !!pick;
  const { next } = findNowNext(data.schedule, now ?? 0);
  return (
    <div className="theme-public public-bg relative isolate flex min-h-screen flex-col text-foreground">
      <PublicBackdrop />
      <div className="px-3 pt-3 md:px-6">
        <div className="glass mx-auto flex h-14 max-w-[min(100%,calc((100vh-9rem)*16/9))] items-center gap-3 rounded-full pl-5 pr-2">
          <Link to="/" aria-label="MOVIE MAX home"><Wordmark className="text-lg" /></Link>
          <OnAirBadge onAir={onAir} engineOnline={online} webLive={webLive} />
          <span className="hidden truncate text-sm font-medium sm:inline">{onAir ? data.status?.current_title ?? "Live" : webLive ? pick?.title : ""}</span>
          <span className="ml-auto timecode rounded-full bg-panel-raised px-3 py-1 text-sm shadow-sm">{now ? formatClock(now, tz).slice(0, 5) : ""} EAT</span>
          <Link to="/guide" className="rounded-full bg-emerald px-4 py-2 text-sm font-semibold text-emerald-foreground">TV guide</Link>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center p-3 md:p-6">
        <div className="theme-screen relative aspect-video w-full max-w-[min(100%,calc((100vh-9rem)*16/9))] overflow-hidden rounded-[2rem] bg-inset shadow-[var(--shadow-soft)] ring-1 ring-foreground/5">
          {ch && <LivePlayer channelId={ch.id} src={playbackUrl(ch.hls_url, ch.slug)} onAir={onAir} web={web} className="absolute inset-0" />}
        </div>
      </div>
      {next && (
        <div className="px-3 pb-4 md:px-6">
          <div className="sun-card mx-auto flex w-fit max-w-full items-center gap-3 rounded-full px-5 py-2.5 text-sm">
            <span className="font-headline text-xs font-semibold uppercase tracking-[0.2em] opacity-75">Up next</span>
            <span className="timecode font-semibold">{formatTime(next.starts_at, tz)}</span>
            <span className="truncate font-semibold">{next.title}</span>
          </div>
        </div>
      )}
    </div>
  );
}
