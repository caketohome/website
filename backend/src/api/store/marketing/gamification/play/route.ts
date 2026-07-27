import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { MARKETING_MODULE } from "../../../../../modules/marketing";
import { SETTINGS_MODULE } from "../../../../../modules/settings";

/**
 * POST /store/marketing/gamification/play
 * Storefront — play a gamification widget (spin wheel / scratch card / lucky
 * draw). Gated by the `gamification` feature flag. The server picks a prize
 * using weighted random selection, records the outcome, and returns the
 * reward DTO. The actual reward issuance (coupon code, wallet credit, etc.)
 * is handled by the caller via the M2 Rules Engine — this endpoint only
 * selects + records.
 *
 * Body:
 *   widget_type: "spin_wheel" | "scratch_card" | "lucky_draw"
 *   name: string (widget/campaign name)
 *   prizes: GamificationPrizeConfig[]
 *   customer_id?: string
 *   session_id?: string
 *   daily_limit?: number
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const settingsModule = req.scope.resolve(SETTINGS_MODULE) as {
        isFeatureEnabled: (flag: string) => Promise<boolean>;
    };
    const marketingModule = req.scope.resolve(MARKETING_MODULE) as any;

    try {
        if (!(await settingsModule.isFeatureEnabled("gamification"))) {
            return res
                .status(400)
                .json({ message: "Gamification feature is currently disabled." });
        }

        const body = req.body as any;
        if (!body?.widget_type || !body?.prizes || !body?.name) {
            return res.status(400).json({
                message: "widget_type, name, and prizes are required",
            });
        }

        const reward = await marketingModule.playGamification({
            widget_type: body.widget_type,
            name: body.name,
            prizes: body.prizes,
            customer_id: body.customer_id ?? null,
            session_id: body.session_id ?? null,
            daily_limit: body.daily_limit,
        });
        return res.status(200).json({ reward });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return res.status(400).json({ message });
    }
}
