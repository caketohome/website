import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { MARKETING_MODULE } from "../../../../../modules/marketing";
import { SETTINGS_MODULE } from "../../../../../modules/settings";

/**
 * POST /store/marketing/newsletter/subscribe
 * Storefront — subscribe an email to the newsletter. Gated by the
 * `marketing` feature flag. Extends (does not replace) the existing
 * /api/subscribe SSE delivery stream — this is the newsletter subscription
 * store, populated here and surfaced in the admin newsletter dashboard.
 *
 * Body:
 *   email: string (required)
 *   phone?: string
 *   customer_id?: string
 *   source?: "footer" | "popup" | "checkout" (default "footer")
 *   tags?: string[]
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
        if (!body?.email || typeof body.email !== "string") {
            return res.status(400).json({ message: "email is required" });
        }

        const subscriber = await marketingModule.subscribeNewsletter({
            email: body.email,
            phone: body.phone ?? null,
            customer_id: body.customer_id ?? null,
            source: body.source ?? "footer",
            tags: body.tags ?? null,
            metadata: body.metadata ?? null,
        });
        return res.status(200).json({ subscriber });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return res.status(400).json({ message });
    }
}
