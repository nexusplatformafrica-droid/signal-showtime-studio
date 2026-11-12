import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, GripVertical, Plus, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useStation } from "@/components/admin/station-context";
import { PageHeader, EmptyState } from "@/components/admin/PageHeader";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { MediaPicker } from "@/components/schedule/MediaPicker";
import { StatusChip } from "@/components/broadcast/status";
import { Button } from "@/components/ui/button";
import { PLAYLIST_KINDS, PLAYLIST_KIND_LABELS, CATEGORY_LABELS, type PlaylistKind } from "@/lib/labels";
import { formatDuration, formatTime, playlistTotals, toZoned, zonedToUtc } from "@/lib/broadcast";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/playlists")({ component: PlaylistsPage });

type Playlist = Tables<"playlists">;
type Item = { id: string; position: number; media: Pick<Tables<"media_assets">, "id" | "title" | "category" | "duration_seconds" | "thumbnail_url" | "status" | "available"> | null };

function PlaylistsPage() {
  const { channel, can, user } = useStation();
  const qc = useQueryClient();
  const canEdit = can("playlists");
  const [activeId, setActiveId] = useState<string | null>(null);

  const playlists = useQuery({
    queryKey: ["playlists", channel.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("playlists").select("*, playlist_items(count)").eq("channel_id", channel.id).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  useEffect(() => {
    if (!activeId && playlists.data?.[0]) setActiveId(playlists.data[0].id);
  }, [playlists.data, activeId]);

  async function create() {
    const { data, error } = await supabase.from("playlists").insert({ channel_id: channel.id, name: "New playlist", kind: "custom", created_by: user.id }).select("id").single();
    if (error || !data) {
      toast.error(error?.message ?? "Could not create playlist");
      return;
    }
    await qc.invalidateQueries({ queryKey: ["playlists", channel.id] });
    setActiveId(data.id);
  }

  const active = playlists.data?.find((p) => p.id === activeId) ?? null;

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Playlists" description="Blocks of media for dayparts, marathons, adverts and standby." actions={<Button size="xs" variant="program" disabled={!canEdit} onClick={create}><Plus />New playlist</Button>} />
      <div className="flex min-h-0 flex-1">
        <aside className="w-64 shrink-0 overflow-y-auto border-r border-border">
          {!playlists.data?.length && !playlists.isLoading && <EmptyState title="No playlists yet" />}
          {playlists.data?.map((p) => {
            const count = (p.playlist_items as unknown as { count: number }[] | undefined)?.[0]?.count ?? 0;
            return (
              <button key={p.id} onClick={() => setActiveId(p.id)} className={cn("flex w-full items-center gap-2 border-b border-border/60 px-3 py-2 text-left hover:bg-accent", activeId === p.id && "bg-accent")}>
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{p.name}</div><div className="text-[11px] text-muted-foreground">{PLAYLIST_KIND_LABELS[p.kind]} · {count} items</div></div>
                {p.published ? <StatusChip tone="preview">Live</StatusChip> : <StatusChip tone="warn">Draft</StatusChip>}
              </button>
            );
          })}
        </aside>
        <div className="min-w-0 flex-1 overflow-y-auto">
          {active ? <PlaylistEditor key={active.id} playlist={active} canEdit={canEdit} onDeleted={() => setActiveId(null)} onDuplicated={(id) => setActiveId(id)} /> : <EmptyState title="Select or create a playlist" />}
        </div>
      </div>
    </div>
  );
}

function PlaylistEditor({ playlist, canEdit, onDeleted, onDuplicated }: { playlist: Playlist; canEdit: boolean; onDeleted: () => void; onDuplicated: (id: string) => void }) {
  const { channel, user } = useStation();
  const tz = channel.timezone;
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: playlist.name, kind: playlist.kind, shuffle: playlist.shuffle, repeat: playlist.repeat, notes: playlist.notes ?? "" });
  const [startDate, setStartDate] = useState(() => toZoned(new Date(), tz).date);
  const [startTime, setStartTime] = useState("20:00");
  const [dragId, setDragId] = useState<string | null>(null);

  const items = useQuery({
    queryKey: ["playlist-items", playlist.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("playlist_items").select("id, position, media:media_assets(id, title, category, duration_seconds, thumbnail_url, status, available)").eq("playlist_id", playlist.id).order("position");
      if (error) throw error;
      return (data ?? []) as unknown as Item[];
    },
  });
  const list = items.data ?? [];
  const startAt = +zonedToUtc(startDate, startTime, tz);
  const totals = useMemo(() => playlistTotals(list.map((i) => ({ duration_seconds: i.media?.duration_seconds == null ? null : Number(i.media.duration_seconds) })), startAt), [list, startAt]);
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["playlist-items", playlist.id] });
    qc.invalidateQueries({ queryKey: ["playlists", channel.id] });
  };

  async function save(patch: Partial<Playlist> = {}) {
    const { error } = await supabase.from("playlists").update({ ...form, notes: form.notes || null, ...patch }).eq("id", playlist.id);
    if (error) toast.error(error.message);
    else toast.success("Playlist saved");
    invalidate();
  }
  async function add(mediaId: string) {
    const pos = (list[list.length - 1]?.position ?? 0) + 1;
    const { error } = await supabase.from("playlist_items").insert({ playlist_id: playlist.id, media_id: mediaId, position: pos });
    if (error) toast.error(error.message);
    invalidate();
  }
  async function reorder(fromId: string, toId: string) {
    if (fromId === toId) return;
    const ids = list.map((i) => i.id);
    const from = ids.indexOf(fromId);
    const to = ids.indexOf(toId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ...ids.splice(from, 1));
    qc.setQueryData(["playlist-items", playlist.id], ids.map((id, i) => ({ ...list.find((x) => x.id === id)!, position: i + 1 })));
    await Promise.all(ids.map((id, i) => supabase.from("playlist_items").update({ position: i + 1 }).eq("id", id)));
    invalidate();
  }
  async function duplicate() {
    const { data, error } = await supabase.from("playlists").insert({ channel_id: channel.id, name: `${playlist.name} (copy)`.slice(0, 120), kind: playlist.kind, shuffle: playlist.shuffle, repeat: playlist.repeat, notes: playlist.notes, created_by: user.id }).select("id").single();
    if (error || !data) {
      toast.error(error?.message ?? "Could not duplicate");
      return;
    }
    if (list.length) await supabase.from("playlist_items").insert(list.filter((i) => i.media).map((i) => ({ playlist_id: data.id, media_id: i.media!.id, position: i.position })));
    invalidate();
    onDuplicated(data.id);
    toast.success("Playlist duplicated");
  }

  return (
    <div className="space-y-3 p-3">
      <fieldset disabled={!canEdit} className="panel grid gap-2 p-3 md:grid-cols-[1fr_180px_auto_auto]">
        <label className="space-y-1"><span className="label-caps">Name</span><input className="field" value={form.name} maxLength={120} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label className="space-y-1"><span className="label-caps">Type</span><select className="field" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as PlaylistKind })}>{PLAYLIST_KINDS.map((k) => <option key={k} value={k}>{PLAYLIST_KIND_LABELS[k]}</option>)}</select></label>
        <label className="mt-5 flex items-center gap-2 text-xs"><input type="checkbox" checked={form.shuffle} onChange={(e) => setForm({ ...form, shuffle: e.target.checked })} />Random order</label>
        <label className="mt-5 flex items-center gap-2 text-xs"><input type="checkbox" checked={form.repeat} onChange={(e) => setForm({ ...form, repeat: e.target.checked })} />Repeat</label>
        <label className="space-y-1 md:col-span-4"><span className="label-caps">Notes</span><input className="field" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
        <div className="flex flex-wrap gap-1.5 md:col-span-4">
          <Button type="button" size="xs" variant="panel" onClick={() => save()}>Save</Button>
          {playlist.published
            ? <Button type="button" size="xs" variant="panel" onClick={() => save({ published: false })}>Unpublish</Button>
            : <ConfirmButton type="button" size="xs" variant="brand" title="Publish playlist?" description="Published playlists can be scheduled and are delivered to the playout engine." confirmLabel="Publish" onConfirm={() => save({ published: true })}>Publish</ConfirmButton>}
          <Button type="button" size="xs" variant="ghost" onClick={duplicate}><Copy />Duplicate</Button>
          <ConfirmButton type="button" size="xs" variant="ghost" destructive title="Delete playlist?" description="Schedule slots using this playlist will show missing media." confirmLabel="Delete" onConfirm={async () => { await supabase.from("playlists").delete().eq("id", playlist.id); invalidate(); onDeleted(); }}><Trash2 />Delete</ConfirmButton>
        </div>
      </fieldset>

      <section className="panel">
        <div className="panel-header">
          <span>Items · {list.length}</span>
          <span className="flex items-center gap-3 normal-case tracking-normal">
            <span>Total <span className="timecode text-foreground">{formatDuration(totals.totalSeconds)}</span>{totals.unknown > 0 && ` (+${totals.unknown} unknown)`}</span>
            <span className="flex items-center gap-1">if started
              <input type="date" className="field h-6 w-32" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              <input type="time" className="field h-6 w-20" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              → ends <span className="timecode text-foreground">{formatTime(totals.completesAt, tz)}</span>
            </span>
          </span>
        </div>
        {canEdit && <div className="border-b border-border p-2"><MediaPicker channelId={channel.id} onPick={(m) => add(m.id)} placeholder="Add media to playlist…" /></div>}
        {list.length === 0 && <EmptyState title="Playlist is empty">Search the media library above to add items.</EmptyState>}
        <table className="data-table w-full"><tbody>
          {list.map((i, idx) => (
            <tr key={i.id} draggable={canEdit} onDragStart={() => setDragId(i.id)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (dragId) void reorder(dragId, i.id); setDragId(null); }} className={cn(dragId === i.id && "opacity-50")}>
              <td className="w-8 cursor-grab text-muted-foreground"><GripVertical className="size-3.5" /></td>
              <td className="timecode w-8 text-muted-foreground">{idx + 1}</td>
              <td className="w-16">{i.media?.thumbnail_url && <img src={i.media.thumbnail_url} alt="" className="h-8 w-14 rounded-[2px] object-cover" loading="lazy" />}</td>
              <td className="max-w-0 truncate">{i.media?.title ?? <span className="text-program">Missing media</span>}</td>
              <td className="w-28 text-muted-foreground">{i.media ? CATEGORY_LABELS[i.media.category] : "—"}</td>
              <td className="timecode w-20">{formatDuration(i.media?.duration_seconds == null ? null : Number(i.media.duration_seconds))}</td>
              <td className="w-20">{i.media && (i.media.status !== "ready" || !i.media.available) && <StatusChip tone="warn">{i.media.status}</StatusChip>}</td>
              <td className="w-8">{canEdit && <button aria-label="Remove item" onClick={async () => { await supabase.from("playlist_items").delete().eq("id", i.id); invalidate(); }}><X className="size-3.5" /></button>}</td>
            </tr>
          ))}
        </tbody></table>
      </section>
    </div>
  );
}
