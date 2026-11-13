import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Film, Search } from "lucide-react";
import { db } from "@/lib/db";
import type { Tables } from "@/lib/db-types";
import { CATEGORY_LABELS, type MediaCategory } from "@/lib/labels";
import { formatDuration } from "@/lib/broadcast";

export type PickedMedia = Pick<Tables<"media_assets">, "id" | "title" | "category" | "duration_seconds" | "thumbnail_url" | "status" | "available" | "description">;

export function MediaPicker({ channelId, onPick, category, placeholder = "Search media library…" }: { channelId: string; onPick: (m: PickedMedia) => void; category?: MediaCategory; placeholder?: string }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const { data = [], isFetching } = useQuery({
    queryKey: ["media-picker", channelId, q, category],
    enabled: open,
    queryFn: async () => {
      let query = db.from("media_assets").select("id, title, category, duration_seconds, thumbnail_url, status, available, description").eq("channel_id", channelId).neq("status", "archived").order("title").limit(25);
      if (q.trim()) query = query.ilike("title", `%${q.trim()}%`);
      if (category) query = query.eq("category", category);
      return (await query).data ?? [];
    },
  });
  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input className="field pl-7" placeholder={placeholder} value={q} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} onChange={(e) => { setQ(e.target.value); setOpen(true); }} />
      </div>
      {open && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-sm border border-border bg-popover shadow-lg">
          {isFetching && !data.length && <div className="p-2 text-xs text-muted-foreground">Searching…</div>}
          {!isFetching && !data.length && <div className="p-2 text-xs text-muted-foreground">No media found.</div>}
          {data.map((m) => (
            <button key={m.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onPick(m); setQ(""); setOpen(false); }} className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-accent">
              {m.thumbnail_url ? <img src={m.thumbnail_url} alt="" className="h-7 w-12 rounded-[2px] object-cover" /> : <span className="grid h-7 w-12 place-items-center rounded-[2px] bg-inset"><Film className="size-3" /></span>}
              <span className="min-w-0 flex-1"><span className="block truncate">{m.title}</span><span className="text-[10px] text-muted-foreground">{CATEGORY_LABELS[m.category]}{m.status !== "ready" ? ` · ${m.status}` : ""}</span></span>
              <span className="timecode text-muted-foreground">{formatDuration(m.duration_seconds == null ? null : Number(m.duration_seconds))}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
