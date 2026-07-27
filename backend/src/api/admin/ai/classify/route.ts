import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { AI_MODULE } from "../../../../modules/ai";

/**
 * POST /admin/ai/classify
 * Classify input into categories (fraud detection, customer segmentation).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const aiModule = req.scope.resolve(AI_MODULE);

    const body = req.body as {
        input: string;
        categories: string[];
    };

    if (!body.input || !Array.isArray(body.categories)) {
        return res.status(400).json({ message: "input and categories are required" });
    }

    const result = await aiModule.classify({
        input: body.input,
        categories: body.categories,
    });

    return res.status(200).json({ result });
}
