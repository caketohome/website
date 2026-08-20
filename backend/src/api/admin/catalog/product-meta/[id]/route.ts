import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CATALOG_MODULE } from "../../../../../modules/catalog";
import zod from "zod";

const updateSchema = zod.object({
    artisan: zod.boolean().optional(),
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
 * POST /admin/catalog/product-meta/:id
 * Update product meta (id is the product_id).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
        return res
            .status(400)
            .json({ message: "Invalid product meta.", errors: parsed.error.flatten() });
    }

    const catalogModule = req.scope.resolve(CATALOG_MODULE) as {
        updateProductMeta: (
            productId: string,
            input: Record<string, unknown>
        ) => Promise<Record<string, unknown>>;
    };

    const meta = await catalogModule.updateProductMeta(req.params.id, parsed.data);
    return res.status(200).json({ meta });
}

/**
 * DELETE /admin/catalog/product-meta/:id
 * Delete product meta (id is the product_id).
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
    const catalogModule = req.scope.resolve(CATALOG_MODULE) as {
        deleteProductMeta: (productId: string) => Promise<void>;
    };
    await catalogModule.deleteProductMeta(req.params.id);
    return res.status(200).json({ deleted: true });
}
