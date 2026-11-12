/**
 * Pure broadcast/scheduling logic shared by the dashboard, public site and tests.
 * All stored timestamps are UTC; station-local values are derived with the channel timezone.
 */

export const STATION_TZ = "Africa/Kampala";
/** The playout engine must heartbeat at least this often for the channel to count as live. */
export const HEARTBEAT_STALE_MS = 30_000;
/** A viewer counts as "watching now" if their player pinged within this window. */
export const VIEWER_ACTIVE_MS = 60_000;

type DateLike = Date | string | number;
const toDate = (d: DateLike) => (d instanceof Date ? d : new Date(d));

function zonedParts(date: Date, tz: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  });
  const raw: Partial<Record<string, string>> = {};
  for (const part of dtf.formatToParts(date)) raw[part.type] = part.value;
  const g = (k: string) => raw[k] ?? "0";
  return { year: g("year"), month: g("month"), day: g("day"), hour: g("hour"), minute: g("minute"), second: g("second"), weekday: g("weekday") };
}

/** Parse "YYYY-MM-DD" into numbers. */
export function parseYmd(dateStr: string): [number, number, number] {
  const [y = 1970, m = 1, d = 1] = dateStr.split("-").map(Number);
  return [y, m, d];
}

/** Offset (ms) of `tz` from UTC at the given instant. Kampala → +3h. */
export function tzOffsetMs(tz: string, date: Date): number {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Convert a station-local wall-clock date ("YYYY-MM-DD") + time ("HH:mm") to a UTC instant. */
export function zonedToUtc(dateStr: string, timeStr: string, tz: string = STATION_TZ): Date {
  const [y, m, d] = parseYmd(dateStr);
  const [hh = 0, mm = 0] = timeStr.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm || 0);
  const off1 = tzOffsetMs(tz, new Date(guess));
  let t = guess - off1;
  const off2 = tzOffsetMs(tz, new Date(t));
  if (off2 !== off1) t = guess - off2;
  return new Date(t);
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Station-local parts for a UTC instant. */
export function toZoned(date: DateLike, tz: string = STATION_TZ) {
  const p = zonedParts(toDate(date), tz);
  const hour = +p.hour % 24;
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${String(hour).padStart(2, "0")}:${p.minute}`,
    weekday: WEEKDAYS.indexOf(p.weekday),
    minutes: hour * 60 + +p.minute + +p.second / 60,
  };
}

export function formatTime(date: DateLike, tz: string = STATION_TZ) {
  return toZoned(date, tz).time;
}

export function formatDate(date: DateLike, tz: string = STATION_TZ, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, ...opts }).format(toDate(date));
}

export function formatClock(date: DateLike, tz: string = STATION_TZ) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(toDate(date));
}

/** "1:32:05" / "04:07" */
export function formatDuration(totalSeconds: number | null | undefined) {
  if (totalSeconds == null || !Number.isFinite(totalSeconds)) return "—";
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Add whole days to a "YYYY-MM-DD" string. */
export function addDays(dateStr: string, n: number) {
  const [y, m, d] = parseYmd(dateStr);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

export function weekdayOf(dateStr: string) {
  const [y, m, d] = parseYmd(dateStr);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Monday of the week containing dateStr. */
export function startOfWeek(dateStr: string) {
  const wd = weekdayOf(dateStr);
  return addDays(dateStr, wd === 0 ? -6 : 1 - wd);
}

export function durationMinutes(start: DateLike, end: DateLike) {
  return Math.round((toDate(end).getTime() - toDate(start).getTime()) / 60000);
}

// ---------------------------------------------------------------- engine status

export interface EngineStatusLike {
  on_air: boolean;
  last_heartbeat_at: string | null;
}

/** The engine is online only when its last heartbeat is fresh. */
export function isEngineOnline(status: EngineStatusLike | null | undefined, now: number = Date.now()) {
  if (!status?.last_heartbeat_at) return false;
  return now - new Date(status.last_heartbeat_at).getTime() <= HEARTBEAT_STALE_MS;
}

/** ON AIR requires the engine itself to report on_air with a fresh heartbeat. Schedule time alone never counts. */
export function isOnAir(status: EngineStatusLike | null | undefined, now: number = Date.now()) {
  return !!status?.on_air && isEngineOnline(status, now);
}

// ---------------------------------------------------------------- schedule

export interface ScheduleSlot {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  status: "draft" | "published" | "cancelled";
  mode?: "fixed" | "follow_on" | "flexible_playlist";
  media_id?: string | null;
  playlist_id?: string | null;
}

export interface MediaRef {
  status: string;
  available: boolean;
  duration_seconds: number | null;
}

export type IssueKind = "overlap" | "missing_media" | "unavailable_media" | "invalid_duration" | "duration_mismatch" | "gap" | "unpublished";

export interface ScheduleIssue {
  kind: IssueKind;
  severity: "error" | "warning";
  entryIds: string[];
  message: string;
  at: string;
}

export function detectScheduleIssues(
  entries: ScheduleSlot[],
  opts: { media?: Map<string, MediaRef>; gapMinutes?: number; windowStart?: string; windowEnd?: string } = {},
): ScheduleIssue[] {
  const issues: ScheduleIssue[] = [];
  const active = entries
    .filter((e) => e.status !== "cancelled")
    .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));
  const gapMs = (opts.gapMinutes ?? 1) * 60_000;

  for (const e of active) {
    const s = +new Date(e.starts_at);
    const en = +new Date(e.ends_at);
    if (!(en > s)) {
      issues.push({ kind: "invalid_duration", severity: "error", entryIds: [e.id], message: `"${e.title}" ends before it starts`, at: e.starts_at });
      continue;
    }
    if (!e.media_id && !e.playlist_id) {
      issues.push({ kind: "missing_media", severity: "error", entryIds: [e.id], message: `"${e.title}" has no media or playlist assigned`, at: e.starts_at });
    } else if (e.media_id && opts.media) {
      const m = opts.media.get(e.media_id);
      if (!m || !m.available || m.status !== "ready") {
        issues.push({ kind: "unavailable_media", severity: "error", entryIds: [e.id], message: `"${e.title}" uses media that is not ready or unavailable`, at: e.starts_at });
      } else if (m.duration_seconds != null && (e.mode ?? "fixed") === "fixed" && m.duration_seconds * 1000 > en - s + 1000) {
        issues.push({ kind: "duration_mismatch", severity: "warning", entryIds: [e.id], message: `"${e.title}" media (${formatDuration(m.duration_seconds)}) is longer than its slot and will be cut`, at: e.starts_at });
      }
    }
    if (e.status === "draft") {
      issues.push({ kind: "unpublished", severity: "warning", entryIds: [e.id], message: `"${e.title}" is not published`, at: e.starts_at });
    }
  }

  // Overlaps + gaps via sweep
  let maxEnd = -Infinity;
  let maxEntry: ScheduleSlot | null = null;
  for (const e of active) {
    const s = +new Date(e.starts_at);
    const en = +new Date(e.ends_at);
    if (!(en > s)) continue;
    if (maxEntry && s < maxEnd) {
      issues.push({ kind: "overlap", severity: "error", entryIds: [maxEntry.id, e.id], message: `"${e.title}" overlaps "${maxEntry.title}"`, at: e.starts_at });
    } else if (maxEntry && s - maxEnd > gapMs) {
      issues.push({ kind: "gap", severity: "warning", entryIds: [maxEntry.id, e.id], message: `Empty airtime: ${formatDuration((s - maxEnd) / 1000)} before "${e.title}"`, at: new Date(maxEnd).toISOString() });
    }
    if (en > maxEnd) {
      maxEnd = en;
      maxEntry = e;
    }
  }
  if (opts.windowStart && opts.windowEnd) {
    const ws = +new Date(opts.windowStart);
    const we = +new Date(opts.windowEnd);
    const firstEntry = active[0];
    if (!firstEntry) {
      issues.push({ kind: "gap", severity: "warning", entryIds: [], message: "No programmes scheduled in this period", at: opts.windowStart });
    } else {
      const first = +new Date(firstEntry.starts_at);
      if (first - ws > gapMs && first > ws) issues.push({ kind: "gap", severity: "warning", entryIds: [firstEntry.id], message: `Empty airtime at start of period (${formatDuration((first - ws) / 1000)})`, at: opts.windowStart });
      if (we - maxEnd > gapMs) issues.push({ kind: "gap", severity: "warning", entryIds: [], message: `Empty airtime at end of period (${formatDuration((we - maxEnd) / 1000)})`, at: new Date(maxEnd).toISOString() });
    }
  }
  return issues;
}

export interface RecurrenceRule {
  freq: "none" | "daily" | "weekly" | "weekdays";
  /** 0 = Sunday … 6 = Saturday; used by "weekdays" */
  weekdays?: number[];
  startDate: string;
  endDate?: string;
  startTime: string;
  durationMinutes: number;
}

export const MAX_OCCURRENCES = 400;

/** Expand a recurrence rule into concrete UTC slots in the station timezone. */
export function expandRecurrence(rule: RecurrenceRule, tz: string = STATION_TZ) {
  const out: { starts_at: Date; ends_at: Date }[] = [];
  const end = rule.freq === "none" ? rule.startDate : rule.endDate ?? rule.startDate;
  const startWd = weekdayOf(rule.startDate);
  for (let d = rule.startDate; d <= end && out.length < MAX_OCCURRENCES; d = addDays(d, 1)) {
    const wd = weekdayOf(d);
    const match =
      rule.freq === "none" || rule.freq === "daily" ||
      (rule.freq === "weekly" && wd === startWd) ||
      (rule.freq === "weekdays" && (rule.weekdays ?? []).includes(wd));
    if (!match) continue;
    const s = zonedToUtc(d, rule.startTime, tz);
    out.push({ starts_at: s, ends_at: new Date(s.getTime() + rule.durationMinutes * 60_000) });
    if (rule.freq === "none") break;
  }
  return out;
}

/** Find the scheduled current/next programme. Callers must not label `current` as ON AIR unless the engine confirms it. */
export function findNowNext<T extends { starts_at: string; ends_at: string; status?: string }>(entries: T[], now: number = Date.now()) {
  const sorted = entries.filter((e) => e.status !== "cancelled").sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));
  const current = sorted.find((e) => +new Date(e.starts_at) <= now && +new Date(e.ends_at) > now) ?? null;
  const next = sorted.find((e) => +new Date(e.starts_at) > now) ?? null;
  return { current, next };
}

export function playlistTotals(items: { duration_seconds: number | null }[], startAt: number = Date.now()) {
  const totalSeconds = items.reduce((acc, i) => acc + (i.duration_seconds ?? 0), 0);
  const unknown = items.filter((i) => i.duration_seconds == null).length;
  return { totalSeconds, unknown, completesAt: new Date(startAt + totalSeconds * 1000) };
}

/** Snap minutes to a step (default 5 minutes). */
export function snapMinutes(minutes: number, step = 5) {
  return Math.max(0, Math.round(minutes / step) * step);
}

export function minutesToTime(minutes: number) {
  const m = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutes)));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
