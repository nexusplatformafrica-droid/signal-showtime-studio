import { trueDate } from "@/lib/clock";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { toast } from "sonner";
import { Archive, FolderPlus, Folder, Trash2, Upload, X, Film, AlertTriangle, ChevronLeft, ChevronRight, Pause, RefreshCcw, Link2, Loader2 } from "lucide-react";
import { db } from "@/lib/db";
import type { Tables } from "@/lib/db-types";
import { useStation } from "@/components/admin/station-context";
import { PageHeader, EmptyState } from "@/components/admin/PageHeader";
import { StatusChip } from "@/components/broadcast/status";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CATEGORIES, CATEGORY_LABELS, CLASSIFICATIONS, type MediaCategory } from "@/lib/labels";
import { formatBytes, formatDate, formatDuration } from "@/lib/broadcast";
import { abortMediaUpload, completeMediaUpload, deleteMediaAssets, getMediaPlaybackUrl, getStorageStatus, importMediaLink, signMediaParts, startMediaUpload } from "@/lib/station.functions";
import { fingerprintOf, getResumable, probeVideo, probeVideoUrl, setResumable, uploadMultipart, uploadPicture } from "@/lib/upload";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/media")({
  validateSearch: (s) => z.object({ q: z.string().optional() }).parse(s),
  component: MediaLibrary,
});

type Media = Tables<"media_assets">;
const PAGE = 50;

function MediaLibrary() {
  const { channel, can } = useStation();
  const search = Route.useSearch();
  const qc = useQueryClient();
  const [q, setQ] = useState(search.q ?? "");
  const [category, setCategory] = useState<MediaCategory | "all">("all");
  const [statusF, setStatusF] = useState<string>("active");
  const [folder, setFolder] = useState<string | "all" | "none">("all");
  const [sort, setSort] = useState<"created_at" | "title" | "duration_seconds" | "file_size">("created_at");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Media | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const canEdit = can("media");

  useEffect(() => setPage(0), [q, category, statusF, folder, sort]);

  const storageFn = useServerFn(getStorageStatus);
  const storage = useQuery({ queryKey: ["storage-status"], queryFn: () => storageFn() });

  const folders = useQuery({
    queryKey: ["media-folders", channel.id],
    queryFn: async () => (await db.from("media_folders").select("*").eq("channel_id", channel.id).order("name")).data ?? [],
  });

  const list = useQuery({
    queryKey: ["media", channel.id, q, category, statusF, folder, sort, page],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let query = db.from("media_assets").select("*", { count: "exact" }).eq("channel_id", channel.id);
      const needle = q.trim().toLowerCase();
      if (needle) query = query.where((m) => m.title.toLowerCase().includes(needle) || (m.tags ?? []).some((t) => t.toLowerCase() === needle));
      if (category !== "all") query = query.eq("category", category);
      if (statusF === "active") query = query.neq("status", "archived");
      else if (statusF !== "all") query = query.eq("status", statusF as Media["status"]);
      if (folder === "none") query = query.is("folder_id", null);
      else if (folder !== "all") query = query.eq("folder_id", folder);
      query = query.order(sort, { ascending: sort === "title", nullsFirst: false }).range(page * PAGE, page * PAGE + PAGE - 1);
      const { data, count, error } = await query;
      if (error) throw error;
      return { rows: data ?? [], count: count ?? 0 };
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["media", channel.id] });
  const del = useServerFn(deleteMediaAssets);

  const bulkUpdate = useMutation({
    mutationFn: async (patch: Partial<Media>) => {
      const { error } = await db.from("media_assets").update(patch).in("id", [...selected]);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Updated"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = list.data?.rows ?? [];
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));

  async function newFolder() {
    const name = prompt("Folder name");
    if (!name?.trim()) return;
    const { error } = await db.from("media_folders").insert({ channel_id: channel.id, name: name.trim().slice(0, 80) });
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["media-folders", channel.id] });
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Media Library" description={list.data ? `${list.data.count} assets` : undefined} actions={
        <>
          <input className="field h-7 w-56" placeholder="Search title or tag…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="field h-7 w-36" value={category} onChange={(e) => setCategory(e.target.value as MediaCategory | "all")}>
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
          <select className="field h-7 w-28" value={statusF} onChange={(e) => setStatusF(e.target.value)}>
            <option value="active">Active</option><option value="all">All</option><option value="ready">Ready</option><option value="uploading">Uploading</option><option value="failed">Failed</option><option value="archived">Archived</option>
          </select>
          <select className="field h-7 w-32" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="created_at">Newest</option><option value="title">Title A–Z</option><option value="duration_seconds">Longest</option><option value="file_size">Largest</option>
          </select>
          <Button size="xs" variant="brand" disabled={!canEdit} onClick={() => setUploadOpen(true)}><Upload />Upload / add link</Button>
        </>
      }>
        {storage.data && !storage.data.configured && (
          <div className="flex items-center gap-2 border-t border-warn/30 bg-warn/10 px-4 py-1.5 text-xs text-warn">
            <AlertTriangle className="size-3.5" /> Media storage (Cloudflare R2) is not connected. File uploads are disabled until storage is connected (Settings → Storage). You can still add files by pasting their public R2 link.
          </div>
        )}
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-border bg-panel px-4 py-1.5 text-xs">
            <span className="font-semibold">{selected.size} selected</span>
            <select className="field h-7 w-40" disabled={!canEdit} defaultValue="" onChange={(e) => { if (e.target.value) bulkUpdate.mutate({ category: e.target.value as MediaCategory }); e.target.value = ""; }}>
              <option value="">Set category…</option>{CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
            <select className="field h-7 w-40" disabled={!canEdit} defaultValue="" onChange={(e) => { if (e.target.value) bulkUpdate.mutate({ folder_id: e.target.value === "none" ? null : e.target.value }); e.target.value = ""; }}>
              <option value="">Move to folder…</option><option value="none">No folder</option>{folders.data?.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <Button size="xs" variant="panel" disabled={!canEdit} onClick={() => bulkUpdate.mutate({ status: "archived", archived_at: trueDate().toISOString() })}><Archive />Archive</Button>
            <ConfirmButton size="xs" variant="panel" disabled={!can("settings") && !canEdit} destructive title={`Delete ${selected.size} assets?`} description="Files are removed from storage and any schedule slots using them will show missing media." confirmLabel="Delete" onConfirm={async () => {
              try { const r = await del({ data: { ids: [...selected] } }); toast.success(`Deleted ${r.deleted} assets`); setSelected(new Set()); refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "Delete failed"); }
            }}><Trash2 />Delete</ConfirmButton>
            <button className="ml-auto text-muted-foreground hover:text-foreground" onClick={() => setSelected(new Set())}>Clear</button>
          </div>
        )}
      </PageHeader>

      <div className="flex min-h-0 flex-1">
        <aside className="w-48 shrink-0 border-r border-border p-2 text-[13px]">
          <div className="mb-1 flex items-center justify-between px-1"><span className="label-caps">Folders</span>{canEdit && <button onClick={newFolder} aria-label="New folder" className="text-muted-foreground hover:text-foreground"><FolderPlus className="size-3.5" /></button>}</div>
          {[{ id: "all", name: "All media" }, { id: "none", name: "Unfiled" }, ...(folders.data ?? [])].map((f) => (
            <button key={f.id} onClick={() => setFolder(f.id)} className={cn("flex h-7 w-full items-center gap-2 rounded-sm px-2 text-left hover:bg-accent", folder === f.id && "bg-accent")}>
              <Folder className="size-3.5 text-muted-foreground" /><span className="truncate">{f.name}</span>
            </button>
          ))}
        </aside>
        <div className="min-w-0 flex-1 overflow-auto">
          <table className="data-table w-full">
            <thead><tr>
              <th className="w-8"><Checkbox checked={allChecked} onCheckedChange={(c) => setSelected(c ? new Set(rows.map((r) => r.id)) : new Set())} aria-label="Select all" /></th>
              <th className="w-20" /><th>Title</th><th className="w-32">Category</th><th className="w-20">Duration</th><th className="w-24">Resolution</th><th className="w-20">Size</th><th className="w-24">Status</th><th className="w-28">Uploaded</th>
            </tr></thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className="cursor-pointer" onClick={() => setEditing(m)}>
                  <td onClick={(e) => e.stopPropagation()}><Checkbox checked={selected.has(m.id)} onCheckedChange={(c) => setSelected((s) => { const n = new Set(s); if (c) n.add(m.id); else n.delete(m.id); return n; })} aria-label={`Select ${m.title}`} /></td>
                  <td>{m.thumbnail_url ? <img src={m.thumbnail_url} alt="" loading="lazy" className="h-9 w-16 rounded-[2px] object-cover" /> : <div className="grid h-9 w-16 place-items-center rounded-[2px] bg-inset"><Film className="size-3.5 text-muted-foreground" /></div>}</td>
                  <td className="max-w-0"><div className="truncate font-medium">{m.title}</div>{m.tags.length > 0 && <div className="truncate text-[11px] text-muted-foreground">{m.tags.join(" · ")}</div>}</td>
                  <td className="text-muted-foreground">{CATEGORY_LABELS[m.category]}</td>
                  <td className="timecode">{formatDuration(m.duration_seconds == null ? null : Number(m.duration_seconds))}</td>
                  <td className="timecode text-muted-foreground">{m.width && m.height ? `${m.width}×${m.height}` : "—"}</td>
                  <td className="timecode text-muted-foreground">{formatBytes(m.file_size)}</td>
                  <td><MediaStatus m={m} /></td>
                  <td className="text-muted-foreground">{formatDate(m.created_at, channel.timezone, { day: "2-digit", month: "short", year: "2-digit" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!list.isLoading && rows.length === 0 && <EmptyState title="No media found">{storage.data?.configured ? "Upload movies, episodes, adverts and station idents to start programming the channel." : "Connect media storage first, then upload content."}</EmptyState>}
          {(list.data?.count ?? 0) > PAGE && (
            <div className="flex items-center justify-end gap-2 border-t border-border px-3 py-2 text-xs">
              <span className="text-muted-foreground">{page * PAGE + 1}–{Math.min((page + 1) * PAGE, list.data!.count)} of {list.data!.count}</span>
              <Button size="icon-sm" variant="panel" disabled={page === 0} onClick={() => setPage((p) => p - 1)} aria-label="Previous page"><ChevronLeft /></Button>
              <Button size="icon-sm" variant="panel" disabled={(page + 1) * PAGE >= list.data!.count} onClick={() => setPage((p) => p + 1)} aria-label="Next page"><ChevronRight /></Button>
            </div>
          )}
        </div>
      </div>

      <MediaEditor media={editing} onClose={() => setEditing(null)} folders={folders.data ?? []} canEdit={canEdit} onChanged={refresh} storageReady={!!storage.data?.configured} />
      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} folderId={folder !== "all" && folder !== "none" ? folder : null} onDone={refresh} storageReady={!!storage.data?.configured} />
    </div>
  );
}

function MediaStatus({ m }: { m: Media }) {
  if (m.status === "ready") return m.available ? <StatusChip tone="preview">Ready</StatusChip> : <StatusChip tone="off">Unavailable</StatusChip>;
  if (m.status === "uploading") return <StatusChip tone="warn">Uploading</StatusChip>;
  if (m.status === "processing") return <StatusChip tone="info">Processing</StatusChip>;
  if (m.status === "failed") return <StatusChip tone="program">Failed</StatusChip>;
  return <StatusChip tone="off">Archived</StatusChip>;
}

function MediaEditor({ media, onClose, folders, canEdit, onChanged, storageReady }: { media: Media | null; onClose: () => void; folders: Tables<"media_folders">[]; canEdit: boolean; onChanged: () => void; storageReady: boolean }) {
  const [form, setForm] = useState<Partial<Media>>({});
  const [tags, setTags] = useState("");
  const sign = useServerFn(getMediaPlaybackUrl);
  const del = useServerFn(deleteMediaAssets);
  const replaceInput = useRef<HTMLInputElement>(null);
  const [replaceProgress, setReplaceProgress] = useState<number | null>(null);
  const fns = { start: useServerFn(startMediaUpload), sign: useServerFn(signMediaParts), complete: useServerFn(completeMediaUpload) };

  useEffect(() => {
    if (media) {
      setForm({ title: media.title, description: media.description, category: media.category, classification: media.classification, folder_id: media.folder_id, available: media.available });
      setTags(media.tags.join(", "));
    }
  }, [media]);

  const preview = useQuery({ queryKey: ["media-url", media?.id], enabled: !!media && media.status === "ready" && (storageReady || !!media.source_url), queryFn: () => sign({ data: { mediaId: media!.id } }), staleTime: 30 * 60_000 });

  async function save() {
    if (!media) return;
    const { error } = await db.from("media_assets").update({ ...form, tags: tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 30) }).eq("id", media.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Saved");
    onChanged();
    onClose();
  }

  async function replace(file: File) {
    if (!media) return;
    try {
      const probe = await probeVideo(file);
      setReplaceProgress(0);
      await uploadMultipart({ file, mediaId: media.id, replace: true, fns, onProgress: setReplaceProgress, signal: new AbortController().signal });
      await db.from("media_assets").update({ original_filename: file.name, mime_type: file.type || null, duration_seconds: probe.duration, width: probe.width, height: probe.height, fingerprint: fingerprintOf(file) }).eq("id", media.id);
      toast.success("Media file replaced");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Replace failed");
    } finally {
      setReplaceProgress(null);
    }
  }

  return (
    <Sheet open={!!media} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[440px] overflow-y-auto border-border bg-panel sm:max-w-[440px]">
        <SheetHeader><SheetTitle className="font-display uppercase tracking-wide">Media asset</SheetTitle></SheetHeader>
        {media && (
          <div className="mt-3 space-y-3 text-sm">
            <div className="monitor">
              {preview.data?.url ? <video src={preview.data.url} controls className="h-full w-full" preload="metadata" /> : media.thumbnail_url ? <img src={media.thumbnail_url} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center label-caps">No preview</div>}
            </div>
            <Field label="Title"><input className="field" disabled={!canEdit} value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={200} /></Field>
            <Field label="Description"><textarea className="field" rows={3} disabled={!canEdit} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Category"><select className="field" disabled={!canEdit} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as MediaCategory })}>{CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}</select></Field>
              <Field label="Classification"><select className="field" disabled={!canEdit} value={form.classification ?? ""} onChange={(e) => setForm({ ...form, classification: e.target.value || null })}><option value="">—</option>{CLASSIFICATIONS.map((c) => <option key={c}>{c}</option>)}</select></Field>
            </div>
            <Field label="Folder"><select className="field" disabled={!canEdit} value={form.folder_id ?? ""} onChange={(e) => setForm({ ...form, folder_id: e.target.value || null })}><option value="">No folder</option>{folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></Field>
            <Field label="Tags (comma separated)"><input className="field" disabled={!canEdit} value={tags} onChange={(e) => setTags(e.target.value)} /></Field>
            <label className="flex items-center gap-2 text-xs"><Checkbox disabled={!canEdit} checked={!!form.available} onCheckedChange={(c) => setForm({ ...form, available: !!c })} />Available for broadcast</label>
            <dl className="grid grid-cols-[110px_1fr] gap-y-1 rounded-sm border border-border bg-inset p-2 text-xs">
              <dt className="text-muted-foreground">Duration</dt><dd className="timecode">{formatDuration(media.duration_seconds == null ? null : Number(media.duration_seconds))}</dd>
              <dt className="text-muted-foreground">Resolution</dt><dd className="timecode">{media.width ? `${media.width}×${media.height}` : "—"}</dd>
              <dt className="text-muted-foreground">File size</dt><dd className="timecode">{formatBytes(media.file_size)}</dd>
              <dt className="text-muted-foreground">Format</dt><dd>{media.mime_type ?? media.container ?? "—"}</dd>
              <dt className="text-muted-foreground">Original file</dt><dd className="truncate">{media.original_filename ?? "—"}</dd>
              <dt className="text-muted-foreground">Storage</dt><dd className="truncate">{media.source_url ? <a href={media.source_url} target="_blank" rel="noreferrer" className="underline" title={media.source_url}>Linked file</a> : media.storage_bucket ? `r2://${media.storage_bucket}/…/${media.storage_key?.split("/").pop()}` : "—"}</dd>
              <dt className="text-muted-foreground">Status</dt><dd><MediaStatus m={media} /></dd>
            </dl>
            {replaceProgress != null && <div className="h-1 overflow-hidden rounded-full bg-inset"><div className="h-full bg-preview" style={{ width: `${replaceProgress}%` }} /></div>}
            <div className="flex flex-wrap gap-1.5 border-t border-border pt-3">
              <Button size="sm" variant="brand" disabled={!canEdit} onClick={save}>Save</Button>
              <input ref={replaceInput} type="file" accept="video/*,.mkv,.mxf,.ts" hidden onChange={(e) => e.target.files?.[0] && replace(e.target.files[0])} />
              <Button size="sm" variant="panel" disabled={!canEdit || !storageReady || replaceProgress != null || !!media.source_url} onClick={() => replaceInput.current?.click()}><RefreshCcw />Replace file</Button>
              <Button size="sm" variant="panel" disabled={!canEdit} onClick={async () => { await db.from("media_assets").update({ status: media.status === "archived" ? "ready" : "archived", archived_at: media.status === "archived" ? null : trueDate().toISOString() }).eq("id", media.id); onChanged(); onClose(); }}>
                <Archive />{media.status === "archived" ? "Restore" : "Archive"}
              </Button>
              <ConfirmButton size="sm" variant="ghost" disabled={!canEdit} destructive title="Delete media?" description={media.source_url ? `"${media.title}" will be removed from the library. The file itself stays in your R2 bucket.` : `"${media.title}" will be removed from storage permanently.`} confirmLabel="Delete" onConfirm={async () => { try { await del({ data: { ids: [media.id] } }); onChanged(); onClose(); } catch (e) { toast.error(e instanceof Error ? e.message : "Delete failed"); } }}>
                <Trash2 />Delete
              </ConfirmButton>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1"><span className="label-caps">{label}</span>{children}</label>;
}

interface UploadItem {
  id: string;
  file: File;
  progress: number;
  state: "queued" | "probing" | "uploading" | "done" | "error" | "paused";
  error?: string | undefined;
  duplicate?: string | undefined;
  mediaId?: string | undefined;
  ctl?: AbortController | undefined;
}

function UploadDialog({ open, onOpenChange, folderId, onDone, storageReady }: { open: boolean; onOpenChange: (o: boolean) => void; folderId: string | null; onDone: () => void; storageReady: boolean }) {
  const { channel, user } = useStation();
  const [items, setItems] = useState<UploadItem[]>([]);
  const [category, setCategory] = useState<MediaCategory>("movie");
  const [drag, setDrag] = useState(false);
  const fns = { start: useServerFn(startMediaUpload), sign: useServerFn(signMediaParts), complete: useServerFn(completeMediaUpload) };
  const abort = useServerFn(abortMediaUpload);
  const running = useRef(false);

  const patch = useCallback((id: string, p: Partial<UploadItem>) => setItems((list) => list.map((i) => (i.id === id ? { ...i, ...p } : i))), []);

  async function addFiles(files: FileList | File[]) {
    const arr = [...files].filter((f) => f.size > 0);
    const fps = arr.map(fingerprintOf);
    const { data: dupes } = await db.from("media_assets").select("title, fingerprint").eq("channel_id", channel.id).in("fingerprint", fps);
    const dupeMap = new Map((dupes ?? []).map((d) => [d.fingerprint, d.title]));
    setItems((list) => [...list, ...arr.map((file) => ({ id: crypto.randomUUID(), file, progress: 0, state: "queued" as const, duplicate: dupeMap.get(fingerprintOf(file)) }))]);
  }

  const runOne = useCallback(async (item: UploadItem) => {
    const ctl = new AbortController();
    patch(item.id, { state: "probing", ctl, error: undefined });
    try {
      let mediaId = item.mediaId ?? getResumable(item.file) ?? undefined;
      if (mediaId) {
        const { data } = await db.from("media_assets").select("id, status").eq("id", mediaId).maybeSingle();
        if (!data || data.status === "ready") mediaId = undefined;
      }
      if (!mediaId) {
        const probe = await probeVideo(item.file);
        const title = item.file.name.replace(/\.[^.]+$/, "").replace(/[._]+/g, " ").trim().slice(0, 200) || "Untitled";
        const { data: row, error } = await db.from("media_assets").insert({
          channel_id: channel.id, folder_id: folderId, title, category, status: "uploading",
          duration_seconds: probe.duration, width: probe.width, height: probe.height,
          file_size: item.file.size, mime_type: item.file.type || null, original_filename: item.file.name,
          container: item.file.name.split(".").pop()?.toLowerCase() ?? null, fingerprint: fingerprintOf(item.file), created_by: user.id,
        }).select("id").single();
        if (error || !row) throw new Error(error?.message ?? "Could not create media record");
        mediaId = row.id;
        if (probe.thumbnail) {
          const thumb = await uploadPicture(probe.thumbnail, "thumbnails").catch(() => null);
          if (thumb) await db.from("media_assets").update({ thumbnail_url: thumb }).eq("id", row.id);
        }
      }
      setResumable(item.file, mediaId);
      patch(item.id, { state: "uploading", mediaId });
      await uploadMultipart({ file: item.file, mediaId, fns, signal: ctl.signal, onProgress: (p) => patch(item.id, { progress: p }) });
      setResumable(item.file, null);
      patch(item.id, { state: "done", progress: 100 });
      onDone();
    } catch (e) {
      if (ctl.signal.aborted) patch(item.id, { state: "paused" });
      else patch(item.id, { state: "error", error: e instanceof Error ? e.message : "Upload failed" });
    }
  }, [channel.id, folderId, category, user.id, fns, patch, onDone]);

  useEffect(() => {
    if (running.current) return;
    const next = items.find((i) => i.state === "queued");
    const active = items.filter((i) => i.state === "uploading" || i.state === "probing").length;
    if (!next || active >= 2) return;
    running.current = true;
    runOne(next).finally(() => { running.current = false; setItems((l) => [...l]); });
  }, [items, runOne]);

  const activeCount = useMemo(() => items.filter((i) => ["queued", "probing", "uploading"].includes(i.state)).length, [items]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && activeCount) { if (!confirm("Uploads are still running. They will pause and can be resumed by adding the same files again. Close?")) return; items.forEach((i) => i.ctl?.abort()); } onOpenChange(o); if (!o) setItems([]); }}>
      <DialogContent className="max-w-2xl border-border bg-panel">
        <DialogHeader><DialogTitle className="font-display uppercase tracking-wide">Upload media</DialogTitle></DialogHeader>
        <div className="flex items-center gap-2 text-xs">
          <span className="label-caps">Default category</span>
          <select className="field h-7 w-44" value={category} onChange={(e) => setCategory(e.target.value as MediaCategory)}>{CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}</select>
          <span className="ml-auto text-muted-foreground">Large files upload in 16 MB parts and resume automatically.</span>
        </div>
        <LinkImport category={category} folderId={folderId} onDone={onDone} />
        {storageReady ? (
          <label
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
            className={cn("flex h-28 cursor-pointer flex-col items-center justify-center rounded-sm border border-dashed text-sm text-muted-foreground", drag ? "border-preview bg-preview/10" : "border-border bg-inset")}
          >
            <Upload className="mb-1 size-5" />Or drop video files here / click to browse
            <input type="file" multiple accept="video/*,.mkv,.mxf,.ts" hidden onChange={(e) => e.target.files && addFiles(e.target.files)} />
          </label>
        ) : (
          <div className="rounded-sm border border-dashed border-border bg-inset p-3 text-center text-xs text-muted-foreground">File uploads need storage to be connected (Settings → Storage). Pasting a public link works without them.</div>
        )}
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {items.map((i) => (
            <div key={i.id} className="rounded-sm border border-border bg-inset px-2 py-1.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate">{i.file.name}</span>
                <span className="timecode text-muted-foreground">{formatBytes(i.file.size)}</span>
                <span className="w-16 text-right">{i.state === "done" ? <span className="text-preview">Done</span> : i.state === "error" ? <span className="text-program">Error</span> : i.state === "paused" ? "Paused" : i.state === "probing" ? "Reading…" : i.state === "queued" ? "Queued" : `${Math.floor(i.progress)}%`}</span>
                {i.state === "uploading" && <button aria-label="Pause" onClick={() => i.ctl?.abort()}><Pause className="size-3.5" /></button>}
                {(i.state === "paused" || i.state === "error") && <button aria-label="Resume" onClick={() => patch(i.id, { state: "queued" })}><RefreshCcw className="size-3.5" /></button>}
                {i.state !== "uploading" && i.state !== "probing" && <button aria-label="Remove" onClick={async () => { if (i.mediaId && i.state !== "done") { await abort({ data: { mediaId: i.mediaId } }).catch(() => undefined); setResumable(i.file, null); } setItems((l) => l.filter((x) => x.id !== i.id)); }}><X className="size-3.5" /></button>}
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-background"><div className={cn("h-full", i.state === "error" ? "bg-program" : "bg-preview")} style={{ width: `${i.progress}%` }} /></div>
              {i.duplicate && <div className="mt-1 text-warn">Possible duplicate of "{i.duplicate}"</div>}
              {i.error && <div className="mt-1 text-program">{i.error}</div>}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}


interface LinkItem { id: string; url: string; state: "adding" | "reading" | "done" | "error"; title?: string; error?: string }

/** Adds files that are already in R2 by their link — nothing is uploaded again. */
function LinkImport({ category, folderId, onDone }: { category: MediaCategory; folderId: string | null; onDone: () => void }) {
  const { channel } = useStation();
  const [text, setText] = useState("");
  const [items, setItems] = useState<LinkItem[]>([]);
  const importFn = useServerFn(importMediaLink);
  const sign = useServerFn(getMediaPlaybackUrl);
  const patch = (id: string, p: Partial<LinkItem>) => setItems((l) => l.map((i) => (i.id === id ? { ...i, ...p } : i)));
  const busy = items.some((i) => i.state === "adding" || i.state === "reading");

  async function addOne(url: string) {
    const id = crypto.randomUUID();
    setItems((l) => [...l, { id, url, state: "adding" }]);
    try {
      const res = await importFn({ data: { channelId: channel.id, url, category, folderId } });
      patch(id, { state: "reading", title: res.title });
      onDone();
      const playUrl = res.playUrl ?? (await sign({ data: { mediaId: res.id } }).catch(() => ({ url: null }))).url;
      if (playUrl) {
        const probe = await probeVideoUrl(playUrl);
        const update: Partial<Media> = {};
        if (probe.duration != null) update.duration_seconds = probe.duration;
        if (probe.width) { update.width = probe.width; update.height = probe.height; }
        if (probe.thumbnail) {
          const thumb = await uploadPicture(probe.thumbnail, "thumbnails").catch(() => null);
          if (thumb) update.thumbnail_url = thumb;
        }
        if (Object.keys(update).length) await db.from("media_assets").update(update).eq("id", res.id);
      }
      patch(id, { state: "done" });
      onDone();
    } catch (e) {
      patch(id, { state: "error", error: e instanceof Error ? e.message : "Could not add this link" });
    }
  }

  async function submit() {
    const urls = [...new Set(text.split(/[\s,]+/).map((u) => u.trim()).filter(Boolean))].slice(0, 50);
    if (!urls.length) return;
    setText("");
    for (const u of urls) await addOne(u);
  }

  return (
    <div className="space-y-2 rounded-sm border border-border bg-inset p-2">
      <div className="flex items-center gap-1.5"><Link2 className="size-3.5 text-muted-foreground" /><span className="label-caps">Paste R2 link</span><span className="ml-auto text-[11px] text-muted-foreground">One link per line · public r2.dev / custom-domain links, or links into the connected bucket</span></div>
      <div className="flex gap-1.5">
        <textarea className="field min-h-9 flex-1 font-mono text-xs" rows={text.includes("\n") ? 3 : 1} placeholder="https://pub-xxxx.r2.dev/movies/my-film.mp4" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }} aria-label="Media file link" />
        <Button size="sm" variant="brand" disabled={!text.trim() || busy} onClick={submit}>{busy ? <Loader2 className="animate-spin" /> : <Link2 />}Add</Button>
      </div>
      {items.length > 0 && (
        <div className="max-h-40 space-y-1 overflow-y-auto">
          {items.map((i) => (
            <div key={i.id} className="rounded-sm border border-border bg-background px-2 py-1 text-xs">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate" title={i.url}>{i.title ?? i.url}</span>
                <span className="shrink-0">{i.state === "done" ? <span className="text-preview">Added</span> : i.state === "error" ? <span className="text-program">Error</span> : i.state === "reading" ? "Reading video…" : "Checking link…"}</span>
                {(i.state === "done" || i.state === "error") && <button aria-label="Dismiss" onClick={() => setItems((l) => l.filter((x) => x.id !== i.id))}><X className="size-3.5" /></button>}
              </div>
              {i.error && <div className="mt-0.5 text-program">{i.error}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
