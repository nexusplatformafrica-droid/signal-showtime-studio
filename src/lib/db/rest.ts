import { FIREBASE_CONFIG } from "@/lib/firebase-config";
import { createDb, type Backend, type Doc } from "@/lib/db/core";

/**
 * Firestore over plain HTTPS (fetch only), for server functions and API routes.
 * Requests carry the caller's Firebase ID token, so firestore.rules apply exactly as in the browser.
 * Without a token, only publicly readable data is reachable.
 */

const ROOT = `projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents`;
const BASE = `https://firestore.googleapis.com/v1/${ROOT}`;

type FsValue = Record<string, unknown>;

export function encodeValue(v: unknown): FsValue {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.filter((x) => x !== undefined).map(encodeValue) } };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === "object") return { mapValue: { fields: encodeFields(v as Record<string, unknown>) } };
  return { stringValue: String(v) };
}

export function encodeFields(obj: Record<string, unknown>) {
  const out: Record<string, FsValue> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = encodeValue(v);
  return out;
}

export function decodeValue(v: FsValue): unknown {
  if ("nullValue" in v) return null;
  if ("booleanValue" in v) return v["booleanValue"];
  if ("integerValue" in v) return Number(v["integerValue"]);
  if ("doubleValue" in v) return Number(v["doubleValue"]);
  if ("stringValue" in v) return v["stringValue"];
  if ("timestampValue" in v) return new Date(String(v["timestampValue"])).toISOString();
  if ("arrayValue" in v) return (((v["arrayValue"] as { values?: FsValue[] }).values ?? []) as FsValue[]).map(decodeValue);
  if ("mapValue" in v) return decodeFields(((v["mapValue"] as { fields?: Record<string, FsValue> }).fields ?? {}) as Record<string, FsValue>);
  if ("referenceValue" in v) return v["referenceValue"];
  if ("geoPointValue" in v) return v["geoPointValue"];
  if ("bytesValue" in v) return v["bytesValue"];
  return null;
}

export function decodeFields(fields: Record<string, FsValue>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) out[k] = decodeValue(v);
  return out;
}

type FsDoc = { name: string; fields?: Record<string, FsValue>; updateTime?: string };
export type RestDoc = Doc & { __updateTime?: string };

function toDoc(d: FsDoc): RestDoc {
  const id = d.name.slice(d.name.lastIndexOf("/") + 1);
  const doc = { ...decodeFields(d.fields ?? {}), id } as RestDoc;
  Object.defineProperty(doc, "__updateTime", { value: d.updateTime, enumerable: false });
  return doc;
}

class FirestoreError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
  }
}

export function createRest(idToken?: string | null) {
  async function call(method: string, url: string, body?: unknown) {
    const sep = url.includes("?") ? "&" : "?";
    const res = await fetch(`${url}${sep}key=${FIREBASE_CONFIG.apiKey}`, {
      method,
      headers: { "content-type": "application/json", ...(idToken ? { authorization: `Bearer ${idToken}` } : {}) },
      body: body === undefined ? null : JSON.stringify(body),
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const err = (Array.isArray(json) ? json[0]?.error : json?.error) ?? {};
      throw new FirestoreError(err.message ?? `Firestore HTTP ${res.status}`, res.status, err.status ?? String(res.status));
    }
    return json;
  }

  async function runQuery(table: string, eq: Array<[string, unknown]>, inFilter: { field: string; values: unknown[] } | null): Promise<RestDoc[]> {
    const chunks: unknown[][] = inFilter ? [] : [[]];
    if (inFilter) for (let i = 0; i < inFilter.values.length; i += 30) chunks.push(inFilter.values.slice(i, i + 30));
    const all: RestDoc[] = [];
    for (const chunk of chunks) {
      const filters = eq.map(([field, value]) => ({ fieldFilter: { field: { fieldPath: field }, op: "EQUAL", value: encodeValue(value) } }));
      if (inFilter) filters.push({ fieldFilter: { field: { fieldPath: inFilter.field }, op: "IN", value: encodeValue(chunk) } });
      const where = filters.length === 0 ? undefined : filters.length === 1 ? filters[0] : { compositeFilter: { op: "AND", filters } };
      const res = (await call("POST", `${BASE}:runQuery`, { structuredQuery: { from: [{ collectionId: table }], ...(where ? { where } : {}) } })) as { document?: FsDoc }[];
      for (const r of res ?? []) if (r.document) all.push(toDoc(r.document));
    }
    return all;
  }

  async function getMany(table: string, ids: string[]): Promise<RestDoc[]> {
    const uniq = [...new Set(ids)].filter((x) => x && !x.includes("/"));
    if (!uniq.length) return [];
    const out: RestDoc[] = [];
    for (let i = 0; i < uniq.length; i += 100) {
      const res = (await call("POST", `${BASE}:batchGet`, { documents: uniq.slice(i, i + 100).map((id) => `${ROOT}/${table}/${id}`) })) as { found?: FsDoc }[];
      for (const r of res ?? []) if (r.found) out.push(toDoc(r.found));
    }
    return out;
  }

  const docUrl = (table: string, id: string) => `${BASE}/${table}/${encodeURIComponent(id)}`;

  /** Update only if the document has not changed since it was read (used to claim commands once). */
  async function updateIfUnchanged(table: string, id: string, patch: Record<string, unknown>, updateTime: string) {
    const mask = Object.keys(patch).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");
    try {
      await call("PATCH", `${docUrl(table, id)}?${mask}&currentDocument.updateTime=${encodeURIComponent(updateTime)}`, { fields: encodeFields(patch) });
      return true;
    } catch (e) {
      if (e instanceof FirestoreError && (e.status === 400 || e.status === 409 || e.code === "FAILED_PRECONDITION")) return false;
      throw e;
    }
  }

  const backend: Backend = {
    list: runQuery,
    getMany,
    async set(table, id, data) {
      await call("PATCH", docUrl(table, id), { fields: encodeFields(data) });
    },
    async update(table, id, patch) {
      const keys = Object.keys(patch);
      if (!keys.length) return;
      const mask = keys.map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");
      await call("PATCH", `${docUrl(table, id)}?${mask}&currentDocument.exists=true`, { fields: encodeFields(patch) });
    },
    async remove(table, id) {
      await call("DELETE", docUrl(table, id));
    },
  };

  return { db: createDb(backend), backend, runQuery, getMany, updateIfUnchanged };
}

export type Rest = ReturnType<typeof createRest>;
