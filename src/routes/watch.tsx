import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { publicStationQuery } from "@/components/public/station-query";
import { playbackUrl } from "@/lib/stream-url";
import { LivePlayer } from "@/components/public/LivePlayer";
import { OnAirBadge } from "@/components/broadcast/status";
import { PublicShell } from "@/components/public/PublicChrome";
import { useNow } from "@/hooks/use-station";
import { useWebPlayout } from "@/hooks/use-web-playout";
import { findNowNext, formatClock, formatTime, isEngineOnline, isOnAir } from "@/lib/broadcast";

export const Route = createFileRoute("/watch")({
  head: () => ({
    meta: [
      { title: "Watch MOVIE MAX TV Live" },
      { name: "description", content: "Full-screen live player for the MOVIE MAX TV television channel." },
      { property: "og:title", content: "Watch MOVIE MAX TV Live" },
      { property: "og:description", content: "Full-screen live player for the MOVIE MAX TV television channel." },
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
  const title = onAir ? data.status?.current_title ?? "Live" : webLive ? pick?.title : null;
  const width = "w-full max-w-[min(100%,calc((100vh-12rem)*16/9))]";
  return (
    <PublicShell onAir={onAir} engineOnline={online} webLive={webLive} footer={false}>
      <main className="flex flex-col items-center px-3 pt-2 md:px-8">
        <div className={`neon-frame neon-glow rounded-2xl [--glow:var(--neon-pink)] ${width}`}>
          <div className="theme-screen relative aspect-video overflow-hidden rounded-[14px] bg-inset">
            {ch && <LivePlayer channelId={ch.id} src={playbackUrl(ch.hls_url, ch.slug)} onAir={onAir} web={web} className="absolute inset-0" />}
          </div>
        </div>
        <div className={`mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-panel px-3 py-2.5 ${width}`}>
          <OnAirBadge onAir={onAir} engineOnline={online} webLive={webLive} size="lg" />
          <span className="min-w-0 flex-1 truncate font-bold">{title ?? "MOVIE MAX TV"}</span>
          {next && (
            <span className="inline-flex min-w-0 items-center gap-2 text-sm">
              <span className="badge-hot rounded-md px-2 py-0.5 text-[11px] font-extrabold uppercase">Up next {formatTime(next.starts_at, tz)}</span>
              <span className="truncate font-semibold">{next.title}</span>
            </span>
          )}
          <span className="timecode rounded-full bg-panel-raised px-3 py-1 text-sm">{now ? formatClock(now, tz).slice(0, 5) : "--:--"} EAT</span>
        </div>
      </main>
    </PublicShell>
  );
}
