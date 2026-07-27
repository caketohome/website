import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CATALOG_MODULE } from "../../../../../modules/catalog";
import { SETTINGS_MODULE } from "../../../../../modules/settings";

/**
 * POST /store/subscriptions/:id/cancel
 * Customer-authenticated — cancel a subscription.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const settingsModule = req.scope.resolve(SETTINGS_MODULE) as {
        isFeatureEnabled: (key: string) => Promise<boolean>;
    };
    if (!(await settingsModule.isFeatureEnabled("subscriptions"))) {
        return res.status(403).json({ message: "Subscriptions are not enabled." });
    }

    const catalogModule = req.scope.resolve(CATALOG_MODULE) as {
        cancelSubscription: (id: string) => Promise<unknown>;
    };
    const result = await catalogModule.cancelSubscription(req.params.id);
    return res.status(200).json(result);
}
