/**
 * All media lives in S3. Two helpers:
 *  - inlineImagesToS3(body): before an admin save, every base64 `data:image/...` value in the payload is
 *    uploaded to S3 and replaced by its S3 URL, so images never land in Supabase rows.
 *  - moveExternalMediaToS3(): one-time job that copies media still stored outside S3 (base64 in rows,
 *    Unsplash / Cloudinary links) into S3 and rewrites the rows.
 */
import { createHash } from "crypto";
import { dbQuery } from "../db";
import { isS3Enabled, putMediaObject } from "./media-storage";

const DATA_IMAGE = /^data:(image\/(png|jpe?g|webp|gif|avif));base64,/i;
const EXTERNAL_HOSTS = ["images.unsplash.com", "res.cloudinary.com"];
const SKIP_KEYS = new Set<string>();
const MAX_BYTES = 10 * 1024 * 1024;

const extFor = (type: string) => (type.includes("png") ? "png" : type.includes("webp") ? "webp" : type.includes("gif") ? "gif" : type.includes("avif") ? "avif" : "jpg");

async function storeBuffer(folder: string, buf: Buffer, type: string): Promise<string> {
  const hash = createHash("sha256").update(buf).digest("hex").slice(0, 32);
  return putMediaObject(folder, `${hash}.${extFor(type)}`, buf, type);
}

async function dataUrlToS3(value: string, folder: string): Promise<string> {
  const m = value.match(DATA_IMAGE);
  if (!m) return value;
  const buf = Buffer.from(value.slice(m[0].length), "base64");
  if (!buf.length || buf.length > MAX_BYTES) throw new Error("Image is empty or larger than 10MB.");
  return storeBuffer(folder, buf, m[1].toLowerCase().replace("jpg", "jpeg"));
}

function isExternalMedia(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && EXTERNAL_HOSTS.includes(u.hostname);
  } catch {
    return false;
  }
}

async function externalToS3(value: string, folder: string): Promise<string> {
  const res = await fetch(value, { signal: AbortSignal.timeout(20000) });
  const type = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!res.ok || !type.startsWith("image/") || type.includes("svg")) throw new Error(`not an image (${res.status} ${type})`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length || buf.length > MAX_BYTES) throw new Error("image empty or over 10MB");
  return storeBuffer(folder, buf, type);
}

async function walk(node: any, fn: (s: string) => Promise<string>): Promise<{ value: any; changed: boolean }> {
  if (typeof node === "string") {
    const next = await fn(node);
    return { value: next, changed: next !== node };
  }
  if (Array.isArray(node)) {
    let changed = false;
    const out = [];
    for (const item of node) {
      const r = await walk(item, fn);
      changed ||= r.changed;
      out.push(r.value);
    }
    return { value: out, changed };
  }
  if (node && typeof node === "object") {
    let changed = false;
    const out: any = {};
    for (const [k, v] of Object.entries(node)) {
      if (SKIP_KEYS.has(k)) { out[k] = v; continue; }
      const r = await walk(v, fn);
      changed ||= r.changed;
      out[k] = r.value;
    }
    return { value: out, changed };
  }
  return { value: node, changed: false };
}

/** Uploads every base64 image in a request payload to S3 and returns the payload with S3 URLs. */
export async function inlineImagesToS3<T>(body: T, folder = "uploads"): Promise<T> {
  if (!body || typeof body !== "object") return body;
  if (!JSON.stringify(body).includes("data:image/")) return body;
  const cache = new Map<string, string>();
  const r = await walk(body, async (s) => {
    if (!DATA_IMAGE.test(s)) return s;
    if (!cache.has(s)) cache.set(s, await dataUrlToS3(s, folder));
    return cache.get(s)!;
  });
  return r.value;
}

// The media table is handled below (url / thumbnail columns); every other table, history included, is scanned.
const SKIP_TABLES = /^media$/;

/** Copies media stored outside S3 (base64 in rows, stock-photo links) into S3 and rewrites the rows. */
export async function moveExternalMediaToS3(): Promise<{ moved: number; rows: number; errors: string[] }> {
  const errors: string[] = [];
  if (!isS3Enabled()) return { moved: 0, rows: 0, errors: ["S3 not configured"] };
  const cache = new Map<string, string>();
  let moved = 0;
  let rows = 0;
  const convert = async (s: string) => {
    const isData = DATA_IMAGE.test(s);
    if (!isData && !isExternalMedia(s)) return s;
    if (!cache.has(s)) {
      try {
        cache.set(s, isData ? await dataUrlToS3(s, "migrated") : await externalToS3(s, "migrated"));
        moved++;
      } catch (e: any) {
        errors.push(`${s.slice(0, 60)}: ${e.message}`);
        cache.set(s, s);
      }
    }
    return cache.get(s)!;
  };

  const cols = await dbQuery(
    `SELECT c.table_name, c.column_name, c.data_type
       FROM information_schema.columns c
       JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
       JOIN information_schema.key_column_usage k ON k.table_schema = c.table_schema AND k.table_name = c.table_name AND k.column_name = 'id'
       JOIN information_schema.table_constraints tc ON tc.constraint_name = k.constraint_name AND tc.constraint_type = 'PRIMARY KEY'
      WHERE c.table_schema = 'public' AND c.data_type IN ('text', 'character varying', 'jsonb', 'json')`
  );
  for (const { table_name: t, column_name: col, data_type: type } of cols.rows) {
    if (SKIP_TABLES.test(t) || col === "blur_placeholder") continue;
    const found = await dbQuery(
      `SELECT id, "${col}" AS v FROM public."${t}"
        WHERE "${col}"::text LIKE '%data:image/%' OR "${col}"::text LIKE '%images.unsplash.com%' OR "${col}"::text LIKE '%res.cloudinary.com%'`
    ).catch(() => ({ rows: [] as any[] }));
    for (const row of found.rows) {
      let value: any = row.v;
      let wasJsonText = false;
      if (typeof value === "string" && /^\s*[[{]/.test(value)) {
        try { value = JSON.parse(value); wasJsonText = true; } catch {}
      }
      const r = await walk(value, convert);
      if (!r.changed) continue;
      const out = type === "jsonb" || type === "json" ? JSON.stringify(r.value) : wasJsonText ? JSON.stringify(r.value) : r.value;
      await dbQuery(`UPDATE public."${t}" SET "${col}" = $1${type === "jsonb" ? "::jsonb" : type === "json" ? "::json" : ""} WHERE id = $2`, [out, row.id]);
      rows++;
    }
  }

  // Media library entries pointing at stock photos: re-point them at the S3 copy.
  const media = await dbQuery(
    `SELECT id, url, thumbnail_url FROM public.media WHERE url LIKE '%images.unsplash.com%' OR url LIKE '%res.cloudinary.com%' OR url LIKE 'data:image/%'`
  ).catch(() => ({ rows: [] as any[] }));
  for (const m of media.rows) {
    const url = await convert(m.url);
    const thumb = m.thumbnail_url ? await convert(m.thumbnail_url) : url;
    if (url !== m.url) {
      await dbQuery(`UPDATE public.media SET url = $1, thumbnail_url = $2, updated_at = NOW() WHERE id = $3`, [url, thumb, m.id]);
      rows++;
    }
  }
  // Inline base64 blur previews are no longer used — clear them so no image bytes remain in the database.
  const blur = await dbQuery(`UPDATE public.media SET blur_placeholder = NULL WHERE blur_placeholder LIKE 'data:%'`).catch(() => ({ rowCount: 0 } as any));
  rows += blur.rowCount || 0;
  return { moved, rows, errors };
}

/** Counts media still held in the database instead of S3 (base64 / stock-photo links). */
export async function auditDatabaseMedia(): Promise<Array<{ table: string; column: string; rows: number }>> {
  const cols = await dbQuery(
    `SELECT c.table_name, c.column_name FROM information_schema.columns c
       JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
      WHERE c.table_schema = 'public' AND c.data_type IN ('text', 'character varying', 'jsonb', 'json')`
  );
  const out: Array<{ table: string; column: string; rows: number }> = [];
  for (const { table_name: t, column_name: col } of cols.rows) {
    const r = await dbQuery(
      `SELECT COUNT(*)::int n FROM public."${t}" WHERE "${col}"::text LIKE '%;base64,%' OR "${col}"::text LIKE '%images.unsplash.com%' OR "${col}"::text LIKE '%res.cloudinary.com%'`
    ).catch(() => ({ rows: [{ n: 0 }] }));
    if (r.rows[0].n) out.push({ table: t, column: col, rows: r.rows[0].n });
  }
  return out;
}
