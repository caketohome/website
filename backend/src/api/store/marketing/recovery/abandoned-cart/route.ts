import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { MARKETING_MODULE } from "../../../../../modules/marketing";
import { SETTINGS_MODULE } from "../../../../../modules/settings";

/**
 * POST /store/marketing/recovery/abandoned-cart
 * Storefront — schedule an abandoned-cart recovery job for a cart. Idempotent:
 * if a pending job already exists for the same cart_id, returns the existing
 * job. Gated by the `marketing` feature flag.
 *
 * Body:
 *   cart_id: string (required)
 *   customer_id?: string
 *   session_id?: string
 *   email?: string
 *   phone?: string
 *   delay_minutes?: number (default 60)
 *   offer_code?: string
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
        if (!body?.cart_id) {
            return res.status(400).json({ message: "cart_id is required" });
        }

        const job = await marketingModule.scheduleAbandonedCartRecovery({
            cart_id: body.cart_id,
            customer_id: body.customer_id ?? null,
            session_id: body.session_id ?? null,
            email: body.email ?? null,
            phone: body.phone ?? null,
            delay_minutes: body.delay_minutes,
            offer_code: body.offer_code ?? null,
            metadata: body.metadata ?? null,
        });
        return res.status(200).json({ job });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return res.status(400).json({ message });
    }
}
