import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { AI_MODULE } from "../../../../../modules/ai";
import { ContainerRegistrationKeys } from "@medusajs/utils";

/**
 * POST /admin/catalog/ai/generate-seo-meta
 *
 * Generates SEO meta title + meta description for a product using the AI
 * Module (M9). Returned for admin review; not auto-applied.
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
        fields: ["id", "title", "description", "handle"],
    });

    const product = data[0];
    if (!product) {
        return res.status(404).json({ message: "Product not found." });
    }

    const prompt = [
        `Generate SEO metadata for a cake product page.`,
        `Product name: ${product.title}`,
        product.description ? `Description: ${product.description}` : null,
        `Return JSON with keys: "meta_title" (max 60 chars), "meta_description" (max 160 chars).`,
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
            "You are an SEO specialist for CakeToHome. Respond ONLY with valid JSON.",
        max_tokens: 200,
        temperature: 0.4,
    });

    // Best-effort JSON parse; fall back to raw text.
    let parsed: { meta_title?: string; meta_description?: string } | null = null;
    try {
        parsed = JSON.parse(result.text);
    } catch {
        parsed = null;
    }

    return res.status(200).json({
        meta_title: parsed?.meta_title ?? result.text,
        meta_description: parsed?.meta_description ?? null,
        raw: result.text,
    });
}
