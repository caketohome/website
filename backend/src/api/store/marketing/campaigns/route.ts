import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { MARKETING_MODULE } from "../../../../modules/marketing";
import { SETTINGS_MODULE } from "../../../../modules/settings";

/**
 * GET /store/marketing/campaigns
 * Storefront — public listing of active, in-schedule campaigns that are
 * eligible to be shown to customers. Gated by the `marketing_public_campaigns`
 * feature flag. Returns only the public-safe fields (no budget/spend internals).
 *
 * Query params:
 *   - featured=true  → only featured campaigns
 *   - type=<type>    → filter by campaign type
 *   - limit/offset   → pagination
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const settingsModule = req.scope.resolve(SETTINGS_MODULE) as {
        isFeatureEnabled: (flag: string) => Promise<boolean>;
    };
    const marketingModuleService = req.scope.resolve(MARKETING_MODULE) as any;

    try {
        if (!(await settingsModule.isFeatureEnabled("marketing_public_campaigns"))) {
            return res
                .status(400)
                .json({ message: "Public campaigns feature is currently disabled." });
        }

        const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
        const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

        // Eligible = active + within schedule + budget not exhausted.
        const eligible = await marketingModuleService.listEligibleCampaigns();

        let filtered = eligible;
        if (req.query.featured === "true") {
            filtered = filtered.filter((c: any) => c.is_featured);
        }
        if (req.query.type) {
            filtered = filtered.filter((c: any) => c.type === req.query.type);
        }

        // Sort: featured first, then by sort_order, then by created_at desc.
        filtered.sort((a: any, b: any) => {
            if (a.is_featured !== b.is_featured) return b.is_featured ? 1 : -1;
            if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
            return (
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
        });

        const count = filtered.length;
        const paged = filtered.slice(offset, offset + limit);

        // Strip internal financial fields for the public response.
        const publicCampaigns = paged.map((c: any) => ({
            id: c.id,
            name: c.name,
            description: c.description,
            type: c.type,
            status: c.status,
            starts_at: c.starts_at,
            ends_at: c.ends_at,
            goal_type: c.goal_type,
            offer_ids: c.offer_ids,
            branch_ids: c.branch_ids,
            is_featured: c.is_featured,
            sort_order: c.sort_order,
            metadata: c.metadata,
        }));

        return res.status(200).json({
            campaigns: publicCampaigns,
            count,
            limit,
            offset,
        });
    } catch (error: any) {
        return res.status(500).json({ message: error.message });
    }
}
