import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { MARKETING_MODULE } from "../../../../../modules/marketing";
import { SETTINGS_MODULE } from "../../../../../modules/settings";

/**
 * GET /store/marketing/campaigns/:id
 * Storefront — public detail of a single campaign. Only returns the campaign
 * if it is active and within its scheduled window (no draft/paused/terminal
 * exposure). Gated by the `marketing_public_campaigns` feature flag.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const settingsModule = req.scope.resolve(SETTINGS_MODULE) as {
        isFeatureEnabled: (flag: string) => Promise<boolean>;
    };
    const marketingModuleService = req.scope.resolve(MARKETING_MODULE) as any;
    const { id } = req.params;

    try {
        if (!(await settingsModule.isFeatureEnabled("marketing_public_campaigns"))) {
            return res
                .status(400)
                .json({ message: "Public campaigns feature is currently disabled." });
        }

        const campaign = await marketingModuleService.retrieveCampaignDTO(id);

        // Only expose active + in-schedule campaigns publicly.
        if (!marketingModuleService.isWithinSchedule(campaign)) {
            return res
                .status(404)
                .json({ message: "Campaign not found or not currently active." });
        }

        // Strip internal financial fields.
        const publicCampaign = {
            id: campaign.id,
            name: campaign.name,
            description: campaign.description,
            type: campaign.type,
            status: campaign.status,
            starts_at: campaign.starts_at,
            ends_at: campaign.ends_at,
            goal_type: campaign.goal_type,
            offer_ids: campaign.offer_ids,
            branch_ids: campaign.branch_ids,
            is_featured: campaign.is_featured,
            sort_order: campaign.sort_order,
            metadata: campaign.metadata,
        };

        return res.status(200).json({ campaign: publicCampaign });
    } catch (error: any) {
        if (error.message?.includes("not found")) {
            return res.status(404).json({ message: "Campaign not found." });
        }
        return res.status(500).json({ message: error.message });
    }
}
