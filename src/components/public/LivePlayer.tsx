import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { HlsPlayer, type PlayerState } from "@/components/broadcast/HlsPlayer";
import { viewerHeartbeat } from "@/lib/public.functions";
import slate from "@/assets/standby-slate.jpg";

function deviceType(): "desktop" | "mobile" | "tablet" | "tv" | "unknown" {
  const ua = navigator.userAgent;
  if (/smart-tv|smarttv|googletv|appletv|hbbtv|tizen|webos|android tv|aft/i.test(ua)) return "tv";
  if (/ipad|tablet/i.test(ua)) return "tablet";
  if (/mobi|android|iphone/i.test(ua)) return "mobile";
  return "desktop";
}

/** The single continuous channel player. Counts this viewer only while video is actually playing. */
export function LivePlayer({ channelId, src, onAir, className }: { channelId: string; src: string | null; onAir: boolean; className?: string }) {
  const beat = useServerFn(viewerHeartbeat);
  const stateRef = useRef<PlayerState>("idle");
  const [sessionId] = useState(() => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : ""));
  const onState = useCallback((s: PlayerState) => { stateRef.current = s; }, []);

  useEffect(() => {
    if (!sessionId || !src) return;
    let last = Date.now();
    const tick = () => {
      const nowMs = Date.now();
      const watched = Math.min(120, Math.round((nowMs - last) / 1000));
      last = nowMs;
      if (stateRef.current !== "playing" || document.hidden) return;
      beat({ data: { sessionId, channelId, device: deviceType(), platform: navigator.platform?.slice(0, 40) || "web", watchedSeconds: watched } }).catch(() => undefined);
    };
    const first = setTimeout(tick, 5000);
    const t = setInterval(tick, 30000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [sessionId, src, channelId, beat]);

  return (
    <div className={className}>
      <HlsPlayer
        src={src}
        poster={slate}
        muted
        onStateChange={onState}
        offlineLabel={
          <div className="space-y-1">
            <div className="wordmark text-2xl">MOVIE MAX</div>
            <div className="label-caps">{onAir ? "Stream temporarily unavailable" : "The channel is currently off air"}</div>
          </div>
        }
      />
    </div>
  );
}
