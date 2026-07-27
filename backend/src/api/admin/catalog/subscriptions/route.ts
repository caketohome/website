import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CATALOG_MODULE } from "../../../../modules/catalog";

/**
 * GET /admin/catalog/subscriptions
 * List all subscriptions (admin). Query params: customer_id, status, limit, offset.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const catalogModule = req.scope.resolve(CATALOG_MODULE) as {
        listSubscriptions: (filters: Record<string, unknown>, config?: Record<string, unknown>) => Promise<unknown[]>;
    };

    const filters: Record<string, unknown> = {};
    if (req.query.customer_id) filters.customer_id = req.query.customer_id as string;
    if (req.query.status) filters.status = req.query.status as string;

    const config: Record<string, unknown> = {
        take: req.query.limit ? Number(req.query.limit) : 50,
        skip: req.query.offset ? Number(req.query.offset) : 0,
    };

    const subscriptions = await catalogModule.listSubscriptions(filters, config);
    return res.status(200).json({ subscriptions });
}
