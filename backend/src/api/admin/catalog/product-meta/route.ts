import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CATALOG_MODULE } from "../../../../modules/catalog";
import zod from "zod";

const upsertSchema = zod.object({
    product_id: zod.string().min(1),
    eggless: zod.boolean().optional(),
    sugar_free: zod.boolean().optional(),
    gluten_free: zod.boolean().optional(),
    vegan: zod.boolean().optional(),
    ingredients: zod.string().optional(),
    allergens: zod.string().optional(),
    nutritional_info: zod.any().optional(),
    shelf_life: zod.string().optional(),
    storage_instructions: zod.string().optional(),
    fssai_license: zod.string().optional(),
    video_url: zod.string().optional(),
    is_featured: zod.boolean().optional(),
    is_bestseller: zod.boolean().optional(),
    is_new_arrival: zod.boolean().optional(),
    search_document: zod.string().optional(),
    meta: zod.any().optional(),
});

/**
 * GET /admin/catalog/product-meta
 * List all product meta records (with optional product_id filter).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const catalogModule = req.scope.resolve(CATALOG_MODULE) as {
        listProductMetaByProduct: (productIds: string[]) => Promise<unknown[]>;
    };

    const productId = req.query.product_id as string | undefined;
    const metas = await catalogModule.listProductMetaByProduct(productId ? [productId] : []);
    return res.status(200).json({ metas });
}

/**
 * POST /admin/catalog/product-meta
 * Upsert product meta for a product.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const parsed = upsertSchema.safeParse(req.body);
    if (!parsed.success) {
        return res
            .status(400)
            .json({ message: "Invalid product meta.", errors: parsed.error.flatten() });
    }

    const catalogModule = req.scope.resolve(CATALOG_MODULE) as {
        upsertProductMeta: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
    };

    const meta = await catalogModule.upsertProductMeta(parsed.data);
    return res.status(200).json({ meta });
}
