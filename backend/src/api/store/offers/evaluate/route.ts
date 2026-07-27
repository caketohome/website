import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { RULES_MODULE } from "../../../../modules/rules";
import type { EvaluationContext } from "../../../../modules/rules/types/common";

/**
 * POST /store/offers/evaluate
 * Evaluate applicable offers for a cart context.
 * Used by checkout, cart, and any customer-facing flow to determine
 * which promotions apply.
 *
 * Returns the full structured EvaluationResult:
 *   - applied: qualifying offers with computed rewards
 *   - rejected: non-qualifying offers with reasons (useful for UI hints)
 *   - summary: aggregated discount, cashback, loyalty, free items, free delivery
 *   - metadata: evaluation timing for debugging
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
