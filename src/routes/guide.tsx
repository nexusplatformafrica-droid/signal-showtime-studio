import { trueDate } from "@/lib/clock";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { X } from "lucide-react";
import { useWebPlayout } from "@/hooks/use-web-playout";
import { useSuspenseQuery } from "@tanstack/react-query";
import { publicStationQuery, type PublicProgramme } from "@/components/public/station-query";
import { PublicShell, SearchPill } from "@/components/public/PublicChrome";
import { useNow } from "@/hooks/use-station";
import { CATEGORIES, CATEGORY_LABELS, type MediaCategory } from "@/lib/labels";
import { addDays, durationMinutes, formatDate, formatDuration, formatTime, isEngineOnline, isOnAir, toZoned, zonedToUtc } from "@/lib/broadcast";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  q: z.string().optional().catch(undefined),
  cat: z.enum(CATEGORIES as [MediaCategory, ...MediaCategory[]]).optional().catch(undefined),
});

export const Route = createFileRoute("/guide")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "TV Guide — MOVIE MAX TV" },
      { name: "description", content: "The MOVIE MAX TV seven-day TV guide: programme times, descriptions and categories in East Africa Time." },
      { property: "og:title", content: "TV Guide — MOVIE MAX TV" },
      { property: "og:description", content: "Seven-day programme guide for the MOVIE MAX TV channel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(publicStationQuery()),
  component: Guide,
});

const PLURAL: Partial<Record<MediaCategory, string>> = { movie: "Movies", series: "Series", episode: "Episodes", music_video: "Music videos", documentary: "Documentaries", other: "More shows" };

function Guide() {
  const { data } = useSuspenseQuery(publicStationQuery());
  const { q, cat } = Route.useSearch();
  const now = useNow(30000);
  const tz = data.channel?.timezone ?? "Africa/Kampala";
  const onAir = now != null && isOnAir(data.status, now);
  const online = now != null && isEngineOnline(data.status, now);
  const { pick } = useWebPlayout(now);
  const today = toZoned(now ?? trueDate(), tz).date;
  const [day, setDay] = useState<string | null>(null);
  const selected = day ?? today;
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const filtering = !!(q?.trim() || cat);

  const list = useMemo(() => {
    if (filtering) {
      const s = +zonedToUtc(today, "00:00", tz);
      const e = +zonedToUtc(addDays(today, 7), "00:00", tz);
      const needle = q?.trim().toLowerCase() ?? "";
      return data.schedule.filter((p) => +new Date(p.ends_at) > s && +new Date(p.starts_at) < e
        && (!cat || p.category === cat || (cat === "series" && p.category === "episode"))
        && (!needle || p.title.toLowerCase().includes(needle) || (p.description ?? "").toLowerCase().includes(needle)));
    }
    const s = +zonedToUtc(selected, "00:00", tz);
    const e = +zonedToUtc(addDays(selected, 1), "00:00", tz);
    return data.schedule.filter((p) => +new Date(p.ends_at) > s && +new Date(p.starts_at) < e);
  }, [data.schedule, selected, tz, filtering, q, cat, today]);

  const heading = q?.trim() ? `Results for “${q.trim()}”` : cat ? (PLURAL[cat] ?? CATEGORY_LABELS[cat]) : "TV guide";
  const liveId = onAir ? data.status?.current_entry_id ?? null : pick?.entry.id ?? null;

  return (
    <PublicShell onAir={onAir} engineOnline={online} webLive={!onAir && !!pick} description={data.channel?.description}>
      <main className="mx-auto max-w-5xl px-4 pt-4 md:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="badge-hot inline-flex rounded-md px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide">{filtering ? "This week" : "7-day programme guide"}</span>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight md:text-4xl">{heading}</h1>
            <p className="mt-1 text-sm text-muted-foreground">All times East Africa Time (Kampala, UTC+3).</p>
          </div>
          <SearchPill key={q ?? ""} initial={q ?? ""} className="flex w-full sm:w-80" />
        </div>

        {filtering && (
          <div className="mt-5 flex">
            <Link to="/guide" search={{}} className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-border px-3 text-[13px] font-semibold text-muted-foreground hover:text-foreground"><X className="size-3.5" />Clear</Link>
          </div>
        )}

        {!filtering && (
          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
            {days.map((d) => (
              <button key={d} onClick={() => setDay(d)} className={cn("shrink-0 rounded-xl border px-4 py-2 text-left text-sm transition", d === selected ? "neon-ring border-transparent [--ring-fill:var(--panel-raised)]" : "border-border/70 bg-panel text-muted-foreground hover:text-foreground")}>
                <span className="block text-[10px] font-bold uppercase tracking-widest">{d === today ? "Today" : formatDate(zonedToUtc(d, "12:00", tz), tz, { weekday: "short" })}</span>
                <span className="font-semibold tabular-nums">{formatDate(zonedToUtc(d, "12:00", tz), tz, { day: "numeric", month: "short" })}</span>
              </button>
            ))}
          </div>
        )}

        {list.length === 0 && (
          <p className="mt-5 rounded-2xl border border-border/70 bg-panel py-12 text-center text-muted-foreground">
            {filtering ? "Nothing matches in the next 7 days." : "No programmes have been published for this day yet."}
          </p>
        )}
        <div className="mt-5 space-y-3">
          {list.map((p) => <GuideRow key={p.id} p={p} tz={tz} now={now} showDay={filtering} live={liveId === p.id} liveLabel={onAir ? "On air" : "Live"} />)}
        </div>
      </main>
    </PublicShell>
  );
}

function GuideRow({ p, tz, now, showDay, live, liveLabel }: { p: PublicProgramme; tz: string; now: number | null; showDay: boolean; live: boolean; liveLabel: string }) {
  const ended = now != null && +new Date(p.ends_at) < now;
  const series = p.category === "series" || p.category === "episode";
  return (
    <article className={cn("grid grid-cols-[76px_1fr] items-center gap-4 rounded-xl border border-border/70 bg-panel p-3 sm:grid-cols-[88px_176px_1fr]", ended && "opacity-55", live && "neon-ring border-transparent [--ring-fill:var(--panel)]")}>
      <div className="rounded-lg bg-panel-raised px-2 py-2 text-center">
        {showDay && <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{formatDate(p.starts_at, tz, { weekday: "short", day: "numeric" })}</div>}
        <div className="timecode text-lg font-semibold">{formatTime(p.starts_at, tz)}</div>
        <div className="timecode text-xs text-muted-foreground">{formatTime(p.ends_at, tz)}</div>
      </div>
      <div className="relative hidden aspect-video overflow-hidden rounded-lg bg-inset sm:block">
        {p.thumbnail_url ? <img src={p.thumbnail_url} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div className="bg-hot h-full w-full" />}
        <span className={cn("absolute right-1.5 top-1.5 rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase", series ? "bg-neon-pink text-primary-foreground" : "bg-neon-gold text-neon-ink")}>{CATEGORY_LABELS[p.category]}</span>
      </div>
      <div className="min-w-0 pr-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-bold">{p.title}</h2>
          {live && <span className="rounded bg-program px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-program-foreground">{liveLabel}</span>}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">{CATEGORY_LABELS[p.category]} · {formatDuration(durationMinutes(p.starts_at, p.ends_at) * 60)}</div>
        {p.description && <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>}
      </div>
    </article>
  );
}
