import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db, watchCollection, watchDoc } from "@/lib/db";
import { normalize } from "@/lib/db/core";
import type { Tables } from "@/lib/db-types";
import { onClockChange, startClockSync, trueNow } from "@/lib/clock";

export const CHANNEL_SLUG = "movie-max";

export type Channel = Tables<"channels">;
export type BroadcastStatus = Tables<"broadcast_status">;

export function useChannelQuery() {
  return useQuery({
    queryKey: ["channel", CHANNEL_SLUG],
    queryFn: async () => {
      const { data, error } = await db.from("channels").select("*").eq("slug", CHANNEL_SLUG).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Live engine status, kept fresh by Firebase live updates. */
export function useBroadcastStatus(channelId: string | undefined) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["broadcast-status", channelId],
    enabled: !!channelId,
    queryFn: async () => {
      const { data } = await db.from("broadcast_status").select("*").eq("channel_id", channelId!).maybeSingle();
      return data ?? null;
    },
  });
  useEffect(() => {
    if (!channelId) return;
    return watchDoc("broadcast_status", channelId, (doc) => {
      qc.setQueryData(["broadcast-status", channelId], doc ? (normalize("broadcast_status", doc) as unknown as BroadcastStatus) : null);
    });
  }, [channelId, qc]);
  return query;
}

/** Re-load the given queries whenever a collection changes. `filter` uses the form "channel_id=eq.<id>". */
export function useRealtimeInvalidate(table: string, keys: unknown[][], filter?: string) {
  const qc = useQueryClient();
  const sig = JSON.stringify(keys) + (filter ?? "");
  useEffect(() => {
    const m = filter?.match(/^(\w+)=eq\.(.+)$/);
    return watchCollection(
      table,
      () => {
        for (const k of keys) qc.invalidateQueries({ queryKey: k });
      },
      m ? [m[1]!, m[2]!] : undefined,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, sig]);
}

/** Ticking real-time clock (online time, not the device clock); null until mounted to keep SSR output stable. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    startClockSync();
    setNow(trueNow());
    const t = setInterval(() => setNow(trueNow()), intervalMs);
    const off = onClockChange(() => setNow(trueNow()));
    return () => { clearInterval(t); off(); };
  }, [intervalMs]);
  return now;
}
