import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ANALYTICS_MODULE } from "../../../../modules/analytics";

/**
 * GET /store/products/recently-viewed
 * Customer-authenticated — returns the customer's recently viewed products.
 *
 * Recently-viewed is derived from the Analytics Module (M5) `product_view`
 * events for the authenticated customer, deduplicated and ordered by
 * recency. This avoids a dedicated model (DRY) while still supporting
 * server-side sync across devices for logged-in customers.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const customerId = (req as any).auth_context?.actor_id as string | undefined;
    if (!customerId) {
        return res.status(200).json({ product_ids: [] });
    }

    const analyticsModule = req.scope.resolve(ANALYTICS_MODULE) as unknown as {
        listAnalyticsEvents: (filters: Record<string, unknown>) => Promise<Record<string, unknown>[]>;
    };

    const events = (await analyticsModule.listAnalyticsEvents({
        event_type: "product_view",
        customer_id: customerId,
    })) as Array<{ entity_id: string | null; created_at: Date }>;

    // Deduplicate by product id, keeping the most recent occurrence.
    const seen = new Map<string, number>();
    for (const e of events) {
        if (!e.entity_id) continue;
        const ts = e.created_at instanceof Date ? e.created_at.getTime() : 0;
        if (!seen.has(e.entity_id) || ts > seen.get(e.entity_id)!) {
            seen.set(e.entity_id, ts);
        }
    }

    const productIds = Array.from(seen.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([id]) => id)
        .slice(0, 20);

    return res.status(200).json({ product_ids: productIds });
}

/**
 * POST /store/products/recently-viewed
 * Customer-authenticated — record a product view (server-side sync).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const { product_id } = req.body as { product_id?: string };
    if (!product_id) {
        return res.status(400).json({ message: "product_id is required." });
    }

    const customerId = (req as any).auth_context?.actor_id as string | undefined;
    const analyticsModule = req.scope.resolve(ANALYTICS_MODULE) as any;

    await analyticsModule.track({
        event_type: "product_view",
        entity_id: product_id,
        customer_id: customerId ?? null,
    });

    return res.status(200).json({ tracked: true });
}
