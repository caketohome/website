import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CATALOG_MODULE } from "../../../../modules/catalog";

/**
 * GET /admin/catalog/reviews
 * List reviews for moderation. Query params: product_id, status, limit, offset.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const catalogModule = req.scope.resolve(CATALOG_MODULE) as {
        listReviews: (opts: Record<string, unknown>) => Promise<unknown[]>;
    };

    const opts: Record<string, unknown> = {
        limit: req.query.limit ? Number(req.query.limit) : 50,
        offset: req.query.offset ? Number(req.query.offset) : 0,
    };
    if (req.query.product_id) opts.productId = req.query.product_id as string;
    if (req.query.status) opts.status = req.query.status as string;

    const reviews = await catalogModule.listReviews(opts);
    return res.status(200).json({ reviews });
}
