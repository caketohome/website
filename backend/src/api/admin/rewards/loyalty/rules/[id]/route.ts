import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { REWARDS_MODULE } from "../../../../../../modules/rewards";
import { AUDIT_MODULE } from "../../../../../../modules/audit";
import zod from "zod";

const updateRuleSchema = zod.object({
  name: zod.string().min(3).optional(),
  value: zod.number().positive().optional(),
  min_spend: zod.number().nonnegative().optional(),
  is_active: zod.boolean().optional(),
  conditions: zod.record(zod.string(), zod.unknown()).nullable().optional(),
  metadata: zod.record(zod.string(), zod.unknown()).nullable().optional(),
});

/**
 * POST /admin/rewards/loyalty/rules/:id
 * Admin — update details of a loyalty rule.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params;
  const parsed = updateRuleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid update payload.",
      errors: parsed.error.flatten(),
    });
  }

  const rewardsModuleService = req.scope.resolve(REWARDS_MODULE) as any;
  const auditModule = req.scope.resolve(AUDIT_MODULE) as any;
  const actorId = (req as any).auth_context?.actor_id as string | undefined;

  try {
    const existing = await rewardsModuleService.retrieveLoyaltyRule(id);
    if (!existing) {
      return res.status(404).json({ message: "Loyalty rule not found." });
    }

    const [updated] = await rewardsModuleService.updateLoyaltyRules({
      selector: { id },
      data: parsed.data,
    });

    await auditModule.log({
      actor_id: actorId ?? null,
      actor_type: "admin",
      action: "loyalty_rule.updated",
      entity: "loyalty_rule",
      entity_id: id,
      metadata: parsed.data,
    });

    return res.status(200).json({ rule: updated });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params;
  const rewardsModuleService = req.scope.resolve(REWARDS_MODULE) as any;
  const auditModule = req.scope.resolve(AUDIT_MODULE) as any;
  const actorId = (req as any).auth_context?.actor_id as string | undefined;

  try {
    const existing = await rewardsModuleService.retrieveLoyaltyRule(id);
    if (!existing) {
      return res.status(404).json({ message: "Loyalty rule not found." });
    }

    await rewardsModuleService.deleteLoyaltyRules([id]);

    await auditModule.log({
      actor_id: actorId ?? null,
      actor_type: "admin",
      action: "loyalty_rule.deleted",
      entity: "loyalty_rule",
      entity_id: id,
      metadata: { name: existing.name },
    });

    return res.status(200).json({ id, object: "loyalty_rule", deleted: true });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
