/**
 * Cart recovery data in Supabase.
 *  - Real carts come from public.cart + public.cart_line_item (carts that were never turned into an order).
 *  - Recovery state (status, assigned telecaller, attempts, history) is saved in
 *    public.cart_recovery / public.cart_recovery_event so it survives restarts.
 * The in-memory engine keeps working as before; this module fills it from Supabase and saves it back.
 */
import { dbQuery } from "../db";

const g = globalThis as any;

/** Load saved recovery records once per server process. */
async function loadSavedRecovery(store: any) {
  if (g.__cthRecoveryLoaded) return;
  const recs = await dbQuery(`SELECT record FROM public.cart_recovery ORDER BY updated_at DESC LIMIT 2000`);
  const evs = await dbQuery(`SELECT event FROM public.cart_recovery_event ORDER BY created_at DESC LIMIT 5000`);
  const byId = new Map<string, any>((store.abandoned_carts || []).map((r: any) => [r.id, r]));
  for (const row of recs.rows) {
    const r = typeof row.record === "string" ? JSON.parse(row.record) : row.record;
    if (r?.id && !byId.has(r.id)) byId.set(r.id, r);
  }
  store.abandoned_carts = Array.from(byId.values());
  const evIds = new Set((store.recovery_events || []).map((e: any) => e.id));
  const loadedEvents = evs.rows.map((r: any) => (typeof r.event === "string" ? JSON.parse(r.event) : r.event)).filter((e: any) => e?.id && !evIds.has(e.id));
  store.recovery_events = [...(store.recovery_events || []), ...loadedEvents];
  g.__cthRecoveryLoaded = true;
}

/** Pull real, not-yet-ordered carts with items from Supabase into the engine's cart list. */
async function loadDbCarts(store: any) {
  const carts = await dbQuery(
    `SELECT c.id, c.status, c.customer_id, c.email, c.customer_email, c.branch_id, c.subtotal, c.total, c.metadata, c.created_at, c.updated_at
       FROM public.cart c
      WHERE c.deleted_at IS NULL
        AND UPPER(COALESCE(c.status, 'ACTIVE')) IN ('ACTIVE', 'ABANDONED')
        AND EXISTS (SELECT 1 FROM public.cart_line_item li WHERE li.cart_id = c.id AND li.deleted_at IS NULL)
        AND NOT EXISTS (SELECT 1 FROM public."order" o WHERE o.deleted_at IS NULL AND o.metadata->>'cart_id' = c.id)
      ORDER BY c.updated_at DESC
      LIMIT 500`
  );
  if (carts.rows.length === 0) return;
  const ids = carts.rows.map((r: any) => r.id);
  const items = await dbQuery(
    `SELECT cart_id, id, product_id, variant_id, title, product_title, thumbnail, quantity, unit_price, subtotal, weight, flavour
       FROM public.cart_line_item WHERE deleted_at IS NULL AND cart_id = ANY($1::text[])`,
    [ids]
  );
  const realBranches = new Set(
    (await dbQuery(`SELECT id FROM public.branch WHERE deleted_at IS NULL`)).rows.map((r: any) => r.id)
  );
  const itemsByCart = new Map<string, any[]>();
  for (const it of items.rows) {
    const list = itemsByCart.get(it.cart_id) || [];
    list.push({
      id: it.id,
      product_id: it.product_id,
      variant_id: it.variant_id,
      title: it.title || it.product_title || "Item",
      thumbnail: it.thumbnail || "",
      quantity: Number(it.quantity) || 1,
      unit_price: Number(it.unit_price) || 0,
      subtotal: Number(it.subtotal) || (Number(it.unit_price) || 0) * (Number(it.quantity) || 1),
      weight: it.weight || "",
      flavour: it.flavour || "",
    });
    itemsByCart.set(it.cart_id, list);
  }
  if (!Array.isArray(store.carts)) store.carts = [];
  const byId = new Map<string, any>(store.carts.map((c: any) => [c.id, c]));
  for (const c of carts.rows) {
    const meta = c.metadata || {};
    const list = itemsByCart.get(c.id) || [];
    const subtotal = list.reduce((s, i) => s + i.subtotal, 0) || Number(c.subtotal || c.total || 0);
    const existing = byId.get(c.id) || {};
    byId.set(c.id, {
      ...existing,
      id: c.id,
      status: existing.status === "ABANDONED" ? "ABANDONED" : String(c.status || "ACTIVE").toUpperCase(),
      items: list,
      subtotal,
      total: subtotal,
      branch_id: c.branch_id && realBranches.has(c.branch_id) ? c.branch_id : null,
      customer_phone: meta.customer_phone || existing.customer_phone || "",
      customer_name: meta.customer_name || existing.customer_name || "",
      customer_email: c.customer_email || c.email || existing.customer_email || "",
      customer_id: c.customer_id || null,
      created_at: c.created_at,
      updated_at: c.updated_at,
      last_activity_at: c.updated_at,
    });
  }
  store.carts = Array.from(byId.values());
}

/** Fill the engine from Supabase before the Cart Recovery screen reads it. */
export async function syncCartRecoveryFromDb(store: any) {
  if (!process.env.DATABASE_URL || !store) return;
  await loadSavedRecovery(store);
  await loadDbCarts(store);
}

/** Save recovery records + history to Supabase (called after the engine changes them). */
export async function saveCartRecoveryToDb(store: any) {
  if (!process.env.DATABASE_URL || !store) return;
  const records: any[] = Array.isArray(store.abandoned_carts) ? store.abandoned_carts : [];
  for (const r of records) {
    if (!r?.id) continue;
    await dbQuery(
      `INSERT INTO public.cart_recovery (cart_id, record, status, phone, branch_id, updated_at)
       VALUES ($1, $2::jsonb, $3, $4, $5, NOW())
       ON CONFLICT (cart_id) DO UPDATE SET record = EXCLUDED.record, status = EXCLUDED.status,
         phone = EXCLUDED.phone, branch_id = EXCLUDED.branch_id, updated_at = NOW()
       WHERE public.cart_recovery.record IS DISTINCT FROM EXCLUDED.record`,
      [r.id, JSON.stringify(r), r.recovery_status || r.status || null, r.normalized_phone || null, r.branch_id || null]
    );
  }
  const events: any[] = Array.isArray(store.recovery_events) ? store.recovery_events : [];
  for (const e of events) {
    if (!e?.id || !e.cart_id) continue;
    await dbQuery(
      `INSERT INTO public.cart_recovery_event (id, cart_id, event, created_at)
       VALUES ($1, $2, $3::jsonb, COALESCE($4::timestamptz, NOW()))
       ON CONFLICT (id) DO NOTHING`,
      [e.id, e.cart_id, JSON.stringify(e), e.created_at || null]
    );
  }
}

/** Debounced save after any engine change (keeps recovery state durable without slowing requests). */
export function scheduleCartRecoverySave(store: any) {
  if (typeof window !== "undefined" || !process.env.DATABASE_URL) return;
  if (!g.__cthRecoveryLoaded) return; // never overwrite saved state before it was loaded
  if (g.__cthRecoverySaveTimer) clearTimeout(g.__cthRecoverySaveTimer);
  g.__cthRecoverySaveTimer = setTimeout(() => {
    saveCartRecoveryToDb(store).catch((err: any) => console.error("[CartRecovery] save failed:", err?.message));
  }, 1500);
  g.__cthRecoverySaveTimer?.unref?.();
}
