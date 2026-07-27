import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { MARKETING_MODULE } from "../../../../modules/marketing";

/**
 * GET /admin/marketing/overview
 * Admin — aggregated marketing dashboard overview: total campaigns,
 * counts by status, active count, total budget allocated & spent.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const marketingModuleService = req.scope.resolve(MARKETING_MODULE) as any;

    try {
        const overview = await marketingModuleService.getOverview();
        return res.status(200).json(overview);
    } catch (error: any) {
        return res.status(500).json({ message: error.message });
    }
}
