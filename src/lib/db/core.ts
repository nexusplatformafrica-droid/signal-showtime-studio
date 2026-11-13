import type { Database, Json } from "@/lib/db-types";
import { DOC_KEY, SCHEMA } from "@/lib/db-schema";

/**
 * A small query builder with the same shape the app used before (from/select/eq/insert/update…),
 * running on Firebase Firestore. Only equality filters are sent to Firestore (no composite indexes
 * needed); ranges, ordering and limits are applied to the result here.
 */

type PublicTables = Database["public"]["Tables"];
export type TableName = keyof PublicTables;
export type Row<T extends TableName> = PublicTables[T]["Row"];
export type Insert<T extends TableName> = PublicTables[T]["Insert"];
export type Update<T extends TableName> = PublicTables[T]["Update"];

export type Doc = Record<string, unknown> & { id: string };
export interface DbError {
  message: string;
  code?: string;
}

export interface Backend {
  /** Documents matching equality filters (and an optional `in` filter). */
  list(table: string, eq: Array<[string, unknown]>, inFilter: { field: string; values: unknown[] } | null): Promise<Doc[]>;
  getMany(table: string, ids: string[]): Promise<Doc[]>;
  /** Write a whole document. */
  set(table: string, id: string, data: Record<string, unknown>): Promise<void>;
  /** Change some fields of an existing document. */
  update(table: string, id: string, patch: Record<string, unknown>): Promise<void>;
  remove(table: string, id: string): Promise<void>;
  afterWrite?(info: { table: string; action: "insert" | "update" | "delete"; rows: Doc[] }): void;
}

type ListRes<R> = { data: R[]; error: null; count: number | null } | { data: null; error: DbError; count: null };
type OneRes<R> = { data: R; error: null; count?: number | null } | { data: null; error: DbError; count?: null };
type MaybeRes<R> = { data: R | null; error: null; count?: number | null } | { data: null; error: DbError; count?: null };

type Filter =
  | { op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "ilike" | "is" | "notis"; field: string; value: unknown }
  | { op: "in"; field: string; value: unknown[] };

const uuid = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();

export function friendlyError(e: unknown): DbError {
  const raw = e instanceof Error ? e.message : String(e);
  const code = (e as { code?: string })?.code;
  if (/permission|PERMISSION_DENIED|insufficient/i.test(raw) || code === "permission-denied")
    return { message: "You do not have permission for this action.", code: "permission-denied" };
  return { message: raw || "Database error", code };
}

/** Fill columns a stored document does not have, so every row has the full shape. */
export function normalize(table: string, doc: Doc): Doc {
  const s = SCHEMA[table];
  if (!s) return doc;
  const out: Doc = { ...doc };
  for (const c of s.columns) {
    if (out[c] === undefined) out[c] = c in s.defaults ? structuredClone(s.defaults[c]) : null;
  }
  const key = DOC_KEY[table];
  if (key && out[key] == null) out[key] = doc.id;
  return out;
}

/** Defaults + nulls + timestamps for a new row. */
export function prepareInsert(table: string, row: Record<string, unknown>): { id: string; data: Record<string, unknown> } {
  const s = SCHEMA[table];
  const key = DOC_KEY[table];
  const id = String((key ? row[key] : undefined) ?? row.id ?? uuid());
  const data: Record<string, unknown> = {};
  if (s) {
    for (const c of s.columns) {
      if (c === "id") continue;
      if (c in s.defaults) data[c] = structuredClone(s.defaults[c]);
      else if (s.now.includes(c)) data[c] = nowIso();
      else data[c] = null;
    }
  }
  for (const [k, v] of Object.entries(row)) if (k !== "id" && v !== undefined) data[k] = v;
  if (key) data[key] = id;
  return { id, data };
}

function cmp(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  return String(a).localeCompare(String(b));
}

function likeToRegex(pattern: string) {
  const esc = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".");
  return new RegExp(`^${esc}$`, "i");
}

function matches(row: Doc, f: Filter): boolean {
  const v = row[f.field];
  switch (f.op) {
    case "eq":
      return v === f.value || (v != null && f.value != null && String(v) === String(f.value));
    case "neq":
      return v != null && v !== f.value;
    case "gt":
      return v != null && cmp(v, f.value) > 0;
    case "gte":
      return v != null && cmp(v, f.value) >= 0;
    case "lt":
      return v != null && cmp(v, f.value) < 0;
    case "lte":
      return v != null && cmp(v, f.value) <= 0;
    case "in":
      return f.value.some((x) => x === v || String(x) === String(v));
    case "is":
      return f.value === null ? v == null : v === f.value;
    case "notis":
      return f.value === null ? v != null : v !== f.value;
    case "ilike":
      return typeof v === "string" && likeToRegex(String(f.value)).test(v);
  }
}

type Op = "select" | "insert" | "update" | "upsert" | "delete";

export class Query<R, I, U, Out = ListRes<R>> implements PromiseLike<Out> {
  private op: Op = "select";
  private filters: Filter[] = [];
  private orders: { field: string; asc: boolean }[] = [];
  private lim: number | null = null;
  private rng: [number, number] | null = null;
  private mode: "many" | "single" | "maybe" = "many";
  private countOpt = false;
  private head = false;
  private returning = false;
  private payload: Record<string, unknown>[] = [];
  private patch: Record<string, unknown> = {};
  private onConflict: string | null = null;

  constructor(
    private backend: Backend,
    private table: string,
  ) {}

  private clone<O>(): Query<R, I, U, O> {
    return this as unknown as Query<R, I, U, O>;
  }

  select(_columns?: string, opts?: { count?: "exact" | "planned" | "estimated"; head?: boolean }): Query<R, I, U, ListRes<R>> {
    if (this.op !== "select") this.returning = true;
    if (opts?.count) this.countOpt = true;
    if (opts?.head) this.head = true;
    return this.clone();
  }
  insert(rows: I | I[]): Query<R, I, U, ListRes<R>> {
    this.op = "insert";
    this.payload = (Array.isArray(rows) ? rows : [rows]) as Record<string, unknown>[];
    return this.clone();
  }
  upsert(rows: I | I[], opts?: { onConflict?: string }): Query<R, I, U, ListRes<R>> {
    this.op = "upsert";
    this.payload = (Array.isArray(rows) ? rows : [rows]) as Record<string, unknown>[];
    this.onConflict = opts?.onConflict ?? null;
    return this.clone();
  }
  update(patch: U): Query<R, I, U, ListRes<R>> {
    this.op = "update";
    this.patch = patch as Record<string, unknown>;
    return this.clone();
  }
  delete(): Query<R, I, U, ListRes<R>> {
    this.op = "delete";
    return this.clone();
  }

  private f(op: Filter["op"], field: string, value: unknown) {
    this.filters.push({ op, field, value } as Filter);
    return this;
  }
  eq(field: string, value: unknown) { return this.f("eq", field, value); }
  neq(field: string, value: unknown) { return this.f("neq", field, value); }
  gt(field: string, value: unknown) { return this.f("gt", field, value); }
  gte(field: string, value: unknown) { return this.f("gte", field, value); }
  lt(field: string, value: unknown) { return this.f("lt", field, value); }
  lte(field: string, value: unknown) { return this.f("lte", field, value); }
  ilike(field: string, pattern: string) { return this.f("ilike", field, pattern); }
  is(field: string, value: null | boolean) { return this.f("is", field, value); }
  not(field: string, operator: "is", value: null | boolean) {
    void operator;
    return this.f("notis", field, value);
  }
  in(field: string, values: readonly unknown[]) {
    this.filters.push({ op: "in", field, value: [...values] });
    return this;
  }
  order(field: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.orders.push({ field, asc: opts?.ascending !== false });
    return this;
  }
  limit(n: number) {
    this.lim = n;
    return this;
  }
  range(from: number, to: number) {
    this.rng = [from, to];
    return this;
  }
  single(): Query<R, I, U, OneRes<R>> {
    this.mode = "single";
    return this.clone();
  }
  maybeSingle(): Query<R, I, U, MaybeRes<R>> {
    this.mode = "maybe";
    return this.clone();
  }

  /** Fetch documents for the current filters (equality and `in` are pushed to Firestore). */
  private async fetchRows(): Promise<Doc[]> {
    const idEq = this.filters.find((x) => x.field === "id" && x.op === "eq");
    const idIn = this.filters.find((x) => x.field === "id" && x.op === "in");
    let docs: Doc[];
    if (idEq) docs = idEq.value == null ? [] : await this.backend.getMany(this.table, [String(idEq.value)]);
    else if (idIn) docs = await this.backend.getMany(this.table, (idIn.value as unknown[]).map(String));
    else {
      const eq = this.filters.filter((x) => x.op === "eq" && x.value != null).map((x) => [x.field, x.value] as [string, unknown]);
      const inF = this.filters.find((x) => x.op === "in");
      if (inF && (inF.value as unknown[]).length === 0) return [];
      docs = await this.backend.list(this.table, eq, inF ? { field: inF.field, values: inF.value as unknown[] } : null);
    }
    let rows = docs.map((d) => normalize(this.table, d));
    for (const flt of this.filters) rows = rows.filter((r) => matches(r, flt));
    return rows;
  }

  private shape(rows: Doc[], count: number | null): Out {
    if (this.mode === "single") {
      if (rows.length !== 1) return { data: null, error: { message: rows.length ? "More than one row returned" : "Row not found", code: "PGRST116" } } as Out;
      return { data: rows[0], error: null } as Out;
    }
    if (this.mode === "maybe") {
      if (rows.length > 1) return { data: null, error: { message: "More than one row returned" } } as Out;
      return { data: rows[0] ?? null, error: null } as Out;
    }
    return { data: this.head ? null : rows, error: null, count } as Out;
  }

  private sortAndCut(rows: Doc[]) {
    if (this.orders.length) {
      rows.sort((a, b) => {
        for (const o of this.orders) {
          const av = a[o.field];
          const bv = b[o.field];
          if (av == null && bv == null) continue;
          if (av == null) return o.asc ? 1 : -1; // nulls last ascending, first descending (like Postgres)
          if (bv == null) return o.asc ? -1 : 1;
          const c = cmp(av, bv);
          if (c !== 0) return o.asc ? c : -c;
        }
        return 0;
      });
    }
    if (this.rng) rows = rows.slice(this.rng[0], this.rng[1] + 1);
    if (this.lim != null) rows = rows.slice(0, this.lim);
    return rows;
  }

  private async run(): Promise<Out> {
    const t = this.table;
    const s = SCHEMA[t];
    if (this.op === "select") {
      const rows = await this.fetchRows();
      const count = this.countOpt ? rows.length : null;
      return this.shape(this.sortAndCut(rows), count);
    }
    if (this.op === "insert") {
      const out: Doc[] = [];
      for (const row of this.payload) {
        const { id, data } = prepareInsert(t, row);
        await this.backend.set(t, id, data);
        out.push(normalize(t, { ...data, id }));
      }
      this.backend.afterWrite?.({ table: t, action: "insert", rows: out });
      return this.returning || this.mode !== "many" ? this.shape(out, null) : ({ data: null, error: null, count: null } as Out);
    }
    if (this.op === "upsert") {
      const out: Doc[] = [];
      const key = DOC_KEY[t];
      for (const row of this.payload) {
        let existing: Doc | undefined;
        if (key && row[key] != null) existing = (await this.backend.getMany(t, [String(row[key])]))[0];
        else if (row.id) existing = (await this.backend.getMany(t, [String(row.id)]))[0];
        else if (this.onConflict && row[this.onConflict] != null)
          existing = (await this.backend.list(t, [[this.onConflict, row[this.onConflict]]], null))[0];
        if (existing) {
          const patch: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(row)) if (k !== "id" && v !== undefined) patch[k] = v;
          if (s?.columns.includes("updated_at") && patch.updated_at === undefined) patch.updated_at = nowIso();
          await this.backend.update(t, existing.id, patch);
          out.push(normalize(t, { ...existing, ...patch, id: existing.id }));
        } else {
          const { id, data } = prepareInsert(t, row);
          await this.backend.set(t, id, data);
          out.push(normalize(t, { ...data, id }));
        }
      }
      this.backend.afterWrite?.({ table: t, action: "update", rows: out });
      return this.returning || this.mode !== "many" ? this.shape(out, null) : ({ data: null, error: null, count: null } as Out);
    }
    const targets = await this.fetchRows();
    if (this.op === "update") {
      const patch: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(this.patch)) if (k !== "id" && v !== undefined) patch[k] = v;
      if (s?.columns.includes("updated_at") && patch.updated_at === undefined) patch.updated_at = nowIso();
      const out: Doc[] = [];
      for (const r of targets) {
        await this.backend.update(t, r.id, patch);
        out.push({ ...r, ...patch });
      }
      if (out.length) this.backend.afterWrite?.({ table: t, action: "update", rows: out });
      return this.returning || this.mode !== "many" ? this.shape(this.sortAndCut(out), null) : ({ data: null, error: null, count: out.length } as Out);
    }
    // delete
    for (const r of targets) await this.backend.remove(t, r.id);
    if (targets.length) this.backend.afterWrite?.({ table: t, action: "delete", rows: targets });
    return this.returning ? this.shape(targets, null) : ({ data: null, error: null, count: targets.length } as Out);
  }

  then<A = Out, B = never>(onfulfilled?: ((value: Out) => A | PromiseLike<A>) | null, onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    return this.run()
      .catch((e) => ({ data: null, error: friendlyError(e), count: null }) as Out)
      .then(onfulfilled, onrejected);
  }
}

export interface Db {
  from<T extends TableName>(table: T): Query<Row<T>, Insert<T>, Update<T>>;
}

export function createDb(backend: Backend): Db {
  return { from: (table) => new Query(backend, table as string) as never };
}

export type { Json };
