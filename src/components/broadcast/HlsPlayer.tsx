import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize, Minimize, Pause, Play, Volume2, VolumeX, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export type PlayerState = "idle" | "loading" | "playing" | "paused" | "buffering" | "reconnecting" | "error" | "offline";

interface Props {
  src: string | null | undefined;
  poster?: string;
  autoPlay?: boolean;
  muted?: boolean;
  controls?: boolean;
  className?: string;
  /** Shown when there is no source or the stream is unreachable. */
  offlineLabel?: React.ReactNode;
  onStateChange?: (s: PlayerState) => void;
}

/** HLS live player (hls.js with native fallback), adaptive bitrate + automatic recovery. */
export function HlsPlayer({ src, poster, autoPlay = true, muted: mutedInit = true, controls = true, className, offlineLabel, onStateChange }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [state, setStateRaw] = useState<PlayerState>(src ? "loading" : "offline");
  const [muted, setMuted] = useState(mutedInit);
  const [volume, setVolume] = useState(0.8);
  const [levels, setLevels] = useState<{ height: number; bitrate: number }[]>([]);
  const [level, setLevel] = useState(-1);
  const [fs, setFs] = useState(false);
  const [retry, setRetry] = useState(0);
  const hlsRef = useRef<import("hls.js").default | null>(null);

  const setState = useCallback((s: PlayerState) => {
    setStateRaw(s);
    onStateChange?.(s);
  }, [onStateChange]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!src) {
      setState("offline");
      return;
    }
    let cancelled = false;
    let netRetries = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    setState("loading");

    const onPlaying = () => setState("playing");
    const onPause = () => setState("paused");
    const onWaiting = () => setState("buffering");
    video.addEventListener("playing", onPlaying);
    video.addEventListener("pause", onPause);
    video.addEventListener("waiting", onWaiting);

    (async () => {
      const { default: Hls } = await import("hls.js");
      if (cancelled) return;
      if (Hls.isSupported()) {
        const hls = new Hls({ lowLatencyMode: true, liveSyncDurationCount: 3, enableWorker: true });
        hlsRef.current = hls;
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
          netRetries = 0;
          setLevels(data.levels.map((l) => ({ height: l.height, bitrate: l.bitrate })));
          if (autoPlay) video.play().catch(() => setState("paused"));
        });
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (!data.fatal) return;
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
            return;
          }
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR && netRetries < 8) {
            netRetries++;
            setState("reconnecting");
            retryTimer = setTimeout(() => hls.startLoad(), Math.min(1000 * 2 ** netRetries, 15000));
            return;
          }
          setState(data.response?.code === 404 || data.type === Hls.ErrorTypes.NETWORK_ERROR ? "offline" : "error");
          hls.destroy();
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src;
        video.addEventListener("error", () => setState("offline"), { once: true });
        if (autoPlay) video.play().catch(() => setState("paused"));
      } else {
        setState("error");
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("waiting", onWaiting);
      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.removeAttribute("src");
      video.load();
    };
  }, [src, autoPlay, retry, setState]);

  useEffect(() => {
    const v = videoRef.current;
    if (v) {
      v.muted = muted;
      v.volume = volume;
    }
  }, [muted, volume]);

  useEffect(() => {
    const onFs = () => setFs(document.fullscreenElement === wrapRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFs = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else wrapRef.current?.requestFullscreen?.();
  };

  const showOverlay = state === "offline" || state === "error" || state === "loading" || state === "reconnecting";

  return (
    <div ref={wrapRef} className={cn("group relative h-full w-full overflow-hidden bg-inset", className)}>
      <video ref={videoRef} className="h-full w-full object-contain" playsInline poster={poster} muted={muted} />
      {showOverlay && (
        <div className="absolute inset-0 flex items-center justify-center">
          {poster && <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />}
          <div className="relative text-center">
            {state === "loading" && <div className="label-caps">Connecting to channel…</div>}
            {state === "reconnecting" && <div className="label-caps text-warn">Connection lost — reconnecting…</div>}
            {(state === "offline" || state === "error") && (
              <div className="space-y-3">
                {offlineLabel ?? <div className="label-caps">{state === "error" ? "Playback error" : "Channel offline"}</div>}
                {src && (
                  <button onClick={() => setRetry((r) => r + 1)} className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-panel px-2.5 py-1 text-xs hover:bg-accent">
                    <RotateCcw className="size-3" /> Retry
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      {controls && src && !showOverlay && (
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 px-3 pb-2 pt-8 scrim opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button aria-label={state === "playing" ? "Pause" : "Play"} onClick={() => (videoRef.current?.paused ? videoRef.current.play() : videoRef.current?.pause())} className="p-1 hover:text-foreground/80">
            {state === "playing" ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
          <button aria-label={muted ? "Unmute" : "Mute"} onClick={() => setMuted((m) => !m)} className="p-1">
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </button>
          <input aria-label="Volume" type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume} onChange={(e) => { setVolume(+e.target.value); setMuted(+e.target.value === 0); }} className="w-20 accent-program" />
          <span className="ml-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-program">
            <span className="size-1.5 rounded-full bg-program animate-tally" /> Live
          </span>
          <div className="flex-1" />
          {levels.length > 1 && (
            <select aria-label="Quality" value={level} onChange={(e) => { const l = +e.target.value; setLevel(l); if (hlsRef.current) hlsRef.current.currentLevel = l; }} className="h-6 rounded-sm border border-border bg-inset px-1 text-[11px]">
              <option value={-1}>Auto</option>
              {levels.map((l, i) => (
                <option key={i} value={i}>{l.height ? `${l.height}p` : `${Math.round(l.bitrate / 1000)}k`}</option>
              ))}
            </select>
          )}
          <button aria-label="Full screen" onClick={toggleFs} className="p-1">
            {fs ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
          </button>
        </div>
      )}
    </div>
  );
}
