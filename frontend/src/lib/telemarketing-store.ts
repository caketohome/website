/**
 * Database persistence for the telemarketing call list + real order history for the reminder scan.
 * The engine keeps working in memory; routes call ensureTelemarketingLoaded() before reading and
 * saveTelemarketing() after any change, so notes/statuses survive restarts and redeploys.
 */

import { dbQuery } from "./db";
import { TelemarketingEngine, type ReorderCandidate } from "./telemarketing-engine";

const g = globalThis as any;

export async function ensureTelemarketingLoaded(force = false): Promise<void> {
  if (g.__cthTmLoaded && !force) return;
  try {
    const r = await dbQuery(`SELECT data FROM public.telemarketing_candidate ORDER BY expected_date NULLS LAST, created_at`);
    TelemarketingEngine.importAll(r.rows.map((x: any) => x.data as ReorderCandidate));
    g.__cthTmLoaded = true;
  } catch (e: any) {
    console.warn("[telemarketing] load failed:", e.message);
  }
}

export async function saveTelemarketing(): Promise<void> {
  const list = TelemarketingEngine.exportAll();
  if (!list.length) return;
  const payload = JSON.stringify(
    list.map((c) => ({
      id: c.id,
      dedupe_key: c.dedupe_key,
      customer_uid: c.customer_uid || null,
      expected_date: /^\d{4}-\d{2}-\d{2}$/.test(String((c as any).expected_date || "")) ? (c as any).expected_date : null,
      priority: (c as any).priority || null,
      contact_status: (c as any).contact_status || null,
      data: c,
    }))
  );
  await dbQuery(
    `INSERT INTO public.telemarketing_candidate (id, dedupe_key, customer_uid, expected_date, priority, contact_status, data, updated_at)
     SELECT x.id, x.dedupe_key, x.customer_uid, x.expected_date::date, x.priority, x.contact_status, x.data, NOW()
       FROM jsonb_to_recordset($1::jsonb) AS x(id text, dedupe_key text, customer_uid text, expected_date text, priority text, contact_status text, data jsonb)
     ON CONFLICT (dedupe_key) DO UPDATE SET
       customer_uid = EXCLUDED.customer_uid, expected_date = EXCLUDED.expected_date, priority = EXCLUDED.priority,
       contact_status = EXCLUDED.contact_status, data = EXCLUDED.data, updated_at = NOW()`,
    [payload]
  );
}

/** Real, non-test orders from the last 3 years, shaped for TelemarketingEngine.evaluateHistoricalOrders. */
export async function loadOrdersForTelemarketing(): Promise<any[]> {
  const r = await dbQuery(
    `SELECT o.id, o.order_number, o.status::text AS status, o.created_at, o.customer_id, o.branch_id,
            COALESCE(o.customer_name, o.metadata->>'customer_name') AS customer_name,
            COALESCE(o.customer_phone, o.metadata->>'customer_phone') AS customer_phone,
            COALESCE(o.email, o.metadata->>'customer_email') AS customer_email,
            o.metadata->>'customer_uid' AS customer_uid,
            COALESCE(o.metadata->'delivery'->>'date', o.metadata->>'delivery_date') AS delivery_date,
            o.metadata->>'occasion' AS occasion,
            COALESCE(o.grand_total, NULLIF(o.metadata->>'total','')::numeric, 0)::float AS total,
            COALESCE(o.metadata->>'delivery_city', o.metadata->'delivery_address'->>'city', o.metadata->>'city') AS city,
            o.metadata->>'delivery_pincode' AS pincode,
            o.metadata->'items' AS items
       FROM public."order" o
      WHERE o.deleted_at IS NULL
        AND o.created_at >= NOW() - INTERVAL '3 years'
        AND LOWER(o.status::text) NOT IN ('cancelled', 'canceled', 'draft', 'abandoned', 'refunded')
        AND COALESCE(o.metadata->>'classification', '') NOT IN ('TEST', 'PROTOTYPE')
      ORDER BY o.created_at
      LIMIT 20000`
  );
  return r.rows.map((o: any) => ({
    ...o,
    items: Array.isArray(o.items) ? o.items.map((i: any) => ({ ...i, name: i.title || i.product_name || i.name })) : [],
    customer_uid: o.customer_uid || undefined,
  }));
}

// ── Save on change (server only: this module is imported only by API routes) ──
// Any change to the call list is saved to public.telemarketing_candidate (debounced).
if (!g.__cthTmHooked) {
  g.__cthTmHooked = true;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const scheduleSave = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      saveTelemarketing().catch((e) => console.warn("[telemarketing] save failed:", e?.message));
    }, 250);
  };
  const engine = TelemarketingEngine as any;
  for (const name of ["evaluateHistoricalOrders", "logCall", "updateCandidateStatus", "assignCandidate", "recordAttributedOrder", "matchAndAttributeCheckoutOrder"]) {
    const original = engine[name].bind(engine);
    engine[name] = (...args: any[]) => {
      const result = original(...args);
      scheduleSave();
      return result;
    };
  }
}
