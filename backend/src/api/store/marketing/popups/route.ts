import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { MARKETING_MODULE } from "../../../../modules/marketing";
import { SETTINGS_MODULE } from "../../../../modules/settings";

/**
 * GET /store/marketing/popups
 * Storefront — list active popups eligible to be shown for the current
 * visitor context. Gated by the `marketing` feature flag.
 *
 * Query params (all optional, passed into PopupDisplayContext):
 *   - url           → current page URL
 *   - page_type     → home | product | category | cart | checkout | blog | cms
 *   - device        → mobile | desktop
 *   - branch_id     → current branch
 *
 * The storefront sends the visitor context; the service evaluates each
 * active popup's display_rules and returns only the eligible ones.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const settingsModule = req.scope.resolve(SETTINGS_MODULE) as {
        isFeatureEnabled: (flag: string) => Promise<boolean>;
    };
    const marketingModule = req.scope.resolve(MARKETING_MODULE) as any;

    try {
        if (!(await settingsModule.isFeatureEnabled("marketing"))) {
            return res
                .status(400)
                .json({ message: "Marketing feature is currently disabled." });
        }

        const ctx = {
            url: (req.query.url as string) ?? undefined,
            page_type: (req.query.page_type as string) ?? undefined,
            device: (req.query.device as "mobile" | "desktop") ?? undefined,
            branch_id: (req.query.branch_id as string) ?? undefined,
            is_logged_in: false, // storefront can extend this later
        };

        const eligible = await marketingModule.listEligiblePopups(ctx);
        return res.status(200).json({ popups: eligible });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return res.status(400).json({ message });
    }
}
