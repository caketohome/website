import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { MARKETING_MODULE } from "../../../../../../modules/marketing";

/**
 * GET /admin/marketing/campaigns/:id/metrics
 * Admin — list denormalized metric rollups for a campaign, optionally
 * filtered by metric key and granularity.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const marketingModuleService = req.scope.resolve(MARKETING_MODULE) as any;
    const { id } = req.params;

    try {
        const filters: { metric?: string; granularity?: string } = {};
        if (req.query.metric) filters.metric = req.query.metric as string;
        if (req.query.granularity)
            filters.granularity = req.query.granularity as string;

        const metrics = await marketingModuleService.listCampaignMetricsDTO(
            id,
            filters
        );

        return res.status(200).json({ metrics });
    } catch (error: any) {
        return res.status(500).json({ message: error.message });
    }
}
