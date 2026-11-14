/**
 * Station clock: real time from the internet instead of the device clock.
 * The app's own server (Cloudflare, kept accurate by the internet time service) is the
 * reference; every screen reads `trueNow()` = device time + measured correction.
 * On the server the correction stays 0, so shared code can call it everywhere.
 */

let offsetMs = 0;
let synced = false;
let lastSyncAt = 0;
let started = false;
const listeners = new Set<() => void>();

/** Real current time in ms (device clock corrected by the last online check). */
export function trueNow(): number {
  return Date.now() + offsetMs;
}

/** Real current time as a Date. */
export function trueDate(): Date {
  return new Date(trueNow());
}

export function clockStatus() {
  return { offsetMs, synced, lastSyncAt };
}

/** Correction from one round trip: server time minus the device time halfway through the request. */
export function offsetFromSample(serverMs: number, sentAt: number, receivedAt: number): number {
  return Math.round(serverMs - (sentAt + receivedAt) / 2);
}

/** Pick the sample with the shortest round trip (least network delay → most accurate). */
export function bestSample<T extends { rttMs: number }>(samples: T[]): T | null {
  return samples.reduce<T | null>((best, s) => (!best || s.rttMs < best.rttMs ? s : best), null);
}

/** Feed a server time measured elsewhere (e.g. the playout bundle) into the clock. */
export function recordServerTime(serverMs: number, sentAt: number, receivedAt: number) {
  const rtt = receivedAt - sentAt;
  // A slow reply is less precise; only take it if we have nothing better yet.
  if (synced && rtt > 1500) return;
  setOffset(offsetFromSample(serverMs, sentAt, receivedAt));
}

function setOffset(next: number) {
  const changed = Math.abs(next - offsetMs) > 250 || !synced;
  offsetMs = next;
  synced = true;
  lastSyncAt = Date.now();
  if (changed) for (const l of listeners) l();
}

/** Ask the server for its time a few times and keep the most precise answer. */
export async function syncClock(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const samples: { offset: number; rttMs: number }[] = [];
  for (let i = 0; i < 3; i++) {
    try {
      const sentAt = Date.now();
      const res = await fetch(`/api/public/time?t=${sentAt}`, { cache: "no-store" });
      const receivedAt = Date.now();
      if (!res.ok) continue;
      const body = (await res.json()) as { now?: number };
      if (typeof body.now !== "number") continue;
      samples.push({ offset: offsetFromSample(body.now, sentAt, receivedAt), rttMs: receivedAt - sentAt });
    } catch {
      /* offline — try again later */
    }
  }
  const best = bestSample(samples);
  if (!best) return false;
  setOffset(best.offset);
  return true;
}

/** Start keeping the clock correct (once per page): now, every 10 minutes, and when the tab wakes up. */
export function startClockSync() {
  if (started || typeof window === "undefined") return;
  started = true;
  void syncClock();
  setInterval(() => void syncClock(), 10 * 60_000);
  const again = () => {
    if (document.visibilityState === "visible" && Date.now() - lastSyncAt > 60_000) void syncClock();
  };
  document.addEventListener("visibilitychange", again);
  window.addEventListener("online", () => void syncClock());
}

/** Be told when the correction changes noticeably (so clocks on screen jump to the right time). */
export function onClockChange(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
