import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { RULES_MODULE } from "../../../../modules/rules";
import type { EvaluationContext } from "../../../../modules/rules/types/common";

/**
 * POST /admin/offers/evaluate
 * Admin-only evaluation endpoint for testing promotions.
 * Accepts a cart context and returns the full structured evaluation result
 * including applied/rejected offers, reasons, and debugging metadata.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const rulesModule = req.scope.resolve(RULES_MODULE);

    const body = req.body as EvaluationContext;

    if (!body || typeof body.subtotal !== "number") {
        return res.status(400).json({
            message: "subtotal is required and must be a number",
        });
    }

    const result = await rulesModule.evaluate({
        ...body,
        items: body.items ?? [],
    });

    return res.status(200).json({ result });
}
