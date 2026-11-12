import { queryOptions } from "@tanstack/react-query";
import { getWebPlayout } from "@/lib/public.functions";

/** Schedule + playable media for website playout. `skewMs` corrects the viewer's clock to the server's. */
export const webPlayoutQuery = () =>
  queryOptions({
    queryKey: ["web-playout"],
    queryFn: async () => {
      const t0 = Date.now();
      const res = await getWebPlayout();
      const t1 = Date.now();
      return { ...res, skewMs: res.serverTime - (t0 + t1) / 2 };
    },
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
  });
