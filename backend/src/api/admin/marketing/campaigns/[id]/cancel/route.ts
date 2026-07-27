import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { MARKETING_MODULE } from "../../../../../../modules/marketing";

/**
 * POST /admin/marketing/campaigns/:id/cancel
 * Admin — cancel a campaign (terminal state).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const marketingModuleService = req.scope.resolve(MARKETING_MODULE) as any;
    const { id } = req.params;

    try {
        const campaign = await marketingModuleService.cancelCampaign(id);
        return res.status(200).json({ campaign });
    } catch (error: any) {
        if (error.message?.includes("Invalid campaign transition")) {
            return res.status(409).json({ message: error.message });
        }
        return res.status(500).json({ message: error.message });
    }
}
