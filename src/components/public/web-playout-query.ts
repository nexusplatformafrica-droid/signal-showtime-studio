import { queryOptions } from "@tanstack/react-query";
import { getWebPlayout } from "@/lib/public.functions";
import { recordServerTime } from "@/lib/clock";

/**
 * Schedule + playable media for website playout. The server time in the reply also corrects the
 * shared station clock (src/lib/clock.ts); every screen reads that clock, so `skewMs` stays 0.
 */
export const webPlayoutQuery = () =>
  queryOptions({
    queryKey: ["web-playout"],
    queryFn: async () => {
      const t0 = Date.now();
      const res = await getWebPlayout();
      const t1 = Date.now();
      recordServerTime(res.serverTime, t0, t1);
      return { ...res, skewMs: 0 };
    },
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
  });
