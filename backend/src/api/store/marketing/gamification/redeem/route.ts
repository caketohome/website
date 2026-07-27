import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { MARKETING_MODULE } from "../../../../../modules/marketing";
import { SETTINGS_MODULE } from "../../../../../modules/settings";

/**
 * POST /store/marketing/gamification/redeem
 * Storefront — mark a gamification reward as redeemed (customer claimed the
 * prize). Gated by the `gamification` feature flag.
 *
 * Body:
 *   reward_id: string (required)
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
        if (!body?.reward_id) {
            return res.status(400).json({ message: "reward_id is required" });
        }

        const reward = await marketingModule.markGamificationRewardRedeemed(
            body.reward_id
        );
        return res.status(200).json({ reward });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return res.status(400).json({ message });
    }
}
