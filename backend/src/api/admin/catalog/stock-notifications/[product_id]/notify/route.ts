import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CATALOG_MODULE } from "../../../../../../modules/catalog";

/**
 * POST /admin/catalog/stock-notifications/:product_id/notify
 * Mark all pending stock notifications for a product as notified.
 * Called by an admin (or the restock workflow) after a product is restocked.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const catalogModule = req.scope.resolve(CATALOG_MODULE) as {
        markStockNotified: (productId: string) => Promise<number>;
    };
    const count = await catalogModule.markStockNotified(req.params.product_id);
    return res.status(200).json({ notified: count });
}
