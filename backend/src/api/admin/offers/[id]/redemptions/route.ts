import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { RULES_MODULE } from "../../../../../modules/rules";

/**
 * GET /admin/offers/:id/redemptions
 * List all redemptions for a specific offer.
 * Supports optional ?customer_id= filter.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const rulesModule = req.scope.resolve(RULES_MODULE);

    const filters: Record<string, unknown> = {
        offer_id: req.params.id,
    };
    if (req.query.customer_id) filters.customer_id = req.query.customer_id;

    const redemptions = await rulesModule.listOfferRedemptions(filters);
    const count = redemptions.length;

    return res.status(200).json({ redemptions, count });
}
