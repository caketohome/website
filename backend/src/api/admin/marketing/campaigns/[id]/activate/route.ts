import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { MARKETING_MODULE } from "../../../../../../modules/marketing";

/**
 * POST /admin/marketing/campaigns/:id/activate
 * Admin — transition a campaign to "active" (validated state machine).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const marketingModuleService = req.scope.resolve(MARKETING_MODULE) as any;
    const { id } = req.params;

    try {
        const campaign = await marketingModuleService.activateCampaign(id);
        return res.status(200).json({ campaign });
    } catch (error: any) {
        if (error.message?.includes("Invalid campaign transition")) {
            return res.status(409).json({ message: error.message });
        }
        return res.status(500).json({ message: error.message });
    }
}
