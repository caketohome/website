import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CATALOG_MODULE } from "../../../../../modules/catalog";

/**
 * GET /store/products/:id/cake-options
 * Exposes active cake option customizations configured for the product.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const { id } = req.params;
    const catalogModule = req.scope.resolve(CATALOG_MODULE) as any;

    try {
        const options = await catalogModule.listCakeOptions({
            product_id: id,
        });

        // Parse JSON values for options
        const parsedOptions = options.map((opt: any) => {
            let values = [];
            try {
                values = JSON.parse(opt.values);
            } catch {
                values = [];
            }
            return {
                id: opt.id,
                product_id: opt.product_id,
                option_type: opt.option_type,
                values,
                price_delta: opt.price_delta,
            };
        });

        return res.status(200).json({ cake_options: parsedOptions });
    } catch (e) {
        console.error("Failed to load cake options", e);
        return res.status(500).json({ message: "Failed to load cake options" });
    }
}
