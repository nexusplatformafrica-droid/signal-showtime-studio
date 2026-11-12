import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { publicStationQuery } from "@/components/public/station-query";
import { playbackUrl } from "@/lib/stream-url";
import { LivePlayer } from "@/components/public/LivePlayer";
import { Wordmark } from "@/components/brand/Wordmark";
import { OnAirBadge } from "@/components/broadcast/status";
import { useNow } from "@/hooks/use-station";
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
  const { next } = findNowNext(data.schedule, now ?? 0);
  return (
    <div className="theme-public flex min-h-screen flex-col bg-inset text-foreground">
      <div className="flex h-12 items-center gap-4 border-b border-border/70 bg-background px-4">
        <Link to="/" aria-label="MOVIE MAX home"><Wordmark className="text-lg" /></Link>
        <OnAirBadge onAir={onAir} engineOnline={online} />
        <span className="truncate text-sm">{onAir ? data.status?.current_title ?? "Live" : ""}</span>
        <span className="ml-auto timecode text-sm text-muted-foreground">{now ? formatClock(now, tz).slice(0, 5) : ""} EAT</span>
        <Link to="/guide" className="text-sm text-muted-foreground hover:text-foreground">TV guide</Link>
      </div>
      <div className="flex flex-1 items-center justify-center p-0 md:p-4">
        <div className="monitor w-full max-w-[min(100%,calc((100vh-8rem)*16/9))]">
          {ch && <LivePlayer channelId={ch.id} src={playbackUrl(ch.hls_url, ch.slug)} onAir={onAir} className="absolute inset-0" />}
        </div>
      </div>
      {next && <div className="border-t border-border/70 bg-background px-4 py-2 text-sm text-muted-foreground">Up next <span className="timecode text-foreground">{formatTime(next.starts_at, tz)}</span> · <span className="text-foreground">{next.title}</span></div>}
    </div>
  );
}
