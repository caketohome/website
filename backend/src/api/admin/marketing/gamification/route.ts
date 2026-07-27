import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { MARKETING_MODULE } from "../../../../modules/marketing";

/**
 * GET /admin/marketing/gamification
 * List all gamification reward records with optional filters.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const marketingModule = req.scope.resolve(MARKETING_MODULE) as any;
    const filters: Record<string, unknown> = {};
    if (req.query.widget_type) filters.widget_type = req.query.widget_type;
    if (req.query.customer_id) filters.customer_id = req.query.customer_id;
    if (req.query.outcome) filters.outcome = req.query.outcome;
    const rewards = await marketingModule.listGamificationRewardsDTO(filters);
    return res.status(200).json({ rewards });
}

/**
 * POST /admin/marketing/gamification
 * Create a gamification reward record manually (admin-issued).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const marketingModule = req.scope.resolve(MARKETING_MODULE) as any;
    const body = req.body as any;
    if (!body?.widget_type || !body?.name) {
        return res
            .status(400)
            .json({ message: "widget_type and name are required" });
    }
    try {
        const reward = await marketingModule.createGamificationReward(body);
        return res.status(200).json({ reward });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return res.status(400).json({ message });
    }
}
