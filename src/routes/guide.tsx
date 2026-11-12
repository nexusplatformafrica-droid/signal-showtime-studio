import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useWebPlayout } from "@/hooks/use-web-playout";
import { useSuspenseQuery } from "@tanstack/react-query";
import { publicStationQuery } from "@/components/public/station-query";
import { PublicFooter, PublicHeader } from "@/components/public/PublicChrome";
import { useNow } from "@/hooks/use-station";
import { CATEGORY_LABELS } from "@/lib/labels";
import { addDays, durationMinutes, formatDate, formatDuration, formatTime, isEngineOnline, isOnAir, toZoned, zonedToUtc } from "@/lib/broadcast";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/guide")({
  head: () => ({
    meta: [
      { title: "TV Guide — MOVIE MAX" },
      { name: "description", content: "The MOVIE MAX seven-day TV guide: programme times, descriptions and categories in East Africa Time." },
      { property: "og:title", content: "TV Guide — MOVIE MAX" },
      { property: "og:description", content: "Seven-day programme guide for the MOVIE MAX channel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(publicStationQuery()),
  component: Guide,
});

function Guide() {
  const { data } = useSuspenseQuery(publicStationQuery());
  const now = useNow(30000);
  const tz = data.channel?.timezone ?? "Africa/Kampala";
  const onAir = now != null && isOnAir(data.status, now);
  const online = now != null && isEngineOnline(data.status, now);
  const { pick } = useWebPlayout(now);
  const today = toZoned(now ?? new Date(), tz).date;
  const [day, setDay] = useState<string | null>(null);
  const selected = day ?? today;
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  const list = useMemo(() => {
    const s = +zonedToUtc(selected, "00:00", tz);
    const e = +zonedToUtc(addDays(selected, 1), "00:00", tz);
    return data.schedule.filter((p) => +new Date(p.ends_at) > s && +new Date(p.starts_at) < e);
  }, [data.schedule, selected, tz]);

  return (
    <div className="theme-public min-h-screen bg-background text-foreground">
      <PublicHeader onAir={onAir} engineOnline={online} webLive={!onAir && !!pick} />
      <main className="mx-auto max-w-5xl px-4 py-10 md:px-6">
        <h1 className="font-display text-4xl font-black uppercase tracking-tight">TV guide</h1>
        <p className="mt-2 text-sm text-muted-foreground">All times East Africa Time (Kampala, UTC+3).</p>
        <div className="mt-6 flex gap-1 overflow-x-auto border-b border-border/70">
          {days.map((d) => (
            <button key={d} onClick={() => setDay(d)} className={cn("relative shrink-0 px-4 py-2.5 text-sm", d === selected ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
              <span className="block text-[10px] font-semibold uppercase tracking-widest">{d === today ? "Today" : formatDate(zonedToUtc(d, "12:00", tz), tz, { weekday: "short" })}</span>
              <span className="timecode">{formatDate(zonedToUtc(d, "12:00", tz), tz, { day: "numeric", month: "short" })}</span>
              {d === selected && <span className="absolute inset-x-3 bottom-0 h-0.5 bg-program" />}
            </button>
          ))}
        </div>
        {list.length === 0 && <p className="py-12 text-center text-muted-foreground">No programmes have been published for this day yet.</p>}
        <div className="divide-y divide-border/70">
          {list.map((p) => {
            const isConfirmedOnAir = onAir && data.status?.current_entry_id === p.id;
            const ended = now != null && +new Date(p.ends_at) < now;
            return (
              <article key={p.id} className={cn("grid grid-cols-[64px_1fr] gap-4 py-4 sm:grid-cols-[80px_160px_1fr]", ended && "opacity-50")}>
                <div>
                  <div className="timecode text-lg font-semibold">{formatTime(p.starts_at, tz)}</div>
                  <div className="timecode text-xs text-muted-foreground">{formatTime(p.ends_at, tz)}</div>
                </div>
                <div className="hidden aspect-video overflow-hidden rounded-sm bg-inset sm:block">{p.thumbnail_url && <img src={p.thumbnail_url} alt="" loading="lazy" className="h-full w-full object-cover" />}</div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">{p.title}</h2>
                    {isConfirmedOnAir && <span className="rounded-sm bg-program px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-program-foreground">On air</span>}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{CATEGORY_LABELS[p.category]} · {formatDuration(durationMinutes(p.starts_at, p.ends_at) * 60)}</div>
                  {p.description && <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>}
                </div>
              </article>
            );
          })}
        </div>
      </main>
      <PublicFooter description={data.channel?.description} />
    </div>
  );
}
