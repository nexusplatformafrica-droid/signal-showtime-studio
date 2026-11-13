import { useEffect, useRef, useState } from "react";
import { Maximize, Minimize, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { pickWebProgramme, type PlayoutBundle } from "@/lib/web-playout";
import type { PlayerState } from "@/components/broadcast/HlsPlayer";

interface Props {
  bundle: PlayoutBundle | null | undefined;
  /** Server clock minus this device's clock, so every viewer is at the same position. */
  skewMs?: number;
  poster?: string;
  controls?: boolean;
  muted?: boolean;
  className?: string;
  offlineLabel?: React.ReactNode;
  onStateChange?: (s: PlayerState) => void;
  /** Drawn over the picture (graphics), inside the full-screen area. */
  children?: React.ReactNode;
  /** Clicking anywhere on the picture turns the sound on (used where there are no controls). */
  clickForSound?: boolean;
}

const DRIFT_LIMIT_S = 4;

/**
 * Plays the published schedule straight from the media files, locked to the channel clock.
 * Viewers can't pause or seek — like TV, everyone sees the same moment of the programme.
 */
export function ScheduledPlayer({ bundle, skewMs = 0, poster, controls = true, muted: mutedInit = true, className, offlineLabel, onStateChange, children, clickForSound = false }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const loaded = useRef<{ mediaId: string; key: string } | null>(null);
  const bundleRef = useRef(bundle);
  bundleRef.current = bundle;
  const skewRef = useRef(skewMs);
  skewRef.current = skewMs;
  const stateCb = useRef(onStateChange);
  stateCb.current = onStateChange;

  const [state, setStateRaw] = useState<PlayerState>("loading");
  const [muted, setMuted] = useState(mutedInit);
  const [volume, setVolume] = useState(0.8);
  const [blocked, setBlocked] = useState(false);
  const [fs, setFs] = useState(false);
  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;
  const setState = (s: PlayerState) => { setStateRaw(s); stateCb.current?.(s); };

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    let errorUntil = 0;
    const clock = () => Date.now() + skewRef.current;
    const play = () =>
      v.play().then(() => setBlocked(false)).catch(() => {
        // Browsers block autoplay with sound: fall back to muted so the picture still runs.
        if (!v.muted) { v.muted = true; setMuted(true); return v.play().then(() => setBlocked(false)).catch(() => setBlocked(true)); }
        setBlocked(true);
        return undefined;
      });
    const seekToClock = () => {
      const p = pickWebProgramme(bundleRef.current, clock());
      if (!p || loaded.current?.mediaId !== p.media.id) return;
      const target = Number.isFinite(v.duration) && v.duration > 0 ? Math.min(p.offset, Math.max(0, v.duration - 0.5)) : p.offset;
      v.currentTime = target;
      play();
    };

    const tick = () => {
      const p = pickWebProgramme(bundleRef.current, clock());
      if (!p) {
        if (loaded.current) { loaded.current = null; v.removeAttribute("src"); v.load(); }
        setState("offline");
        return;
      }
      if (Date.now() < errorUntil) return;
      if (loaded.current?.mediaId !== p.media.id) {
        loaded.current = { mediaId: p.media.id, key: p.key };
        setState("loading");
        v.src = p.media.url;
        v.load();
        return; // loadedmetadata seeks + plays
      }
      if (loaded.current.key !== p.key) {
        // Same file starting again (loop) or next playlist slot using the same file.
        loaded.current.key = p.key;
        seekToClock();
        return;
      }
      if (v.readyState >= 1 && !v.seeking && Math.abs(v.currentTime - p.offset) > DRIFT_LIMIT_S && p.offset < (v.duration || Infinity) - 1) seekToClock();
      if (v.paused && !v.ended && v.readyState >= 2 && !blockedRef.current) play();
    };

    const onMeta = () => seekToClock();
    const onPlaying = () => setState("playing");
    const onWaiting = () => setState("buffering");
    const onError = () => {
      setState("error");
      loaded.current = null;
      errorUntil = Date.now() + 10_000; // try again shortly
    };
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("playing", onPlaying);
    v.addEventListener("waiting", onWaiting);
    v.addEventListener("error", onError);
    tick();
    const t = setInterval(tick, 1000);
    return () => {
      clearInterval(t);
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("playing", onPlaying);
      v.removeEventListener("waiting", onWaiting);
      v.removeEventListener("error", onError);
      loaded.current = null;
      v.removeAttribute("src");
      v.load();
    };
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (v) { v.muted = muted; v.volume = volume; }
  }, [muted, volume]);

  useEffect(() => {
    const onFs = () => setFs(document.fullscreenElement === wrapRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const start = () => {
    const v = videoRef.current;
    if (!v) return;
    setMuted(false);
    v.muted = false;
    v.play().then(() => setBlocked(false)).catch(() => { v.muted = true; setMuted(true); v.play().catch(() => undefined); });
  };

  const showOverlay = state === "offline" || state === "error" || state === "loading";

  return (
    <div ref={wrapRef} className={cn("group relative h-full w-full overflow-hidden bg-inset", className)} onClick={clickForSound && muted ? start : undefined}>
      <video ref={videoRef} className="h-full w-full object-contain" playsInline poster={poster} muted={muted} preload="auto" disablePictureInPicture />
      {showOverlay && (
        <div className="absolute inset-0 flex items-center justify-center">
          {poster && <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />}
          <div className="relative text-center">
            {state === "loading" && <div className="label-caps">Tuning in…</div>}
            {state === "error" && <div className="label-caps text-warn">This programme can't be played right now — retrying…</div>}
            {state === "offline" && (offlineLabel ?? <div className="label-caps">Channel off air</div>)}
          </div>
        </div>
      )}
      {/* Graphics stay on air between programmes too (clock, logo, ticker…), drawn over the standby picture. */}
      {children}
      {controls && !showOverlay && (blocked || muted) && (
        <button onClick={start} className="absolute left-1/2 top-3 z-10 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-sm bg-background/85 px-2.5 py-1.5 text-xs font-semibold backdrop-blur hover:bg-background">
          <VolumeX className="size-3.5" /> {blocked ? "Tap to watch" : "Tap for sound"}
        </button>
      )}
      {controls && !showOverlay && (
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 px-3 pb-2 pt-8 scrim opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button aria-label={muted ? "Unmute" : "Mute"} onClick={() => setMuted((m) => !m)} className="p-1">
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </button>
          <input aria-label="Volume" type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume} onChange={(e) => { setVolume(+e.target.value); setMuted(+e.target.value === 0); }} className="w-20 accent-program" />
          <span className="ml-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-program">
            <span className="size-1.5 rounded-full bg-program animate-tally" /> Live
          </span>
          <div className="flex-1" />
          <button aria-label="Full screen" onClick={() => (document.fullscreenElement ? document.exitFullscreen() : wrapRef.current?.requestFullscreen?.())} className="p-1">
            {fs ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
          </button>
        </div>
      )}
    </div>
  );
}
