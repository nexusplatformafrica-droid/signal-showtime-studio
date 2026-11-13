import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ChevronLeft, ChevronRight, Copy, Plus, Send } from "lucide-react";
import { db } from "@/lib/db";
import { useStation } from "@/components/admin/station-context";
import { useMediaIndex, useScheduleRange, type ScheduleEntry } from "@/hooks/use-schedule";
import { useNow } from "@/hooks/use-station";
import { PageHeader, EmptyState } from "@/components/admin/PageHeader";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { ScheduleEditor, type EditorSeed } from "@/components/schedule/ScheduleEditor";
import { StatusChip } from "@/components/broadcast/status";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { addDays, detectScheduleIssues, formatDate, formatDuration, formatTime, minutesToTime, parseYmd, snapMinutes, startOfWeek, toZoned, weekdayOf, zonedToUtc, durationMinutes, type ScheduleIssue } from "@/lib/broadcast";
import { CATEGORY_LABELS, CATEGORY_TONE } from "@/lib/labels";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/schedule")({ component: SchedulePage });

type View = "day" | "week" | "month" | "list";
const HOUR_PX = 44;
const PX_PER_MIN = HOUR_PX / 60;

function SchedulePage() {
  const { channel, can } = useStation();
  const tz = channel.timezone;
  const qc = useQueryClient();
  const canEdit = can("schedule");
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState(() => toZoned(new Date(), tz).date);
  const [seed, setSeed] = useState<EditorSeed | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [pendingMove, setPendingMove] = useState<{ entry: ScheduleEntry; starts: Date; ends: Date } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const days = useMemo(() => {
    if (view === "day") return [anchor];
    if (view === "week" || view === "list") {
      const s = startOfWeek(anchor);
      return Array.from({ length: 7 }, (_, i) => addDays(s, i));
    }
    const [y, m] = parseYmd(anchor);
    const first = `${y}-${String(m).padStart(2, "0")}-01`;
    const s = startOfWeek(first);
    return Array.from({ length: 42 }, (_, i) => addDays(s, i));
  }, [view, anchor]);
  const firstDay = days[0] ?? anchor;
  const lastDay = days[days.length - 1] ?? anchor;
  const fromIso = zonedToUtc(firstDay, "00:00", tz).toISOString();
  const toIso = zonedToUtc(addDays(lastDay, 1), "00:00", tz).toISOString();

  const { data: entries = [], isLoading } = useScheduleRange(channel.id, fromIso, toIso);
  const mediaIndex = useMediaIndex(entries.map((e) => e.media_id).filter((x): x is string => !!x));
  const issues = useMemo(
    () => detectScheduleIssues(entries, { ...(mediaIndex.data ? { media: mediaIndex.data } : {}), windowStart: fromIso, windowEnd: toIso }),
    [entries, mediaIndex.data, fromIso, toIso],
  );
  const issuesById = useMemo(() => {
    const m = new Map<string, ScheduleIssue[]>();
    for (const i of issues) for (const id of i.entryIds) m.set(id, [...(m.get(id) ?? []), i]);
    return m;
  }, [issues]);
  const drafts = entries.filter((e) => e.status === "draft");
  const errorCount = issues.filter((i) => i.severity === "error").length;

  const refresh = () => qc.invalidateQueries({ queryKey: ["schedule", channel.id] });

  function shift(dir: -1 | 1) {
    if (view === "day") setAnchor((a) => addDays(a, dir));
    else if (view === "month") {
      const [y, m] = parseYmd(anchor);
      const d = new Date(Date.UTC(y, m - 1 + dir, 1));
      setAnchor(d.toISOString().slice(0, 10));
    } else setAnchor((a) => addDays(a, dir * 7));
  }

  async function publish(ids: string[]) {
    if (!ids.length) return;
    const { error } = await db.from("schedule_entries").update({ status: "published", published_at: new Date().toISOString() }).in("id", ids);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${ids.length} programme(s) published`);
    setSelected(new Set());
    refresh();
  }

  async function applyMove(entry: ScheduleEntry, starts: Date, ends: Date) {
    const { error } = await db.from("schedule_entries").update({ starts_at: starts.toISOString(), ends_at: ends.toISOString() }).eq("id", entry.id);
    if (error) toast.error(error.message);
    else toast.success(`Moved "${entry.title}" to ${formatDate(starts, tz)} ${formatTime(starts, tz)}`);
    refresh();
  }

  function requestMove(entry: ScheduleEntry, day: string, minutes: number) {
    const starts = zonedToUtc(day, minutesToTime(minutes), tz);
    const len = +new Date(entry.ends_at) - +new Date(entry.starts_at);
    const ends = new Date(starts.getTime() + len);
    if (+starts === +new Date(entry.starts_at)) return;
    if (entry.status === "published") setPendingMove({ entry, starts, ends });
    else void applyMove(entry, starts, ends);
  }

  const title =
    view === "day" ? formatDate(zonedToUtc(anchor, "12:00", tz), tz, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : view === "month" ? formatDate(zonedToUtc(anchor, "12:00", tz), tz, { month: "long", year: "numeric" })
    : `${formatDate(zonedToUtc(firstDay, "12:00", tz), tz, { day: "numeric", month: "short" })} – ${formatDate(zonedToUtc(lastDay, "12:00", tz), tz, { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Schedule" description={`Station time: ${tz}`} actions={
        <>
          <div className="flex rounded-sm border border-border">
            {(["day", "week", "month", "list"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className={cn("h-7 px-2.5 text-xs capitalize", view === v ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}>{v}</button>
            ))}
          </div>
          <Button size="icon-sm" variant="panel" onClick={() => shift(-1)} aria-label="Previous"><ChevronLeft /></Button>
          <Button size="xs" variant="panel" onClick={() => setAnchor(toZoned(new Date(), tz).date)}>Today</Button>
          <Button size="icon-sm" variant="panel" onClick={() => shift(1)} aria-label="Next"><ChevronRight /></Button>
          <input type="date" className="field h-7 w-36" value={anchor} onChange={(e) => e.target.value && setAnchor(e.target.value)} aria-label="Go to date" />
          <span className="mx-1 h-5 w-px bg-border" />
          <Button size="xs" variant="panel" disabled={!canEdit} onClick={() => setCopyOpen(true)}><Copy />Copy</Button>
          <ConfirmButton size="xs" variant="brand" disabled={!canEdit || drafts.length === 0} title={`Publish ${drafts.length} draft programme(s)?`} confirmLabel="Publish"
            description={<>Published programmes appear in the public TV guide and are executed by the playout engine.{errorCount > 0 && <span className="mt-2 block text-program">{errorCount} schedule error(s) detected in this period — check the warnings panel before publishing.</span>}</>}
            onConfirm={() => publish(drafts.map((d) => d.id))}>
            <Send />Publish {drafts.length > 0 ? `(${drafts.length})` : ""}
          </ConfirmButton>
          <Button size="xs" variant="program" disabled={!canEdit} onClick={() => setSeed({ date: anchor, time: "20:00" })}><Plus />New programme</Button>
        </>
      }>
        <div className="flex items-center gap-3 border-t border-border px-4 py-1 text-xs">
          <span className="font-display font-bold uppercase tracking-wide">{title}</span>
          <span className="text-muted-foreground">{entries.filter((e) => e.status !== "cancelled").length} programmes · {drafts.length} drafts</span>
          {issues.length > 0 && <span className="flex items-center gap-1 text-warn"><AlertTriangle className="size-3.5" />{issues.length} warnings</span>}
        </div>
      </PageHeader>

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-auto">
          {(view === "day" || view === "week") && (
            <Timeline days={days} entries={entries} tz={tz} issuesById={issuesById} canEdit={canEdit}
              onCreate={(day, minutes) => setSeed({ date: day, time: minutesToTime(minutes) })}
              onOpen={(e) => setSeed({ entry: e })} onMove={requestMove} />
          )}
          {view === "month" && <MonthView days={days} anchor={anchor} entries={entries} tz={tz} issuesById={issuesById} onPick={(d) => { setAnchor(d); setView("day"); }} />}
          {view === "list" && (
            <ListView entries={entries} tz={tz} issuesById={issuesById} selected={selected} setSelected={setSelected} onOpen={(e) => setSeed({ entry: e })} canEdit={canEdit}
              onPublish={() => publish([...selected])}
              onCancel={async () => { await db.from("schedule_entries").update({ status: "cancelled" }).in("id", [...selected]); setSelected(new Set()); refresh(); }} />
          )}
          {isLoading && <EmptyState title="Loading schedule…" />}
        </div>
        <aside className="hidden w-72 shrink-0 overflow-y-auto border-l border-border xl:block">
          <div className="panel-header sticky top-0 bg-panel">Conflicts &amp; warnings<span>{issues.length}</span></div>
          {issues.length === 0 && <EmptyState title="No issues in this period" />}
          {issues.map((i, idx) => (
            <button key={idx} onClick={() => { const e = entries.find((x) => x.id === i.entryIds[i.entryIds.length - 1]); if (e) setSeed({ entry: e }); }} className="flex w-full gap-2 border-b border-border/60 px-3 py-2 text-left text-xs hover:bg-accent">
              <AlertTriangle className={cn("mt-0.5 size-3.5 shrink-0", i.severity === "error" ? "text-program" : "text-warn")} />
              <span className="min-w-0"><span className="timecode block text-[10px] text-muted-foreground">{formatDate(i.at, tz)} {formatTime(i.at, tz)}</span>{i.message}</span>
            </button>
          ))}
        </aside>
      </div>

      <ScheduleEditor seed={seed} onClose={() => setSeed(null)} />
      <CopyDialog open={copyOpen} onOpenChange={setCopyOpen} anchor={anchor} onDone={refresh} />
      <AlertDialog open={!!pendingMove} onOpenChange={(o) => !o && setPendingMove(null)}>
        <AlertDialogContent className="border-border bg-popover">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display uppercase tracking-wide">Move published programme?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingMove && <>"{pendingMove.entry.title}" will move to {formatDate(pendingMove.starts, tz)} {formatTime(pendingMove.starts, tz)}. The change is live in the TV guide and playout engine immediately.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (pendingMove) void applyMove(pendingMove.entry, pendingMove.starts, pendingMove.ends); setPendingMove(null); }}>Move</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Timeline({ days, entries, tz, issuesById, canEdit, onCreate, onOpen, onMove }: {
  days: string[]; entries: ScheduleEntry[]; tz: string; issuesById: Map<string, ScheduleIssue[]>; canEdit: boolean;
  onCreate: (day: string, minutes: number) => void; onOpen: (e: ScheduleEntry) => void; onMove: (e: ScheduleEntry, day: string, minutes: number) => void;
}) {
  const now = useNow(30000);
  const scrollRef = useRef<HTMLDivElement>(null);
  const today = now ? toZoned(now, tz) : null;
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = Math.max(0, ((today?.minutes ?? 18 * 60) - 120) * PX_PER_MIN);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days.length]);

  const minutesFromEvent = (e: React.DragEvent | React.MouseEvent, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    return (e.clientY - rect.top) / PX_PER_MIN;
  };

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto">
      <div className="sticky top-0 z-[5] grid border-b border-border bg-panel" style={{ gridTemplateColumns: `52px repeat(${days.length}, minmax(120px, 1fr))` }}>
        <div />
        {days.map((d) => (
          <div key={d} className={cn("border-l border-border px-2 py-1.5 text-xs", today?.date === d && "text-program")}>
            <span className="label-caps mr-1.5">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][weekdayOf(d)]}</span>
            <span className="timecode font-semibold">{d.slice(8)}</span>
          </div>
        ))}
      </div>
      <div className="grid" style={{ gridTemplateColumns: `52px repeat(${days.length}, minmax(120px, 1fr))` }}>
        <div className="relative" style={{ height: 24 * HOUR_PX }}>
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="timecode absolute right-1.5 -translate-y-1/2 text-[10px] text-muted-foreground" style={{ top: h * HOUR_PX }}>{h > 0 ? `${String(h).padStart(2, "0")}:00` : ""}</div>
          ))}
        </div>
        {days.map((day) => {
          const dayStart = +zonedToUtc(day, "00:00", tz);
          const dayEnd = +zonedToUtc(addDays(day, 1), "00:00", tz);
          const blocks = entries.filter((e) => +new Date(e.ends_at) > dayStart && +new Date(e.starts_at) < dayEnd);
          return (
            <div
              key={day}
              className="relative border-l border-border"
              style={{ height: 24 * HOUR_PX, backgroundImage: `repeating-linear-gradient(to bottom, var(--border) 0 1px, transparent 1px ${HOUR_PX}px)` }}
              onDoubleClick={(e) => { if (canEdit && e.target === e.currentTarget) onCreate(day, snapMinutes(minutesFromEvent(e, e.currentTarget), 30)); }}
              onDragOver={(e) => { if (canEdit) e.preventDefault(); }}
              onDrop={(e) => {
                e.preventDefault();
                try {
                  const data = JSON.parse(e.dataTransfer.getData("text/plain")) as { id: string; offset: number };
                  const entry = entries.find((x) => x.id === data.id);
                  if (entry) onMove(entry, day, snapMinutes(minutesFromEvent(e, e.currentTarget) - data.offset));
                } catch { /* not a schedule block */ }
              }}
            >
              {today?.date === day && <div className="pointer-events-none absolute inset-x-0 z-[3] h-px bg-program" style={{ top: today.minutes * PX_PER_MIN }}><span className="absolute -left-1 -top-1 size-2 rounded-full bg-program" /></div>}
              {blocks.map((e) => {
                const s = Math.max(+new Date(e.starts_at), dayStart);
                const en = Math.min(+new Date(e.ends_at), dayEnd);
                const top = ((s - dayStart) / 60000) * PX_PER_MIN;
                const height = Math.max(14, ((en - s) / 60000) * PX_PER_MIN - 1);
                const bad = issuesById.get(e.id)?.some((i) => i.severity === "error");
                return (
                  <button
                    key={e.id}
                    draggable={canEdit}
                    onDragStart={(ev) => ev.dataTransfer.setData("text/plain", JSON.stringify({ id: e.id, offset: (ev.clientY - ev.currentTarget.getBoundingClientRect().top) / PX_PER_MIN + (s - +new Date(e.starts_at)) / 60000 }))}
                    onClick={() => onOpen(e)}
                    title={`${e.title} · ${formatTime(e.starts_at, tz)}–${formatTime(e.ends_at, tz)}`}
                    className={cn(
                      "absolute inset-x-0.5 z-[2] overflow-hidden rounded-[2px] border border-l-[3px] px-1.5 py-0.5 text-left text-[11px] leading-tight",
                      CATEGORY_TONE[e.category] ?? "border-l-muted-foreground",
                      e.status === "published" && "border-border bg-panel-raised",
                      e.status === "draft" && "border-dashed border-warn/60 bg-warn/5",
                      e.status === "cancelled" && "border-border bg-inset text-muted-foreground line-through opacity-60",
                      bad && "ring-1 ring-program",
                    )}
                    style={{ top, height }}
                  >
                    <span className="timecode mr-1 text-muted-foreground">{formatTime(e.starts_at, tz)}</span>
                    <span className="font-medium">{e.title}</span>
                    {height > 30 && <span className="block truncate text-[10px] text-muted-foreground">{CATEGORY_LABELS[e.category]} · {e.mode.replace("_", " ")}{e.status === "draft" ? " · draft" : ""}</span>}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
      <div className="px-3 py-2 text-[11px] text-muted-foreground">Double-click an empty slot to add a programme · drag blocks to move them (5-minute snap).</div>
    </div>
  );
}

function MonthView({ days, anchor, entries, tz, issuesById, onPick }: { days: string[]; anchor: string; entries: ScheduleEntry[]; tz: string; issuesById: Map<string, ScheduleIssue[]>; onPick: (d: string) => void }) {
  const month = anchor.slice(0, 7);
  const today = toZoned(new Date(), tz).date;
  return (
    <div className="grid grid-cols-7 gap-px bg-border p-px">
      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="label-caps bg-panel px-2 py-1">{d}</div>)}
      {days.map((d) => {
        const list = entries.filter((e) => e.status !== "cancelled" && toZoned(e.starts_at, tz).date === d);
        const mins = list.reduce((a, e) => a + durationMinutes(e.starts_at, e.ends_at), 0);
        const drafts = list.filter((e) => e.status === "draft").length;
        const errs = list.filter((e) => issuesById.get(e.id)?.some((i) => i.severity === "error")).length;
        return (
          <button key={d} onClick={() => onPick(d)} className={cn("min-h-24 bg-background p-1.5 text-left hover:bg-accent", d.slice(0, 7) !== month && "opacity-40")}>
            <div className={cn("timecode text-xs font-semibold", d === today && "text-program")}>{Number(d.slice(8))}</div>
            {list.length > 0 && (
              <div className="mt-1 space-y-0.5 text-[10px]">
                <div>{list.length} programmes</div>
                <div className="h-1 overflow-hidden rounded-full bg-inset"><div className="h-full bg-preview" style={{ width: `${Math.min(100, (mins / 1440) * 100)}%` }} /></div>
                <div className="text-muted-foreground">{formatDuration(mins * 60)} scheduled</div>
                {drafts > 0 && <div className="text-warn">{drafts} draft</div>}
                {errs > 0 && <div className="text-program">{errs} with errors</div>}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function ListView({ entries, tz, issuesById, selected, setSelected, onOpen, canEdit, onPublish, onCancel }: {
  entries: ScheduleEntry[]; tz: string; issuesById: Map<string, ScheduleIssue[]>; selected: Set<string>; setSelected: (s: Set<string>) => void;
  onOpen: (e: ScheduleEntry) => void; canEdit: boolean; onPublish: () => void; onCancel: () => void;
}) {
  return (
    <div>
      {selected.size > 0 && (
        <div className="flex items-center gap-1.5 border-b border-border bg-panel px-3 py-1.5 text-xs">
          <span className="font-semibold">{selected.size} selected</span>
          <ConfirmButton size="xs" variant="brand" disabled={!canEdit} title="Publish selected programmes?" description="They will appear in the TV guide and be executed by the playout engine." confirmLabel="Publish" onConfirm={onPublish}>Publish</ConfirmButton>
          <ConfirmButton size="xs" variant="panel" disabled={!canEdit} title="Cancel selected programmes?" description="Cancelled programmes are removed from the guide and playout." confirmLabel="Cancel programmes" destructive onConfirm={onCancel}>Cancel</ConfirmButton>
        </div>
      )}
      <table className="data-table w-full">
        <thead><tr>
          <th className="w-8"><Checkbox checked={entries.length > 0 && entries.every((e) => selected.has(e.id))} onCheckedChange={(c) => setSelected(c ? new Set(entries.map((e) => e.id)) : new Set())} aria-label="Select all" /></th>
          <th className="w-28">Date</th><th className="w-24">Time</th><th className="w-20">Length</th><th>Programme</th><th className="w-28">Mode</th><th className="w-24">Status</th><th className="w-48">Issues</th>
        </tr></thead>
        <tbody>
          {entries.map((e) => {
            const iss = issuesById.get(e.id) ?? [];
            return (
              <tr key={e.id} className="cursor-pointer" onClick={() => onOpen(e)}>
                <td onClick={(ev) => ev.stopPropagation()}><Checkbox checked={selected.has(e.id)} onCheckedChange={(c) => { const n = new Set(selected); if (c) n.add(e.id); else n.delete(e.id); setSelected(n); }} aria-label={`Select ${e.title}`} /></td>
                <td className="text-muted-foreground">{formatDate(e.starts_at, tz)}</td>
                <td className="timecode">{formatTime(e.starts_at, tz)}–{formatTime(e.ends_at, tz)}</td>
                <td className="timecode text-muted-foreground">{formatDuration(durationMinutes(e.starts_at, e.ends_at) * 60)}</td>
                <td className="max-w-0"><div className={cn("truncate font-medium", e.status === "cancelled" && "line-through")}>{e.title}</div><div className="text-[11px] text-muted-foreground">{CATEGORY_LABELS[e.category]}{e.is_commercial_break ? " · commercial" : ""}</div></td>
                <td className="text-muted-foreground">{e.mode.replace("_", " ")}</td>
                <td><StatusChip tone={e.status === "published" ? "preview" : e.status === "draft" ? "warn" : "off"}>{e.status}</StatusChip></td>
                <td className="max-w-0 truncate text-[11px] text-warn">{iss.map((i) => i.kind.replace("_", " ")).join(", ")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {entries.length === 0 && <EmptyState title="Nothing scheduled this week" />}
    </div>
  );
}

function CopyDialog({ open, onOpenChange, anchor, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; anchor: string; onDone: () => void }) {
  const { channel, user } = useStation();
  const tz = channel.timezone;
  const [mode, setMode] = useState<"day" | "week">("day");
  const [source, setSource] = useState(anchor);
  const [target, setTarget] = useState(addDays(anchor, 1));
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setSource(anchor);
      setTarget(addDays(anchor, mode === "day" ? 1 : 7));
    }
  }, [open, anchor, mode]);

  async function run() {
    setBusy(true);
    try {
      const srcStart = mode === "day" ? source : startOfWeek(source);
      const tgtStart = mode === "day" ? target : startOfWeek(target);
      const len = mode === "day" ? 1 : 7;
      const from = zonedToUtc(srcStart, "00:00", tz);
      const to = zonedToUtc(addDays(srcStart, len), "00:00", tz);
      const shiftMs = +zonedToUtc(tgtStart, "00:00", tz) - +from;
      if (shiftMs === 0) throw new Error("Source and target are the same");
      const { data, error } = await db.from("schedule_entries").select("*").eq("channel_id", channel.id).neq("status", "cancelled").gte("starts_at", from.toISOString()).lt("starts_at", to.toISOString());
      if (error) throw error;
      if (!data?.length) throw new Error("Nothing to copy in the source period");
      const rows = data.map((e) => ({
        channel_id: e.channel_id, title: e.title, description: e.description, category: e.category, thumbnail_url: e.thumbnail_url, mode: e.mode,
        media_id: e.media_id, playlist_id: e.playlist_id, priority: e.priority, notes: e.notes, is_commercial_break: e.is_commercial_break,
        starts_at: new Date(+new Date(e.starts_at) + shiftMs).toISOString(), ends_at: new Date(+new Date(e.ends_at) + shiftMs).toISOString(),
        status: "draft" as const, created_by: user.id,
      }));
      const { error: ie } = await db.from("schedule_entries").insert(rows);
      if (ie) throw ie;
      toast.success(`${rows.length} programmes copied as drafts`);
      onDone();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Copy failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm border-border bg-panel">
        <DialogHeader><DialogTitle className="font-display uppercase tracking-wide">Copy schedule</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="flex gap-1">{(["day", "week"] as const).map((m) => <button key={m} onClick={() => setMode(m)} className={cn("h-7 flex-1 rounded-sm border text-xs capitalize", mode === m ? "border-preview bg-preview/15 text-preview" : "border-border")}>Copy a {m}</button>)}</div>
          <label className="block space-y-1"><span className="label-caps">{mode === "day" ? "Source day" : "Any day in source week"}</span><input type="date" className="field" value={source} onChange={(e) => setSource(e.target.value)} /></label>
          <label className="block space-y-1"><span className="label-caps">{mode === "day" ? "Target day" : "Any day in target week"}</span><input type="date" className="field" value={target} onChange={(e) => setTarget(e.target.value)} /></label>
          <p className="text-xs text-muted-foreground">Copies are created as drafts so you can review conflicts before publishing.</p>
          <Button variant="brand" size="sm" className="w-full" disabled={busy} onClick={run}>Copy</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
