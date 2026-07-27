import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { REWARDS_MODULE } from "../../../../../modules/rewards";
import { AUDIT_MODULE } from "../../../../../modules/audit";
import zod from "zod";

const adjustPointsSchema = zod.object({
  customer_id: zod.string().min(1),
  points: zod.number().int(),
  description: zod.string().optional(),
});

/**
 * POST /admin/rewards/loyalty/adjust
 * Admin — manually adjust loyalty points balance for a customer.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = adjustPointsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid adjustment parameters.",
      errors: parsed.error.flatten(),
    });
  }

  const rewardsModuleService = req.scope.resolve(REWARDS_MODULE) as any;
  const auditModule = req.scope.resolve(AUDIT_MODULE) as any;
  const actorId = (req as any).auth_context?.actor_id as string | undefined;

  try {
    const { customer_id, points, description } = parsed.data;

    const result = await rewardsModuleService.adjustLoyaltyPoints(
      customer_id,
      points,
      description ?? null,
      actorId ?? null
    );

    await auditModule.log({
      actor_id: actorId ?? null,
      actor_type: "admin",
      action: "loyalty.adjusted",
      entity: "loyalty_ledger",
      entity_id: result.ledger.id,
      metadata: { customer_id, points, description },
    });

    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
