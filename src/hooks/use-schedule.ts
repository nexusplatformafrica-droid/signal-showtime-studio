import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { MediaRef } from "@/lib/broadcast";

export type ScheduleEntry = Tables<"schedule_entries">;

export function useScheduleRange(channelId: string, fromIso: string, toIso: string, opts: { publishedOnly?: boolean } = {}) {
  return useQuery({
    queryKey: ["schedule", channelId, fromIso, toIso, !!opts.publishedOnly],
    queryFn: async () => {
      let q = supabase.from("schedule_entries").select("*").eq("channel_id", channelId).gte("ends_at", fromIso).lte("starts_at", toIso).order("starts_at").limit(2000);
      if (opts.publishedOnly) q = q.eq("status", "published");
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Minimal media facts used for schedule validation. */
export function useMediaIndex(ids: string[]) {
  const key = [...new Set(ids)].sort();
  return useQuery({
    queryKey: ["media-index", key],
    enabled: key.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("media_assets").select("id, status, available, duration_seconds").in("id", key);
      const map = new Map<string, MediaRef>();
      for (const m of data ?? []) map.set(m.id, { status: m.status, available: m.available, duration_seconds: m.duration_seconds == null ? null : Number(m.duration_seconds) });
      return map;
    },
  });
}
