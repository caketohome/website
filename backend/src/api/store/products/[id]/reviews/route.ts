import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CATALOG_MODULE } from "../../../../../modules/catalog";

/**
 * GET /store/products/:id/reviews
 * Public — list approved reviews + aggregate rating for a product.
 *
 * Query params:
 *   limit, offset — pagination
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const catalogModule = req.scope.resolve(CATALOG_MODULE) as {
        listApprovedReviews: (productId: string) => Promise<unknown[]>;
        getReviewAggregate: (productId: string) => Promise<unknown>;
    };
    const productId = req.params.id;

    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const offset = req.query.offset ? Number(req.query.offset) : 0;

    const reviews = (await catalogModule.listApprovedReviews(productId)) as unknown[];
    const aggregate = await catalogModule.getReviewAggregate(productId);

    const paged = reviews.slice(offset, offset + limit);

    return res.status(200).json({
        reviews: paged,
        count: reviews.length,
        aggregate,
    });
}
