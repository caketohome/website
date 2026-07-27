import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CATALOG_MODULE } from "../../../../modules/catalog";
import zod from "zod";

const upsertSchema = zod.object({
    product_id: zod.string().min(1),
    option_type: zod.string().min(1),
    values: zod.array(zod.string()).min(1),
    price_delta: zod.number().optional(),
});

/**
 * GET /admin/catalog/cake-options
 * List all cake options (optionally filtered by product_id).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const catalogModule = req.scope.resolve(CATALOG_MODULE) as any;

    const productId = req.query.product_id as string | undefined;

    try {
        const filter = productId ? { product_id: productId } : {};
        const options = await catalogModule.listCakeOptions(filter);

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
        console.error("Failed to list cake options", e);
        return res.status(500).json({ message: "Failed to list cake options" });
    }
}

/**
 * POST /admin/catalog/cake-options
 * Upsert cake options for a product.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const parsed = upsertSchema.safeParse(req.body);
    if (!parsed.success) {
        return res
            .status(400)
            .json({ message: "Invalid cake options payload.", errors: parsed.error.flatten() });
    }

    const catalogModule = req.scope.resolve(CATALOG_MODULE) as any;

    try {
        const option = await catalogModule.upsertProductCakeOption(parsed.data);
        return res.status(200).json({ cake_option: option });
    } catch (e) {
        console.error("Failed to upsert cake option", e);
        return res.status(500).json({ message: "Failed to upsert cake option" });
    }
}
