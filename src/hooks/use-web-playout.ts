import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { webPlayoutQuery } from "@/components/public/web-playout-query";
import { pickWebProgramme } from "@/lib/web-playout";

/** Website playout data plus what the schedule says is playing right now (null when nothing playable). */
export function useWebPlayout(now: number | null) {
  const q = useQuery(webPlayoutQuery());
  const web = useMemo(() => (q.data ? { bundle: q.data, skewMs: q.data.skewMs } : null), [q.data]);
  const pick = now != null && q.data ? pickWebProgramme(q.data, now + q.data.skewMs) : null;
  return { web, pick };
}
