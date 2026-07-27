import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { AI_MODULE } from "../../../../modules/ai";

/**
 * POST /admin/ai/complete
 * Generate text completion (AI SEO, product descriptions, etc.)
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const aiModule = req.scope.resolve(AI_MODULE);

    const body = req.body as {
        prompt: string;
        system?: string;
        max_tokens?: number;
        temperature?: number;
    };

    if (!body.prompt) {
        return res.status(400).json({ message: "prompt is required" });
    }

    const result = await aiModule.complete({
        prompt: body.prompt,
        system: body.system,
        max_tokens: body.max_tokens,
        temperature: body.temperature,
    });

    return res.status(200).json({ result });
}
