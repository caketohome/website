import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { RULES_MODULE } from "../../../../modules/rules";

/**
 * POST /admin/offers/bulk
 * Bulk-generate N unique coupon codes backed by N distinct Offer rows.
 * Delegates to `rulesModuleService.bulkGenerateCoupons` (Phase 9.2 helper
 * attached to the Rules engine prototype). This does NOT introduce a second
 * promotion engine — every coupon is a standard M2 Offer row evaluated by
 * the existing `evaluate()` path.
 *
 * Body:
 *   count: number (1..10000)
 *   prefix: string
 *   name_prefix: string
 *   type: "coupon" | "promo_code"
 *   discount_percent?: number
 *   discount_fixed?: number
 *   code_length?: number
 *   starts_at?, ends_at?, usage_limit?, per_customer_limit?, is_stackable?
 *   branch_ids?: string[]
 *   customer_segments?: string[]
 *   description?: string
 *   metadata?: Record<string, unknown>
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const actorId = (req as any).auth_context?.actor_id as string | undefined;
    if (!actorId) {
        return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
    }
    const rulesModule = req.scope.resolve(RULES_MODULE) as any;
    const body = req.body as any;

    if (!body?.count || !body?.prefix || !body?.name_prefix || !body?.type) {
        return res.status(400).json({
            message: "count, prefix, name_prefix, and type are required",
        });
    }
    if (body.type !== "coupon" && body.type !== "promo_code") {
        return res.status(400).json({
            message: "type must be 'coupon' or 'promo_code'",
        });
    }
    if (body.discount_percent === undefined && body.discount_fixed === undefined) {
        return res.status(400).json({
            message: "discount_percent or discount_fixed is required",
        });
    }

    try {
        const offers = await rulesModule.bulkGenerateCoupons(body);
        return res
            .status(200)
            .json({ offers, count: offers.length });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return res.status(400).json({ message });
    }
}
