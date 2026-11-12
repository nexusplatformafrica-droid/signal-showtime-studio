import { useQuery } from "@tanstack/react-query";
import { getLiveGraphics } from "@/lib/public.functions";
import { useNow } from "@/hooks/use-station";
import { asConfig, type LiveOverlay } from "@/lib/graphics";
import { nextWebEntry, pickWebProgramme, type PlayoutBundle } from "@/lib/web-playout";
import { GraphicsLayer } from "@/components/broadcast/GraphicsLayer";

export const liveGraphicsQuery = () => ({
  queryKey: ["live-graphics"],
  queryFn: () => getLiveGraphics(),
  refetchInterval: 15_000,
  staleTime: 10_000,
});

/** Published graphics over the website playout, timed from the same clock as the picture. */
export function LiveGraphics({ bundle, skewMs = 0 }: { bundle: PlayoutBundle | null | undefined; skewMs?: number }) {
  const { data } = useQuery(liveGraphicsQuery());
  const tick = useNow(1000);
  if (!data || tick == null) return null;
  const now = tick + skewMs;
  const pick = pickWebProgramme(bundle, now);
  const next = nextWebEntry(bundle, now);
  const overlays = data.overlays.map((o) => ({ ...o, config: asConfig(o.config) })) as LiveOverlay[];
  return (
    <GraphicsLayer
      overlays={overlays}
      timezone={data.timezone}
      ctx={{ now, live: !!pick, title: pick?.title ?? null, nextTitle: next?.title ?? null, programmeStartedAt: pick ? Date.parse(pick.entry.starts_at) : null }}
    />
  );
}
