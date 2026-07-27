import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { REWARDS_MODULE } from "../../../../../../modules/rewards";
import { AUDIT_MODULE } from "../../../../../../modules/audit";
import zod from "zod";

const updateProgramSchema = zod.object({
  name: zod.string().min(3).optional(),
  description: zod.string().optional(),
  status: zod.enum(["active", "disabled"]).optional(),
  reward_type: zod.enum(["wallet", "loyalty", "gift_card"]).optional(),
  reward_value: zod.number().positive().optional(),
  qualification_rules: zod.object({
    min_spend: zod.number().nonnegative().optional(),
    min_order_count: zod.number().int().positive().optional(),
    manual_approval: zod.boolean().optional(),
  }).optional(),
  start_date: zod.string().datetime().nullable().optional(),
  end_date: zod.string().datetime().nullable().optional(),
});

/**
 * PUT /admin/rewards/referrals/programs/:id - Edit campaign
 * DELETE /admin/rewards/referrals/programs/:id - Delete campaign
 */
export async function PUT(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params;
  const parsed = updateProgramSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid program update parameters.",
      errors: parsed.error.flatten(),
    });
  }

  const rewardsModuleService = req.scope.resolve(REWARDS_MODULE) as any;
  const auditModuleService = req.scope.resolve(AUDIT_MODULE) as any;
  const adminUser = (req as any).auth_context?.actor_id || "admin";

  try {
    const existing = await rewardsModuleService.retrieveReferralProgram(id);
    if (!existing) {
      return res.status(404).json({ message: "Referral program not found." });
    }

    const data: any = { ...parsed.data };
    if (data.start_date) data.start_date = new Date(data.start_date);
    if (data.end_date) data.end_date = new Date(data.end_date);

    // If status is active, disable all other active campaigns first to ensure only 1 active at a time
    if (data.status === "active") {
      const activePrograms = await rewardsModuleService.listReferralPrograms({ status: "active" });
      for (const p of activePrograms) {
        if (p.id !== id) {
          await rewardsModuleService.updateReferralPrograms({
            selector: { id: p.id },
            data: { status: "disabled" },
          });
        }
      }
    }

    const [updated] = await rewardsModuleService.updateReferralPrograms({
      selector: { id },
      data,
    });

    // Audit log
    await auditModuleService.log({
      action: "UPDATE_REFERRAL_PROGRAM",
      actor_id: adminUser,
      actor_type: "admin",
      resource_id: id,
      metadata: { original: existing, updated },
    });

    return res.status(200).json({ program: updated });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params;
  const rewardsModuleService = req.scope.resolve(REWARDS_MODULE) as any;
  const auditModuleService = req.scope.resolve(AUDIT_MODULE) as any;
  const adminUser = (req as any).auth_context?.actor_id || "admin";

  try {
    const existing = await rewardsModuleService.retrieveReferralProgram(id);
    if (!existing) {
      return res.status(404).json({ message: "Referral program not found." });
    }

    await rewardsModuleService.deleteReferralPrograms([id]);

    // Audit log
    await auditModuleService.log({
      action: "DELETE_REFERRAL_PROGRAM",
      actor_id: adminUser,
      actor_type: "admin",
      resource_id: id,
      metadata: { deleted: existing },
    });

    return res.status(200).json({ success: true });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}
