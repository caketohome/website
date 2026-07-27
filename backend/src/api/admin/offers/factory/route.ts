import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { RULES_MODULE } from "../../../../modules/rules";

/**
 * POST /admin/offers/factory
 * Create a typed offer via the Phase 9.2 offer-type factory helpers. These
 * helpers build the canonical condition/reward JSON for each promotion type
 * and persist a standard M2 Offer row — no second promotion engine.
 *
 * Body:
 *   offer_type: "flash_sale" | "combo_discount" | "combo_offer" |
 *                "free_delivery" | "buy_x_get_y"
 *   ...type-specific fields (see helpers.ts for each factory's input shape)
 *
 * The response is the created Offer row.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const actorId = (req as any).auth_context?.actor_id as string | undefined;
    if (!actorId) {
        return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
    }
    const rulesModule = req.scope.resolve(RULES_MODULE) as any;
    const body = req.body as any;

    if (!body?.offer_type) {
        return res.status(400).json({ message: "offer_type is required" });
    }

    try {
        let offer: any;
        switch (body.offer_type) {
            case "flash_sale":
                offer = await rulesModule.createFlashSaleOffer(body);
                break;
            case "combo_discount":
                offer = await rulesModule.createComboDiscountOffer(body);
                break;
            case "combo_offer":
                offer = await rulesModule.createComboOffer(body);
                break;
            case "free_delivery":
                offer = await rulesModule.createFreeDeliveryOffer(body);
                break;
            case "buy_x_get_y":
                offer = await rulesModule.createBuyXGetYOffer(body);
                break;
            default:
                return res.status(400).json({
                    message: `Unknown offer_type: ${body.offer_type}`,
                });
        }
        return res.status(200).json({ offer });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return res.status(400).json({ message });
    }
}
