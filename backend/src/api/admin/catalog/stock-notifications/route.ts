import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CATALOG_MODULE } from "../../../../modules/catalog";

/**
 * GET /admin/catalog/stock-notifications
 * List stock-notification requests. Query params: product_id, status.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const catalogModule = req.scope.resolve(CATALOG_MODULE) as {
        listStockNotifications: (filters: Record<string, unknown>) => Promise<unknown[]>;
    };

    const filters: Record<string, unknown> = {};
    if (req.query.product_id) filters.product_id = req.query.product_id as string;
    if (req.query.status) filters.status = req.query.status as string;

    const notifications = await catalogModule.listStockNotifications(filters);
    return res.status(200).json({ notifications });
}
