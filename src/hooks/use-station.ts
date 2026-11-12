import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export const CHANNEL_SLUG = "movie-max";

export type Channel = Tables<"channels">;
export type BroadcastStatus = Tables<"broadcast_status">;

export function useChannelQuery() {
  return useQuery({
    queryKey: ["channel", CHANNEL_SLUG],
    queryFn: async () => {
      const { data, error } = await supabase.from("channels").select("*").eq("slug", CHANNEL_SLUG).single();
      if (error) throw error;
      return data;
    },
  });
}

/** Live engine status, kept fresh via realtime. */
export function useBroadcastStatus(channelId: string | undefined) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["broadcast-status", channelId],
    enabled: !!channelId,
    queryFn: async () => {
      const { data } = await supabase.from("broadcast_status").select("*").eq("channel_id", channelId!).maybeSingle();
      return data ?? null;
    },
  });
  useEffect(() => {
    if (!channelId) return;
    const ch = supabase
      .channel(`status-${channelId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "broadcast_status", filter: `channel_id=eq.${channelId}` }, (payload) => {
        qc.setQueryData(["broadcast-status", channelId], payload.new as BroadcastStatus);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [channelId, qc]);
  return query;
}

/** Subscribe to realtime changes on a table and invalidate the given query keys. */
export function useRealtimeInvalidate(table: string, keys: unknown[][], filter?: string) {
  const qc = useQueryClient();
  const sig = JSON.stringify(keys) + (filter ?? "");
  useEffect(() => {
    const ch = supabase
      .channel(`rt-${table}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table, ...(filter ? { filter } : {}) }, () => {
        for (const k of keys) qc.invalidateQueries({ queryKey: k });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, sig]);
}

/** Ticking clock; null until mounted to keep SSR output stable. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
