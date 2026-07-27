import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { MARKETING_MODULE } from "../../../../../modules/marketing";
import { SETTINGS_MODULE } from "../../../../../modules/settings";

/**
 * GET /store/marketing/qr/:code
 * Storefront — resolve a QR code by its short token. Increments the scan
 * count and returns the target URL + optional offer code. The storefront
 * uses this to redirect the visitor and optionally reveal a coupon.
 * Gated by the `marketing` feature flag.
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

        const code = req.params.code as string;
        if (!code) {
            return res.status(400).json({ message: "code is required" });
        }

        const resolved = await marketingModule.resolveQRCode(code);
        return res.status(200).json({ qr_code: resolved });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return res.status(404).json({ message });
    }
}
