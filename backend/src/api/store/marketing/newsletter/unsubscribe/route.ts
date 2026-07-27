import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { MARKETING_MODULE } from "../../../../../modules/marketing";
import { SETTINGS_MODULE } from "../../../../../modules/settings";

/**
 * POST /store/marketing/newsletter/unsubscribe
 * Storefront — unsubscribe an email from the newsletter.
 *
 * Body:
 *   email: string (required)
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
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

        const body = req.body as any;
        if (!body?.email) {
            return res.status(400).json({ message: "email is required" });
        }

        const subscriber =
            await marketingModule.unsubscribeNewsletter(body.email);
        if (!subscriber) {
            return res
                .status(404)
                .json({ message: "Subscriber not found" });
        }
        return res.status(200).json({ subscriber });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return res.status(400).json({ message });
    }
}
