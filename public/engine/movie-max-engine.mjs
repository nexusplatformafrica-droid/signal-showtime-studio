#!/usr/bin/env node
/**
 * MOVIE MAX playout engine (v1.0.0)
 * Plays the published MOVIE MAX schedule with FFmpeg and pushes it to your streaming provider (e.g. Wowza).
 * Needs Node.js 18+ and FFmpeg. Run it on a computer that stays on (a small Linux server is best).
 *
 *   MMX_API=https://your-site/api/public/engine/v1 MMX_TOKEN=mmx_eng_... node movie-max-engine.mjs
 *
 * Optional: MMX_PUBLISH_USER / MMX_PUBLISH_PASS (Wowza live-broadcast login), FFMPEG=/path/to/ffmpeg, MMX_HOST=name.
 */
import { spawn } from "node:child_process";
import { hostname } from "node:os";
import { pathToFileURL } from "node:url";

export const VERSION = "1.0.0";

/** Decides what should be on air at `now` from a /schedule response. Pure, so it can be tested. */
export function pickProgramme(schedule, now, skippedKey = null) {
  const t = now.getTime();
  const media = new Map((schedule.media ?? []).map((m) => [m.id, m]));
  const playlists = new Map((schedule.playlists ?? []).map((p) => [p.id, p]));
  const live = (schedule.entries ?? [])
    .filter((e) => Date.parse(e.starts_at) <= t && t < Date.parse(e.ends_at))
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || Date.parse(b.starts_at) - Date.parse(a.starts_at));
  const upcoming = (schedule.entries ?? []).filter((e) => Date.parse(e.starts_at) > t).sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  const nextTitle = upcoming[0]?.title ?? null;

  for (const entry of live) {
    const elapsed = (t - Date.parse(entry.starts_at)) / 1000;
    let pick = null;
    if (entry.media_id) {
      const m = media.get(entry.media_id);
      if (!m || !m.playable || !m.url) continue;
      const dur = Number(m.duration_seconds) || 0;
      const loop = dur > 0 ? Math.floor(elapsed / dur) : 0;
      pick = { media: m, offset: dur > 0 ? elapsed - loop * dur : elapsed, loop };
    } else if (entry.playlist_id) {
      const pl = playlists.get(entry.playlist_id);
      const items = (pl?.items ?? []).map((i) => media.get(i.media_id)).filter((m) => m && m.playable && m.url && Number(m.duration_seconds) > 0);
      const total = items.reduce((s, m) => s + Number(m.duration_seconds), 0);
      if (!items.length || total <= 0) continue;
      if (!pl.repeat && elapsed >= total) continue;
      const loop = Math.floor(elapsed / total);
      let pos = elapsed - loop * total;
      for (let i = 0; i < items.length; i++) {
        const d = Number(items[i].duration_seconds);
        if (pos < d) { pick = { media: items[i], offset: pos, loop: loop * 1000 + i }; break; }
        pos -= d;
      }
    }
    if (!pick) continue;
    const key = `${entry.id}:${pick.media.id}:${pick.loop}`;
    if (key === skippedKey) continue;
    return { key, entry, media: pick.media, offset: Math.max(0, pick.offset), title: entry.title || pick.media.title, nextTitle, endsAt: entry.ends_at };
  }
  return { key: null, entry: null, media: null, offset: 0, title: null, nextTitle, endsAt: null };
}

/** Builds the FFmpeg arguments for one programme (or the standby slate when `input` is null). */
export function ffmpegArgs({ input, offset = 0, loop = false, out, resolution = "1280x720", fps = 25, vKbps = 2500, aKbps = 128 }) {
  const [w, h] = String(resolution).split("x").map(Number);
  const W = w || 1280, H = h || 720, F = fps || 25;
  const src = input
    ? [...(/^https?:/.test(input) ? ["-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "5"] : []), ...(loop ? ["-stream_loop", "-1"] : []), ...(offset > 1 ? ["-ss", offset.toFixed(2)] : []), "-re", "-i", input]
    : ["-re", "-f", "lavfi", "-i", `color=c=black:s=${W}x${H}:r=${F}`, "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo"];
  return [
    "-hide_banner", "-loglevel", "error", "-nostats", "-progress", "pipe:1",
    ...src,
    "-map", "0:v:0", "-map", input ? "0:a:0?" : "1:a:0",
    "-vf", `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,fps=${F},format=yuv420p`,
    "-c:v", "libx264", "-preset", "veryfast", "-b:v", `${vKbps}k`, "-maxrate", `${vKbps}k`, "-bufsize", `${vKbps * 2}k`,
    "-g", String(F * 2), "-keyint_min", String(F * 2), "-sc_threshold", "0",
    "-c:a", "aac", "-b:a", `${aKbps}k`, "-ar", "44100", "-ac", "2",
    "-f", "flv", out,
  ];
}

export function publishUrl(dest, user, pass) {
  if (!dest?.rtmp_url) return null;
  const u = new URL(`${dest.rtmp_url.replace(/\/+$/, "")}/${dest.stream_name ?? ""}`.replace(/\/$/, ""));
  const name = user || dest.username;
  if (name && pass) { u.username = encodeURIComponent(name); u.password = encodeURIComponent(pass); }
  return u.toString();
}

// ------------------------------------------------------------------ runtime

async function main() {
  const API = (process.env.MMX_API ?? "").replace(/\/+$/, "");
  const TOKEN = process.env.MMX_TOKEN ?? "";
  const FFMPEG = process.env.FFMPEG || "ffmpeg";
  const HOST = process.env.MMX_HOST || hostname();
  if (!API || !TOKEN) {
    console.error("Set MMX_API (e.g. https://your-site/api/public/engine/v1) and MMX_TOKEN (mmx_eng_…) first.");
    process.exit(1);
  }
  const log = (...a) => console.log(new Date().toISOString(), ...a);
  const call = async (path, init = {}) => {
    const res = await fetch(`${API}${path}`, { ...init, headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json", ...(init.headers ?? {}) } });
    if (res.status === 401) throw new Error("Engine token rejected (401). Create a new one in Settings → Playout engine.");
    if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
    return res.json();
  };
  const event = (event_type, message, extra = {}) => call("/events", { method: "POST", body: JSON.stringify({ events: [{ event_type, message: String(message).slice(0, 500), severity: extra.severity ?? "info", entry_id: extra.entry_id ?? null, media_id: extra.media_id ?? null }] }) }).catch(() => undefined);

  let config = null, schedule = { entries: [], playlists: [], media: [] };
  let proc = null, running = null, lastProgress = 0, stats = {};
  let skippedKey = null, mode = "schedule", lastError = null, retryAt = 0;

  async function loadConfig() { config = await call("/config"); }
  async function loadSchedule() { schedule = await call(`/schedule?to=${encodeURIComponent(new Date(Date.now() + 24 * 3600_000).toISOString())}`); }

  function stopFfmpeg() {
    if (!proc) return;
    const p = proc;
    p.mmxStopped = true;
    p.kill("SIGTERM");
    setTimeout(() => { try { p.kill("SIGKILL"); } catch {} }, 3000);
    proc = null;
  }

  function startFfmpeg(target) {
    const out = publishUrl(config?.destination, process.env.MMX_PUBLISH_USER, process.env.MMX_PUBLISH_PASS);
    if (!out) { lastError = "No streaming destination configured (Streaming Endpoints)."; return; }
    const ch = config.channel ?? {};
    const args = ffmpegArgs({ input: target.url, offset: target.offset, loop: target.loop, out, resolution: ch.output_resolution === "1080p" ? "1920x1080" : ch.output_resolution === "720p" ? "1280x720" : ch.output_resolution, fps: ch.output_fps, vKbps: ch.video_bitrate_kbps, aKbps: ch.audio_bitrate_kbps });
    target.startedAt = Date.now();
    lastProgress = 0;
    const p = spawn(FFMPEG, args, { stdio: ["ignore", "pipe", "pipe"] });
    proc = p;
    running = target;
    let errText = "";
    p.stdout.on("data", (buf) => {
      if (lastError?.startsWith("The streaming server") || lastError?.startsWith("FFmpeg")) lastError = null;
      for (const line of String(buf).split("\n")) {
        const [k, v] = line.split("=");
        if (!v) continue;
        if (k === "progress") lastProgress = Date.now();
        if (k === "bitrate") stats.bitrate = parseFloat(v) || null;
        if (k === "fps") stats.fps = parseFloat(v) || null;
      }
    });
    p.stderr.on("data", (buf) => { errText = (errText + buf).slice(-400); });
    p.on("error", (e) => { lastError = e.code === "ENOENT" ? "FFmpeg is not installed or not on PATH." : e.message; log("ffmpeg error:", lastError); });
    p.on("exit", (code) => {
      const current = proc === p;
      if (current) proc = null;
      if (!p.mmxStopped && code !== 0) {
        lastError = /need auth|authmod|AccessManager\.Reject/i.test(errText)
          ? "The streaming server refused the login. Set MMX_PUBLISH_USER and MMX_PUBLISH_PASS to your Wowza live-broadcast username and password."
          : `FFmpeg stopped (code ${code}): ${errText.trim().split("\n").pop() ?? ""}`.slice(0, 480);
        retryAt = Date.now() + 15000;
        log(lastError);
        event("encoder_error", lastError, { severity: "error", entry_id: target.entryId, media_id: target.mediaId });
      }
      if (current) running = null;
    });
    log(`▶ ${target.label}${target.offset > 1 ? ` (from ${Math.round(target.offset)}s)` : ""}`);
  }

  function desired() {
    const standby = config?.standby?.url ? { key: "standby", url: config.standby.url, loop: true, offset: 0, label: `Standby: ${config.standby.title}`, source: "standby" } : { key: "slate", url: null, label: "Standby slate (black)", source: "standby" };
    if (mode === "stopped") return null;
    if (mode === "standby") return standby;
    const p = pickProgramme(schedule, new Date(), skippedKey);
    if (!p.media) return { ...standby, nextTitle: p.nextTitle };
    return { key: p.key, url: p.media.url, offset: p.offset, loop: false, label: p.title, title: p.title, nextTitle: p.nextTitle, entryId: p.entry.id, mediaId: p.media.id, duration: Number(p.media.duration_seconds) || null, source: "schedule" };
  }

  function tick() {
    const want = desired();
    if (!want) { stopFfmpeg(); running = null; return; }
    if (running?.key === want.key && proc) return;
    if (!proc && Date.now() < retryAt) return;
    stopFfmpeg();
    startFfmpeg(want);
    if (want.source === "schedule") event("programme_started", `Started ${want.title}`, { entry_id: want.entryId, media_id: want.mediaId });
  }

  async function heartbeat() {
    const live = !!proc && Date.now() - lastProgress < 15000;
    const r = running;
    await call("/heartbeat", { method: "POST", body: JSON.stringify({
      on_air: live, source: live ? r?.source ?? "schedule" : "none",
      current_entry_id: r?.entryId ?? null, current_media_id: r?.mediaId ?? null,
      current_title: r?.title ?? (r ? r.label : null), next_title: r?.nextTitle ?? null,
      position_seconds: r?.startedAt ? r.offset + (Date.now() - r.startedAt) / 1000 : null, duration_seconds: r?.duration ?? null,
      output_resolution: config?.channel?.output_resolution ?? null, output_bitrate_kbps: stats.bitrate ? Math.round(stats.bitrate) : null, output_fps: stats.fps ?? null,
      encoder_status: proc ? (live ? "running" : "starting") : "stopped", destination_status: live ? "connected" : "disconnected",
      engine_version: VERSION, engine_host: HOST, last_error: lastError,
    }) });
  }

  async function commands() {
    const { commands: list } = await call("/commands");
    for (const c of list ?? []) {
      let status = "completed", result = "ok";
      switch (c.command) {
        case "skip": skippedKey = running?.key ?? null; break;
        case "stop": mode = "stopped"; break;
        case "play": case "return_to_schedule": mode = "schedule"; skippedKey = null; break;
        case "play_standby": mode = "standby"; break;
        case "reload_schedule": await loadSchedule(); await loadConfig(); break;
        default: status = "failed"; result = `"${c.command}" is not supported by engine ${VERSION} yet`;
      }
      log(`command ${c.command}: ${status}`);
      await call(`/commands/${c.id}/result`, { method: "POST", body: JSON.stringify({ status, result }) }).catch(() => undefined);
      tick();
    }
  }

  const safe = (name, fn) => async () => { try { await fn(); } catch (e) { lastError = `${name}: ${e.message}`; log(lastError); } };
  log(`MOVIE MAX engine ${VERSION} on ${HOST} → ${API}`);
  await safe("config", loadConfig)();
  await safe("schedule", loadSchedule)();
  if (config?.destination) log(`Pushing to ${config.destination.rtmp_url}/${config.destination.stream_name}`);
  event("engine_restarted", `Engine ${VERSION} started on ${HOST}`);
  tick();
  setInterval(tick, 2000);
  setInterval(safe("heartbeat", heartbeat), 5000);
  setInterval(safe("commands", commands), 3000);
  setInterval(safe("schedule", loadSchedule), 60_000);
  setInterval(safe("config", loadConfig), 5 * 60_000);
  const quit = () => { log("Shutting down"); stopFfmpeg(); call("/heartbeat", { method: "POST", body: JSON.stringify({ on_air: false, source: "none", encoder_status: "stopped", destination_status: "disconnected", engine_version: VERSION, engine_host: HOST }) }).finally(() => process.exit(0)); };
  process.on("SIGINT", quit);
  process.on("SIGTERM", quit);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
