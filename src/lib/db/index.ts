import { createDb, type Backend, type Doc } from "@/lib/db/core";
import { getFirebase } from "@/lib/firebase";

/**
 * Browser database: the same query builder as on the server, backed by the Firebase SDK
 * (so writes are signed in as the current person and checked by firestore.rules).
 */

const NO_AUDIT = new Set(["audit_logs", "viewer_sessions", "broadcast_status", "broadcast_events", "stream_health_checks", "profiles"]);

const backend: Backend = {
  async list(table, eq, inFilter) {
    const { db, fsMod: f } = await getFirebase();
    const base = eq.map(([field, value]) => f.where(field, "==", value));
    const chunks: unknown[][] = inFilter ? [] : [[]];
    if (inFilter) for (let i = 0; i < inFilter.values.length; i += 30) chunks.push(inFilter.values.slice(i, i + 30));
    const out: Doc[] = [];
    for (const chunk of chunks) {
      const cons = inFilter ? [...base, f.where(inFilter.field, "in", chunk)] : base;
      const snap = await f.getDocs(f.query(f.collection(db, table), ...cons));
      snap.forEach((d) => out.push({ ...d.data(), id: d.id }));
    }
    return out;
  },
  async getMany(table, ids) {
    const { db, fsMod: f } = await getFirebase();
    const uniq = [...new Set(ids)].filter((x) => x && !x.includes("/"));
    const snaps = await Promise.all(uniq.map((id) => f.getDoc(f.doc(db, table, id))));
    return snaps.filter((s) => s.exists()).map((s) => ({ ...s.data(), id: s.id }) as Doc);
  },
  async set(table, id, data) {
    const { db, fsMod: f } = await getFirebase();
    await f.setDoc(f.doc(db, table, id), data);
  },
  async update(table, id, patch) {
    const { db, fsMod: f } = await getFirebase();
    if (Object.keys(patch).length) await f.updateDoc(f.doc(db, table, id), patch);
  },
  async remove(table, id) {
    const { db, fsMod: f } = await getFirebase();
    await f.deleteDoc(f.doc(db, table, id));
  },
  afterWrite({ table, action, rows }) {
    if (NO_AUDIT.has(table)) return;
    void (async () => {
      try {
        const { auth } = await getFirebase();
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        const ids = rows.map((r) => r.id).slice(0, 20);
        const label = rows.length === 1 ? String(rows[0]?.title ?? rows[0]?.name ?? rows[0]?.command ?? "") : `${rows.length} items`;
        await db.from("audit_logs").insert({ action, entity: table, entity_id: ids[0] ?? null, actor_id: uid, details: { ids, label } });
      } catch {
        /* the audit trail never blocks the action itself */
      }
    })();
  },
};

export const db = createDb(backend);

/** Re-run `onChange` whenever documents in a collection change (optionally only where field == value). */
export function watchCollection(table: string, onChange: () => void, where?: [string, unknown]): () => void {
  let unsub: (() => void) | null = null;
  let cancelled = false;
  let first = true;
  getFirebase().then(({ db: fdb, fsMod: f }) => {
    if (cancelled) return;
    const q = where ? f.query(f.collection(fdb, table), f.where(where[0], "==", where[1])) : f.collection(fdb, table);
    unsub = f.onSnapshot(
      q,
      () => {
        if (first) {
          first = false;
          return;
        }
        onChange();
      },
      () => undefined,
    );
  });
  return () => {
    cancelled = true;
    unsub?.();
  };
}

/** Live copy of one document (null when it does not exist). */
export function watchDoc(table: string, id: string, cb: (doc: Doc | null) => void): () => void {
  let unsub: (() => void) | null = null;
  let cancelled = false;
  getFirebase().then(({ db: fdb, fsMod: f }) => {
    if (cancelled) return;
    unsub = f.onSnapshot(
      f.doc(fdb, table, id),
      (s) => cb(s.exists() ? ({ ...s.data(), id: s.id } as Doc) : null),
      () => undefined,
    );
  });
  return () => {
    cancelled = true;
    unsub?.();
  };
}
