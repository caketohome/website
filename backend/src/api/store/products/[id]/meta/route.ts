import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CATALOG_MODULE } from "../../../../../modules/catalog";

/**
 * GET /store/products/:id/meta
 * Public — returns the cake-specific product metadata for a product.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const catalogModule = req.scope.resolve(CATALOG_MODULE) as {
        getProductMeta: (productId: string) => Promise<unknown>;
    };
    const productId = req.params.id;
    const meta = await catalogModule.getProductMeta(productId);
    return res.status(200).json({ meta });
}
