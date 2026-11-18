/**
 * Storefront behaviour events + "viewed but didn't buy" (browse abandonment) report.
 */

import { dbQuery } from "../db";

export const TRACKABLE_EVENTS = ["page_view", "product_view", "add_to_cart", "search"] as const;
export type TrackableEvent = (typeof TRACKABLE_EVENTS)[number];

const clip = (v: unknown, n: number) => (v == null ? null : String(v).slice(0, n));

export async function recordStorefrontEvent(e: {
  visitorId: string;
  customerId?: string | null;
  phone?: string | null;
  eventType: TrackableEvent;
  productId?: string | null;
  path?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await dbQuery(
    `INSERT INTO public.storefront_event (visitor_id, customer_id, phone, event_type, product_id, path, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [
      clip(e.visitorId, 64),
      clip(e.customerId, 128),
      clip(e.phone, 20),
      e.eventType,
      clip(e.productId, 128),
      clip(e.path, 300),
      JSON.stringify(e.metadata || {}),
    ]
  );
}

/**
 * Visitors who looked at cakes in the period and have not ordered since their last view.
 * Logged-in visitors come with a phone (actionable); anonymous ones are counted.
 */
export async function getBrowseAbandonment(params: { days?: number; limit?: number } = {}) {
  const days = Math.min(Math.max(Number(params.days) || 7, 1), 90);
  const limit = Math.min(Math.max(Number(params.limit) || 200, 1), 1000);
  const res = await dbQuery(
    `WITH v AS (
       SELECT visitor_id,
              MAX(customer_id) AS customer_id,
              MAX(phone) AS phone,
              COUNT(*) FILTER (WHERE event_type = 'page_view')::int AS page_views,
              COUNT(*) FILTER (WHERE event_type = 'product_view')::int AS product_views,
              COUNT(*) FILTER (WHERE event_type = 'add_to_cart')::int AS add_to_carts,
              ARRAY_REMOVE(ARRAY_AGG(DISTINCT product_id) FILTER (WHERE event_type IN ('product_view', 'add_to_cart')), NULL) AS product_ids,
              MIN(created_at) AS first_seen,
              MAX(created_at) AS last_seen
         FROM public.storefront_event
        WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')
        GROUP BY visitor_id
     )
     SELECT v.*,
            COALESCE(
              (SELECT string_agg(DISTINCT p.title, ', ') FROM public.product p WHERE p.id = ANY(v.product_ids)),
              ''
            ) AS products_viewed,
            CASE WHEN v.add_to_carts > 0 THEN 'added_to_cart'
                 WHEN v.product_views > 0 THEN 'viewed_cake'
                 ELSE 'visited' END AS stage
       FROM v
      WHERE NOT EXISTS (
              SELECT 1 FROM public."order" o
               WHERE o.deleted_at IS NULL
                 AND o.created_at >= v.first_seen
                 AND v.customer_id IS NOT NULL
                 AND (o.customer_id = v.customer_id OR o.metadata->>'customer_uid' = v.customer_id)
            )
      ORDER BY (v.customer_id IS NOT NULL) DESC, v.add_to_carts DESC, v.product_views DESC, v.last_seen DESC
      LIMIT $2`,
    [days, limit]
  );
  const rows = res.rows.map((r: any) => ({
    visitor_id: r.visitor_id,
    customer_id: r.customer_id,
    phone: r.phone,
    stage: r.stage as "visited" | "viewed_cake" | "added_to_cart",
    page_views: r.page_views,
    product_views: r.product_views,
    add_to_carts: r.add_to_carts,
    products_viewed: r.products_viewed,
    first_seen: r.first_seen,
    last_seen: r.last_seen,
  }));
  return {
    days,
    rows,
    summary: {
      visitors: rows.length,
      known: rows.filter((r) => r.customer_id).length,
      viewed_cake: rows.filter((r) => r.stage !== "visited").length,
      added_to_cart: rows.filter((r) => r.stage === "added_to_cart").length,
    },
  };
}
