import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import zod from "zod";
import { MARKETING_MODULE } from "../../../../../modules/marketing";
import type { UpdateCampaignDTO } from "../../../../../modules/marketing/types/common";

/**
 * GET /admin/marketing/campaigns/:id
 * Admin — retrieve a single campaign with its full DTO.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const marketingModuleService = req.scope.resolve(MARKETING_MODULE) as any;
    const { id } = req.params;

    try {
        const campaign = await marketingModuleService.retrieveCampaignDTO(id);
        return res.status(200).json({ campaign });
    } catch (error: any) {
        if (error.message?.includes("not found")) {
            return res.status(404).json({ message: error.message });
        }
        return res.status(500).json({ message: error.message });
    }
}

const updateCampaignSchema = zod.object({
    name: zod.string().min(1).optional(),
    description: zod.string().optional().nullable(),
    type: zod.string().optional(),
    status: zod.string().optional(),
    starts_at: zod.union([zod.string(), zod.date()]).optional().nullable(),
    ends_at: zod.union([zod.string(), zod.date()]).optional().nullable(),
    budget_total: zod.number().optional().nullable(),
    budget_currency: zod.string().optional().nullable(),
    budget_spent: zod.number().optional(),
    goal_type: zod.string().optional().nullable(),
    goal_target: zod.number().optional().nullable(),
    goal_achieved: zod.number().optional(),
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
 * POST /admin/marketing/campaigns/:id
 * Admin — update a campaign. Status changes are routed through the
 * validated state-machine transition path inside the service.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const marketingModuleService = req.scope.resolve(MARKETING_MODULE) as any;
    const { id } = req.params;

    try {
        const parsed = updateCampaignSchema.parse(req.body);
        const campaign = await marketingModuleService.updateCampaign(
            id,
            parsed as UpdateCampaignDTO
        );
        return res.status(200).json({ campaign });
    } catch (error: any) {
        if (error.name === "ZodError") {
            return res.status(400).json({ message: "Validation error", errors: error.issues });
        }
        if (error.message?.includes("not found")) {
            return res.status(404).json({ message: error.message });
        }
        if (error.message?.includes("Invalid campaign transition")) {
            return res.status(409).json({ message: error.message });
        }
        return res.status(500).json({ message: error.message });
    }
}

/**
 * DELETE /admin/marketing/campaigns/:id
 * Admin — permanently delete a campaign (soft-delete via MedusaService).
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
    const marketingModuleService = req.scope.resolve(MARKETING_MODULE) as any;
    const { id } = req.params;

    try {
        await marketingModuleService.deleteCampaign(id);
        return res.status(200).json({ id, deleted: true });
    } catch (error: any) {
        return res.status(500).json({ message: error.message });
    }
}
