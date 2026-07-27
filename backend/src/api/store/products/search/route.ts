import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/utils";
import { CATALOG_MODULE } from "../../../../modules/catalog";
import { ANALYTICS_MODULE } from "../../../../modules/analytics";

/**
 * GET /store/products/search
 *
 * Full-text + faceted product search for the CakeToHome storefront.
 *
 * Query params:
 *   q            — search query (title + description)
 *   category_id  — filter by category (repeatable)
 *   shop_id       — filter by shop
 *   min_price     — minimum price
 *   max_price     — maximum price
 *   eggless, sugar_free, gluten_free, vegan — dietary filters
 *   is_featured, is_bestseller, is_new_arrival — merchandising filters
 *   sort          — relevance | price_asc | price_desc | newest | rating
 *   limit, offset — pagination
 *
 * The search query is tracked via the Analytics Module (M5).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const catalogModule = req.scope.resolve(CATALOG_MODULE) as {
        searchProducts: (
            filters: Record<string, unknown>,
            container: Record<string, unknown>
        ) => Promise<{
            results: unknown[];
            count: number;
            offset: number;
            limit: number;
        }>;
    };

    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

    const filters: Record<string, unknown> = {};

    const q = req.query.q as string | undefined;
    if (q) filters.q = q;

    const categoryId = req.query.category_id as string | string[] | undefined;
    if (categoryId) filters.category_id = categoryId;

    const shopId = req.query.shop_id as string | undefined;
    if (shopId) filters.shop_id = shopId;

    const minPrice = req.query.min_price as string | undefined;
    if (minPrice) filters.min_price = Number(minPrice);

    const maxPrice = req.query.max_price as string | undefined;
    if (maxPrice) filters.max_price = Number(maxPrice);

    for (const flag of [
        "eggless",
        "sugar_free",
        "gluten_free",
        "vegan",
        "is_featured",
        "is_bestseller",
        "is_new_arrival",
    ]) {
        const val = req.query[flag] as string | undefined;
        if (val === "true" || val === "1") filters[flag] = true;
    }

    const sort = req.query.sort as string | undefined;
    if (sort) filters.sort = sort;

    const limit = req.query.limit ? Number(req.query.limit) : 24;
    const offset = req.query.offset ? Number(req.query.offset) : 0;
    filters.limit = limit;
    filters.offset = offset;

    const result = await catalogModule.searchProducts(filters, { query });

    // Track the search query for analytics (best-effort).
    if (q) {
        try {
            const analyticsModule = req.scope.resolve(ANALYTICS_MODULE) as any;
            await analyticsModule.track({
                event_type: "search",
                payload: { query: q, result_count: result.count },
            });
        } catch {
            // Analytics is best-effort.
        }
    }

    return res.status(200).json(result);
}
