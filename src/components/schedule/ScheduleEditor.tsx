import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { db } from "@/lib/db";
import type { Json } from "@/lib/db-types";
import { useStation } from "@/components/admin/station-context";
import type { ScheduleEntry } from "@/hooks/use-schedule";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { MediaPicker, type PickedMedia } from "@/components/schedule/MediaPicker";
import { CATEGORIES, CATEGORY_LABELS, type MediaCategory } from "@/lib/labels";
import { detectScheduleIssues, endFromDuration, expandRecurrence, formatDuration, minutesToTime, nextWholeSecond, playlistTotals, scheduleTail, toZoned, zonedToUtc, type RecurrenceRule } from "@/lib/broadcast";
import { trueDate, trueNow } from "@/lib/clock";
import { cn } from "@/lib/utils";

export interface EditorSeed {
  entry?: ScheduleEntry;
  date?: string;
  time?: string;
}

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** How the start time is chosen: typed in, right now, or straight after the last programme. */
type StartMode = "manual" | "now" | "after_last";
const START_MODES: { id: StartMode; label: string }[] = [
  { id: "after_last", label: "After last programme" },
  { id: "now", label: "Start now" },
  { id: "manual", label: "Pick a time" },
];

export function ScheduleEditor({ seed, onClose }: { seed: EditorSeed | null; onClose: () => void }) {
  const { channel, user, can } = useStation();
  const tz = channel.timezone;
  const qc = useQueryClient();
  const canEdit = can("schedule");
  const entry = seed?.entry;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<MediaCategory>("movie");
  const [mode, setMode] = useState<ScheduleEntry["mode"]>("fixed");
  const [sourceKind, setSourceKind] = useState<"media" | "playlist">("media");
  const [media, setMedia] = useState<PickedMedia | null>(null);
  const [playlistId, setPlaylistId] = useState<string>("");
  const [thumb, setThumb] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [start, setStart] = useState("20:00");
  const [end, setEnd] = useState("21:00");
  const [endDate, setEndDate] = useState("");
  const [priority, setPriority] = useState(0);
  const [notes, setNotes] = useState("");
  const [commercial, setCommercial] = useState(false);
  const [freq, setFreq] = useState<RecurrenceRule["freq"]>("none");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [until, setUntil] = useState("");
  const [busy, setBusy] = useState(false);
  const [startMode, setStartMode] = useState<StartMode>("manual");
  const [autoEnd, setAutoEnd] = useState(true);
  const [afterTitle, setAfterTitle] = useState<string | null>(null);

  useEffect(() => {
    if (!seed) return;
    if (entry) {
      const s = toZoned(entry.starts_at, tz);
      const e = toZoned(entry.ends_at, tz);
      setTitle(entry.title); setDescription(entry.description ?? ""); setCategory(entry.category); setMode(entry.mode);
      setSourceKind(entry.playlist_id ? "playlist" : "media"); setPlaylistId(entry.playlist_id ?? ""); setThumb(entry.thumbnail_url);
      setDate(s.date); setStart(s.timeSec); setEnd(e.timeSec); setEndDate(e.date); setStartMode("manual"); setAutoEnd(false); setPriority(entry.priority); setNotes(entry.notes ?? "");
      setCommercial(entry.is_commercial_break); setFreq("none");
      setMedia(null);
      if (entry.media_id) db.from("media_assets").select("id, title, category, duration_seconds, thumbnail_url, status, available, description").eq("id", entry.media_id).maybeSingle().then(({ data }) => setMedia(data ?? null));
    } else {
      const d = seed.date ?? toZoned(trueDate(), tz).date;
      setStartMode(seed.time ? "manual" : "after_last"); setAutoEnd(true); setAfterTitle(null);
      setTitle(""); setDescription(""); setCategory("movie"); setMode("fixed"); setSourceKind("media"); setMedia(null); setPlaylistId(""); setThumb(null);
      setDate(d); setStart(seed.time ?? "20:00");
      const [h = 20, m = 0] = (seed.time ?? "20:00").split(":").map(Number);
      setEnd(minutesToTime(Math.min(h * 60 + m + 60, 23 * 60 + 59))); setEndDate(d);
      setPriority(0); setNotes(""); setCommercial(false); setFreq("none"); setWeekdays([]); setUntil("");
    }
  }, [seed, entry, tz]);

  const playlists = useQuery({
    queryKey: ["playlists-lite", channel.id],
    enabled: !!seed,
    queryFn: async () => (await db.from("playlists").select("id, name, kind").eq("channel_id", channel.id).order("name")).data ?? [],
  });

  // Real length of what will play: the video's own duration, or the playlist's total.
  const playlistLength = useQuery({
    queryKey: ["playlist-length", playlistId],
    enabled: !!seed && sourceKind === "playlist" && !!playlistId,
    queryFn: async () => {
      const { data: items } = await db.from("playlist_items").select("media_id").eq("playlist_id", playlistId);
      const ids = [...new Set((items ?? []).map((i) => i.media_id))];
      if (!ids.length) return { totalSeconds: 0, unknown: 0, count: 0 };
      const { data: rows } = await db.from("media_assets").select("id, duration_seconds").in("id", ids);
      const dur = new Map((rows ?? []).map((r) => [r.id, r.duration_seconds == null ? null : Number(r.duration_seconds)]));
      const t = playlistTotals((items ?? []).map((i) => ({ duration_seconds: dur.get(i.media_id) ?? null })));
      return { totalSeconds: t.totalSeconds, unknown: t.unknown, count: items?.length ?? 0 };
    },
  });
  const lengthSeconds: number | null =
    sourceKind === "media"
      ? media?.duration_seconds ? Number(media.duration_seconds) : null
      : playlistLength.data && playlistLength.data.totalSeconds > 0 && playlistLength.data.unknown === 0 ? playlistLength.data.totalSeconds : null;
  const useAutoEnd = autoEnd && lengthSeconds != null && lengthSeconds > 0;

  const startsAt = date && start ? zonedToUtc(date, start, tz) : null;
  // If end time is earlier than start, it runs past midnight.
  const endsAt = useMemo(() => {
    if (!startsAt) return null;
    if (useAutoEnd) return endFromDuration(startsAt, lengthSeconds!);
    if (!end) return null;
    let e = zonedToUtc(endDate || date, end, tz);
    if (e <= startsAt) e = zonedToUtc(addDay(endDate || date), end, tz);
    return e;
  }, [startsAt, useAutoEnd, lengthSeconds, end, endDate, date, tz]);
  const secs = startsAt && endsAt ? Math.round((endsAt.getTime() - startsAt.getTime()) / 1000) : 0;

  // Keep the End boxes showing the automatic end time.
  useEffect(() => {
    if (!useAutoEnd || !endsAt) return;
    const z = toZoned(endsAt, tz);
    setEnd(z.timeSec);
    setEndDate(z.date);
  }, [useAutoEnd, endsAt, tz]);

  /** Work out the start for "Start now" / "After last programme" from the real (online) time. */
  async function resolveStart(m: StartMode): Promise<Date | null> {
    if (m === "manual") return startsAt;
    if (m === "now") { setAfterTitle(null); return nextWholeSecond(trueNow()); }
    const now = trueNow();
    const { data } = await db.from("schedule_entries").select("id, title, starts_at, ends_at, status").eq("channel_id", channel.id).gt("ends_at", new Date(now).toISOString());
    const tail = scheduleTail(data ?? [], now, entry?.id);
    setAfterTitle(tail.after?.title ?? null);
    return tail.at;
  }
  function applyStart(at: Date) {
    const z = toZoned(at, tz);
    setDate(z.date);
    setStart(z.timeSec);
    if (!useAutoEnd) {
      // Keep the same length when the start moves.
      const len = secs > 0 ? secs : 3600;
      const e = toZoned(new Date(at.getTime() + len * 1000), tz);
      setEnd(e.timeSec);
      setEndDate(e.date);
    }
  }
  async function chooseStart(m: StartMode) {
    setStartMode(m);
    if (m === "manual") return;
    const at = await resolveStart(m);
    if (at) applyStart(at);
  }
  // Fill in the automatic start as soon as a new programme opens.
  useEffect(() => {
    if (!seed || entry || seed.time) return;
    void chooseStart("after_last");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  // Conflict preview against what is already in the schedule
  const conflicts = useQuery({
    queryKey: ["schedule-conflicts", channel.id, startsAt?.toISOString(), endsAt?.toISOString(), entry?.id],
    enabled: !!startsAt && !!endsAt && !!seed,
    queryFn: async () => {
      const { data } = await db.from("schedule_entries").select("id, title, starts_at, ends_at, status").eq("channel_id", channel.id).neq("status", "cancelled").lt("starts_at", endsAt!.toISOString()).gt("ends_at", startsAt!.toISOString());
      return (data ?? []).filter((d) => d.id !== entry?.id);
    },
  });
  const warnings = useMemo(() => {
    if (!startsAt || !endsAt) return [];
    const self = { id: entry?.id ?? "new", title: title || "This programme", starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), status: "published" as const, mode, media_id: sourceKind === "media" ? media?.id ?? null : null, playlist_id: sourceKind === "playlist" ? playlistId || null : null };
    const map = media ? new Map([[media.id, { status: media.status, available: media.available, duration_seconds: media.duration_seconds == null ? null : Number(media.duration_seconds) }]]) : undefined;
    const others = (conflicts.data ?? []).map((c) => ({ ...c, status: "published" as const, media_id: "x", playlist_id: null }));
    return detectScheduleIssues([self, ...others], { media: map ? new Map([...map, ["x", { status: "ready", available: true, duration_seconds: null }]]) : new Map([["x", { status: "ready", available: true, duration_seconds: null }]]) })
      .filter((i) => i.entryIds.includes(self.id) && i.kind !== "gap" && i.kind !== "unpublished");
  }, [startsAt, endsAt, conflicts.data, media, mode, sourceKind, playlistId, title, entry?.id]);

  function pickMedia(m: PickedMedia) {
    setMedia(m);
    if (!title || title === media?.title) setTitle(m.title);
    if (!description && m.description) setDescription(m.description);
    setCategory(m.category);
    setThumb(m.thumbnail_url);
    if (m.category === "advertisement") setCommercial(true);
    if (m.duration_seconds) setAutoEnd(true);
  }

  async function save(publish: boolean) {
    if (!startsAt || !endsAt || secs <= 0) { toast.error("Check the start and end times"); return; }
    if (!title.trim()) { toast.error("Programme title is required"); return; }
    setBusy(true);
    try {
      // "Start now" / "After last programme" are worked out again at the moment of saving.
      let s0 = startsAt;
      let e0 = endsAt;
      if (startMode !== "manual") {
        const at = await resolveStart(startMode);
        if (at) { s0 = at; e0 = useAutoEnd ? endFromDuration(at, lengthSeconds!) : new Date(at.getTime() + secs * 1000); }
      }
      const startsIso = s0.toISOString();
      const endsIso = e0.toISOString();
      const z0 = toZoned(s0, tz);
      const base = {
        channel_id: channel.id, title: title.trim(), description: description || null, category, mode,
        media_id: sourceKind === "media" ? media?.id ?? null : null,
        playlist_id: sourceKind === "playlist" ? playlistId || null : null,
        thumbnail_url: thumb, priority, notes: notes || null, is_commercial_break: commercial,
        status: publish ? ("published" as const) : entry?.status === "cancelled" ? ("draft" as const) : publish === false && entry ? entry.status : ("draft" as const),
        published_at: publish ? trueDate().toISOString() : entry?.published_at ?? null,
      };
      if (entry) {
        const { error } = await db.from("schedule_entries").update({ ...base, starts_at: startsIso, ends_at: endsIso }).eq("id", entry.id);
        if (error) throw error;
        toast.success(publish ? "Saved and published" : "Saved");
      } else if (freq === "none") {
        const { error } = await db.from("schedule_entries").insert({ ...base, starts_at: startsIso, ends_at: endsIso, created_by: user.id });
        if (error) throw error;
        toast.success(publish ? "Programme scheduled and published" : "Programme saved as draft");
      } else {
        if (!until) throw new Error("Choose an end date for the recurrence");
        if (freq === "weekdays" && weekdays.length === 0) throw new Error("Pick at least one weekday");
        const rule: RecurrenceRule = { freq, weekdays, startDate: z0.date, endDate: until, startTime: z0.timeSec, durationMinutes: secs / 60 };
        const occ = expandRecurrence(rule, tz);
        if (!occ.length) throw new Error("The recurrence produces no programmes");
        const { data: rec, error: re } = await db.from("recurring_schedules").insert({ channel_id: channel.id, rule: rule as unknown as Json, created_by: user.id }).select("id").single();
        if (re || !rec) throw re ?? new Error("Could not save recurrence");
        const rows = occ.map((o) => ({ ...base, starts_at: o.starts_at.toISOString(), ends_at: o.ends_at.toISOString(), recurrence_id: rec.id, created_by: user.id }));
        for (let i = 0; i < rows.length; i += 200) {
          const { error } = await db.from("schedule_entries").insert(rows.slice(i, i + 200));
          if (error) throw error;
        }
        toast.success(`${rows.length} programmes created`);
      }
      qc.invalidateQueries({ queryKey: ["schedule", channel.id] });
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: ScheduleEntry["status"]) {
    if (!entry) return;
    const { error } = await db.from("schedule_entries").update({ status }).eq("id", entry.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["schedule", channel.id] });
    onClose();
  }
  async function remove(series: boolean) {
    if (!entry) return;
    const q = series && entry.recurrence_id
      ? db.from("schedule_entries").delete().eq("recurrence_id", entry.recurrence_id).gte("starts_at", entry.starts_at)
      : db.from("schedule_entries").delete().eq("id", entry.id);
    const { error } = await q;
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["schedule", channel.id] });
    onClose();
  }

  const isPublished = entry?.status === "published";

  return (
    <Sheet open={!!seed} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[460px] overflow-y-auto border-border bg-panel sm:max-w-[460px]">
        <SheetHeader><SheetTitle className="font-display uppercase tracking-wide">{entry ? "Edit programme" : "New programme"}</SheetTitle></SheetHeader>
        <fieldset disabled={!canEdit} className="mt-3 space-y-3 text-sm">
          {isPublished && <div className="rounded-sm border border-warn/40 bg-warn/10 px-2 py-1.5 text-xs text-warn">This programme is published. Saved changes are picked up by the playout engine on its next schedule refresh.</div>}
          <div className="flex gap-1">
            {(["media", "playlist"] as const).map((k) => (
              <button key={k} type="button" onClick={() => setSourceKind(k)} className={cn("h-7 flex-1 rounded-sm border text-xs", sourceKind === k ? "border-preview bg-preview/15 text-preview" : "border-border bg-inset text-muted-foreground")}>{k === "media" ? "Single media" : "Playlist"}</button>
            ))}
          </div>
          {sourceKind === "media" ? (
            <div className="space-y-1">
              <span className="label-caps">Media</span>
              {media ? (
                <div className="flex items-center gap-2 rounded-sm border border-border bg-inset p-1.5 text-xs">
                  {media.thumbnail_url && <img src={media.thumbnail_url} alt="" className="h-8 w-14 rounded-[2px] object-cover" />}
                  <div className="min-w-0 flex-1"><div className="truncate">{media.title}</div><div className="timecode text-muted-foreground">{formatDuration(media.duration_seconds == null ? null : Number(media.duration_seconds))} · {media.status}</div></div>
                  <button type="button" onClick={() => setMedia(null)} aria-label="Remove media"><X className="size-3.5" /></button>
                </div>
              ) : <MediaPicker channelId={channel.id} onPick={pickMedia} />}
            </div>
          ) : (
            <label className="block space-y-1"><span className="label-caps">Playlist</span>
              <select className="field" value={playlistId} onChange={(e) => setPlaylistId(e.target.value)}><option value="">Choose playlist…</option>{playlists.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            </label>
          )}
          <label className="block space-y-1"><span className="label-caps">Programme title</span><input className="field" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} /></label>
          <label className="block space-y-1"><span className="label-caps">Description (shown in TV guide)</span><textarea className="field" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block space-y-1"><span className="label-caps">Category</span><select className="field" value={category} onChange={(e) => setCategory(e.target.value as MediaCategory)}>{CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}</select></label>
            <label className="block space-y-1"><span className="label-caps">Mode</span>
              <select className="field" value={mode} onChange={(e) => setMode(e.target.value as ScheduleEntry["mode"])}>
                <option value="fixed">Fixed time</option><option value="follow_on">Follow-on</option><option value="flexible_playlist">Flexible playlist</option>
              </select>
            </label>
          </div>
          <div className="space-y-1">
            <span className="label-caps">Start time</span>
            <div className="flex gap-1">
              {START_MODES.map((o) => (
                <button key={o.id} type="button" onClick={() => void chooseStart(o.id)} className={cn("h-7 flex-1 rounded-sm border text-[11px]", startMode === o.id ? "border-preview bg-preview/15 text-preview" : "border-border bg-inset text-muted-foreground")}>{o.label}</button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {startMode === "after_last" && (afterTitle ? <>Starts the moment “{afterTitle}” ends.</> : <>Nothing else is coming up, so it starts right away.</>)}
              {startMode === "now" && <>Starts right now (real online time). The exact second is taken again when you save.</>}
              {startMode === "manual" && <>Type the date and start time yourself.</>}
            </p>
          </div>
          <div className="grid grid-cols-[1.2fr_1fr_1fr] gap-2">
            <label className="block space-y-1"><span className="label-caps">Date ({tz.split("/")[1]})</span><input type="date" className="field" value={date} disabled={startMode !== "manual"} onChange={(e) => { setDate(e.target.value); setEndDate(e.target.value); }} /></label>
            <label className="block space-y-1"><span className="label-caps">Start</span><input type="time" step={1} className="field timecode" value={start} disabled={startMode !== "manual"} onChange={(e) => setStart(e.target.value)} /></label>
            <label className="block space-y-1"><span className="label-caps">End</span><input type="time" step={1} className="field timecode" value={end} disabled={useAutoEnd} onChange={(e) => { setEnd(e.target.value); setEndDate(date); }} /></label>
          </div>
          <label className="flex items-start gap-2 text-xs">
            <input type="checkbox" className="mt-0.5" checked={autoEnd} onChange={(e) => setAutoEnd(e.target.checked)} />
            <span>
              End automatically by the real {sourceKind === "playlist" ? "playlist" : "video"} length
              {lengthSeconds != null && lengthSeconds > 0 && <span className="timecode text-foreground"> ({formatDuration(lengthSeconds)})</span>}
              {autoEnd && lengthSeconds == null && (
                <span className="block text-warn">
                  {sourceKind === "media" ? (media ? "This video's length isn't known yet — set the end time yourself." : "Choose a video first.") : playlistLength.data?.unknown ? `${playlistLength.data.unknown} item(s) in this playlist have no known length — set the end time yourself.` : "Choose a playlist with videos first."}
                </span>
              )}
            </span>
          </label>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Duration <span className="timecode text-foreground">{secs > 0 ? formatDuration(secs) : "—"}</span>{endsAt && startsAt && toZoned(endsAt, tz).date !== toZoned(startsAt, tz).date && " · ends next day"}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block space-y-1"><span className="label-caps">Priority (0–100)</span><input type="number" min={0} max={100} className="field" value={priority} onChange={(e) => setPriority(Math.max(0, Math.min(100, +e.target.value)))} /></label>
            <label className="mt-5 flex items-center gap-2 text-xs"><input type="checkbox" checked={commercial} onChange={(e) => setCommercial(e.target.checked)} />Commercial break</label>
          </div>
          {!entry && (
            <div className="space-y-2 rounded-sm border border-border bg-inset p-2">
              <label className="block space-y-1"><span className="label-caps">Repeat</span>
                <select className="field" value={freq} onChange={(e) => setFreq(e.target.value as RecurrenceRule["freq"])}>
                  <option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekly">Weekly (same weekday)</option><option value="weekdays">On selected weekdays</option>
                </select>
              </label>
              {freq === "weekdays" && (
                <div className="flex gap-1">{WD.map((w, i) => <button key={w} type="button" onClick={() => setWeekdays((d) => d.includes(i) ? d.filter((x) => x !== i) : [...d, i])} className={cn("h-7 flex-1 rounded-sm border text-[11px]", weekdays.includes(i) ? "border-preview bg-preview/15 text-preview" : "border-border")}>{w}</button>)}</div>
              )}
              {freq !== "none" && <label className="block space-y-1"><span className="label-caps">Repeat until</span><input type="date" className="field" min={date} value={until} onChange={(e) => setUntil(e.target.value)} /></label>}
            </div>
          )}
          <label className="block space-y-1"><span className="label-caps">Scheduling notes</span><textarea className="field" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>

          {warnings.length > 0 && (
            <div className="space-y-1 rounded-sm border border-program/40 bg-program/10 p-2 text-xs">
              {warnings.map((w, i) => <div key={i} className="flex gap-1.5"><AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-program" />{w.message}</div>)}
            </div>
          )}

          <div className="flex flex-wrap gap-1.5 border-t border-border pt-3">
            <Button type="button" size="sm" variant="panel" disabled={busy} onClick={() => save(false)}>{entry ? "Save" : "Save draft"}</Button>
            <ConfirmButton type="button" size="sm" variant="brand" disabled={busy} title="Publish programme" description={<>This programme will appear in the public TV guide and be executed by the playout engine.{warnings.length > 0 && <span className="mt-2 block text-program">{warnings.length} issue(s) detected — review before publishing.</span>}</>} confirmLabel="Publish" onConfirm={() => save(true)}>
              {entry ? "Save & publish" : "Publish"}
            </ConfirmButton>
            {entry && entry.status !== "cancelled" && <Button type="button" size="sm" variant="ghost" onClick={() => setStatus("cancelled")}>Cancel programme</Button>}
            {entry && entry.status === "cancelled" && <Button type="button" size="sm" variant="ghost" onClick={() => setStatus("draft")}>Restore</Button>}
            {entry && (
              <ConfirmButton type="button" size="sm" variant="ghost" destructive title="Delete programme" description="This removes the programme from the schedule." confirmLabel="Delete" onConfirm={() => remove(false)}><Trash2 />Delete</ConfirmButton>
            )}
            {entry?.recurrence_id && (
              <ConfirmButton type="button" size="sm" variant="ghost" destructive title="Delete series" description="Deletes this and all later programmes in this recurring series." confirmLabel="Delete series" onConfirm={() => remove(true)}>Delete series</ConfirmButton>
            )}
          </div>
        </fieldset>
      </SheetContent>
    </Sheet>
  );
}

function addDay(d: string) {
  const [y = 1970, m = 1, dd = 1] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dd + 1)).toISOString().slice(0, 10);
}
