import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { AI_MODULE } from "../../../../../modules/ai";
import { CATALOG_MODULE } from "../../../../../modules/catalog";
import { ContainerRegistrationKeys } from "@medusajs/utils";

/**
 * POST /admin/catalog/ai/generate-description
 *
 * Generates a product description from the product's attributes using the
 * AI Module (M9). The generated description is returned to the admin for
 * review; it is NOT auto-applied (admin confirms before saving).
 *
 * Body: { product_id: string }
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const { product_id } = req.body as { product_id?: string };
    if (!product_id) {
        return res.status(400).json({ message: "product_id is required." });
    }

    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
        graph: (q: {
            entity: string;
            filters: Record<string, unknown>;
            fields?: string[];
        }) => Promise<{ data: Record<string, unknown>[] }>;
    };

    const { data } = await query.graph({
        entity: "product",
        filters: { id: product_id },
        fields: ["id", "title", "description", "categories.name"],
    });

    const product = data[0];
    if (!product) {
        return res.status(404).json({ message: "Product not found." });
    }

    const catalogModule = req.scope.resolve(CATALOG_MODULE) as {
        getProductMeta: (productId: string) => Promise<Record<string, unknown> | null>;
    };
    const meta = await catalogModule.getProductMeta(product_id);

    const categories = (product.categories as Array<{ name: string }> | undefined)
        ?.map((c) => c.name)
        .filter(Boolean)
        .join(", ");

    const dietary: string[] = [];
    if (meta?.eggless) dietary.push("eggless");
    if (meta?.sugar_free) dietary.push("sugar-free");
    if (meta?.gluten_free) dietary.push("gluten-free");
    if (meta?.vegan) dietary.push("vegan");

    const prompt = [
        `Write an enticing, SEO-friendly product description for a cake product.`,
        `Product name: ${product.title}`,
        categories ? `Categories: ${categories}` : null,
        dietary.length > 0 ? `Dietary attributes: ${dietary.join(", ")}` : null,
        meta?.ingredients ? `Key ingredients: ${meta.ingredients}` : null,
        meta?.allergens ? `Allergens: ${meta.allergens}` : null,
        `Keep it under 200 words. Highlight taste, occasion suitability, and freshness.`,
    ]
        .filter(Boolean)
        .join("\n");

    const aiModule = req.scope.resolve(AI_MODULE) as {
        complete: (input: {
            prompt: string;
            system?: string;
            max_tokens?: number;
            temperature?: number;
        }) => Promise<{ text: string }>;
    };

    const result = await aiModule.complete({
        prompt,
        system:
            "You are a professional copywriter for CakeToHome, a premium online cake ordering platform.",
        max_tokens: 300,
        temperature: 0.7,
    });

    return res.status(200).json({ description: result.text });
}
