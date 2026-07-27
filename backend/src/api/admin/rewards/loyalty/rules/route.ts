import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { REWARDS_MODULE } from "../../../../../modules/rewards";
import { AUDIT_MODULE } from "../../../../../modules/audit";
import zod from "zod";

const createRuleSchema = zod.object({
  name: zod.string().min(3),
  rule_type: zod.enum(["ratio", "fixed"]),
  value: zod.number().positive(),
  min_spend: zod.number().nonnegative().default(0),
  is_active: zod.boolean().default(true),
  conditions: zod.record(zod.string(), zod.unknown()).nullable().optional(),
  metadata: zod.record(zod.string(), zod.unknown()).nullable().optional(),
});

/**
 * GET /admin/rewards/loyalty/rules
 * Admin — list all earn rules.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const rewardsModuleService = req.scope.resolve(REWARDS_MODULE) as any;

  try {
    const rules = await rewardsModuleService.listLoyaltyRules({}, { order: { created_at: "DESC" } });
    return res.status(200).json({ rules });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

/**
 * POST /admin/rewards/loyalty/rules
 * Admin — create a new earn rule.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = createRuleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid rule schema.",
      errors: parsed.error.flatten(),
    });
  }

  const rewardsModuleService = req.scope.resolve(REWARDS_MODULE) as any;
  const auditModule = req.scope.resolve(AUDIT_MODULE) as any;
  const actorId = (req as any).auth_context?.actor_id as string | undefined;

  try {
    const { name, rule_type, value, min_spend, is_active, conditions, metadata } = parsed.data;

    const [rule] = await rewardsModuleService.createLoyaltyRules([
      {
        name,
        rule_type,
        value,
        min_spend,
        is_active,
        conditions: conditions ?? null,
        metadata: metadata ?? null,
      },
    ]);

    await auditModule.log({
      actor_id: actorId ?? null,
      actor_type: "admin",
      action: "loyalty_rule.created",
      entity: "loyalty_rule",
      entity_id: rule.id,
      metadata: { name, rule_type, value },
    });

    return res.status(201).json({ rule });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
