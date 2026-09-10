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
        listApprovedReviews: (productId: string, config?: { take?: number; skip?: number; order?: Record<string, string> }) => Promise<unknown[]>;
        getReviewAggregate: (productId: string) => Promise<unknown>;
    };
    const productId = req.params.id;

    const limit = Math.min(Math.max(1, req.query.limit ? Number(req.query.limit) : 20), 100);
    const offset = Math.max(0, req.query.offset ? Number(req.query.offset) : 0);

    const reviews = (await catalogModule.listApprovedReviews(productId, {
        take: limit,
        skip: offset,
        order: { created_at: "DESC", id: "DESC" },
    })) as unknown[];
    const aggregate = await catalogModule.getReviewAggregate(productId);

    return res.status(200).json({
        reviews,
        count: reviews.length,
        limit,
        offset,
        aggregate,
        pagination: {
            page: Math.floor(offset / limit) + 1,
            pageSize: limit,
            hasNextPage: reviews.length >= limit,
            hasPreviousPage: offset > 0,
        },
    });
}
