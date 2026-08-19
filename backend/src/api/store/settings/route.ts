import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { SETTINGS_MODULE } from "../../../modules/settings";

/**
 * GET /store/settings
 * Public storefront settings. Returns non-secret settings grouped.
 * Supports ?group=xxx to fetch a single group.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const settingsModule = req.scope.resolve(SETTINGS_MODULE) as any;
    const group = req.query.group as string | undefined;

    if (group) {
        const settings = await settingsModule.getGroup(group, false);
        return res.status(200).json({ group, settings });
    }

    const publicGroups = [
        "business",
        "delivery",
        "seo",
        "referral",
        "loyalty",
        "wallet",
        "marketing",
        "feature_flags",
        "localization",
    ];

    const result: Record<string, Record<string, unknown>> = {};

    for (const g of publicGroups) {
        result[g] = await settingsModule.getGroup(g, false);
    }

    return res.status(200).json({ settings: result });
}
