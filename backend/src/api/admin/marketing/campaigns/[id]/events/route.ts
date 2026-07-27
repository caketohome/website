import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { MARKETING_MODULE } from "../../../../../../modules/marketing";

/**
 * GET /admin/marketing/campaigns/:id/events
 * Admin — list the append-only lifecycle + analytics event log for a campaign.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const marketingModuleService = req.scope.resolve(MARKETING_MODULE) as any;
    const { id } = req.params;

    try {
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
        const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

        const events = await marketingModuleService.listCampaignEventsDTO(id, {
            skip: offset,
            take: limit,
        });

        return res.status(200).json({ events, limit, offset });
    } catch (error: any) {
        return res.status(500).json({ message: error.message });
    }
}
