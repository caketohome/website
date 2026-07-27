import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import zod from "zod";
import { MARKETING_MODULE } from "../../../../modules/marketing";
import { SETTINGS_MODULE } from "../../../../modules/settings";
import type { CreateCampaignDTO } from "../../../../modules/marketing/types/common";

/**
 * GET /admin/marketing/campaigns
 * Admin — list campaigns with optional filters (status, type, is_featured)
 * and pagination.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const marketingModuleService = req.scope.resolve(MARKETING_MODULE) as any;

    try {
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
        const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

        const filters: Record<string, unknown> = {};
        if (req.query.status) filters.status = req.query.status;
        if (req.query.type) filters.type = req.query.type;
        if (req.query.is_featured !== undefined)
            filters.is_featured = req.query.is_featured === "true";

        const [campaigns, count] =
            await marketingModuleService.listAndCountCampaignsDTO(filters, {
                skip: offset,
                take: limit,
                order: { created_at: "DESC" },
            });

        return res.status(200).json({ campaigns, count, limit, offset });
    } catch (error: any) {
        return res.status(500).json({ message: error.message });
    }
}

const createCampaignSchema = zod.object({
    name: zod.string().min(1),
    description: zod.string().optional().nullable(),
    type: zod.string().optional(),
    status: zod.string().optional(),
    starts_at: zod.union([zod.string(), zod.date()]).optional().nullable(),
    ends_at: zod.union([zod.string(), zod.date()]).optional().nullable(),
    budget_total: zod.number().optional().nullable(),
    budget_currency: zod.string().optional().nullable(),
    goal_type: zod.string().optional().nullable(),
    goal_target: zod.number().optional().nullable(),
    targeting: zod.any().optional().nullable(),
    channels: zod.any().optional().nullable(),
    offer_ids: zod.array(zod.string()).optional().nullable(),
    segment_ids: zod.array(zod.string()).optional().nullable(),
    branch_ids: zod.array(zod.string()).optional().nullable(),
    automation_flow_ids: zod.array(zod.string()).optional().nullable(),
    is_featured: zod.boolean().optional(),
    sort_order: zod.number().optional(),
    metadata: zod.any().optional().nullable(),
});

/**
 * POST /admin/marketing/campaigns
 * Admin — create a new marketing campaign (always starts in draft unless
 * an explicit status is provided and validated by the service).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const settingsModule = req.scope.resolve(SETTINGS_MODULE) as {
        isFeatureEnabled: (flag: string) => Promise<boolean>;
    };
    const marketingModuleService = req.scope.resolve(MARKETING_MODULE) as any;

    try {
        if (!(await settingsModule.isFeatureEnabled("marketing_campaigns"))) {
            return res
                .status(400)
                .json({ message: "Marketing campaigns feature is currently disabled." });
        }

        const parsed = createCampaignSchema.parse(req.body);
        const campaign = await marketingModuleService.createCampaign(
            parsed as CreateCampaignDTO
        );

        return res.status(201).json({ campaign });
    } catch (error: any) {
        if (error.name === "ZodError") {
            return res.status(400).json({ message: "Validation error", errors: error.issues });
        }
        return res.status(500).json({ message: error.message });
    }
}
