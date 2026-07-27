import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { REWARDS_MODULE } from "../../../../../modules/rewards";
import { AUDIT_MODULE } from "../../../../../modules/audit";
import zod from "zod";

const createProgramSchema = zod.object({
  name: zod.string().min(3),
  description: zod.string().optional(),
  status: zod.enum(["active", "disabled"]).default("active"),
  reward_type: zod.enum(["wallet", "loyalty", "gift_card"]),
  reward_value: zod.number().positive(),
  qualification_rules: zod.object({
    min_spend: zod.number().nonnegative().optional(),
    min_order_count: zod.number().int().positive().optional(),
    manual_approval: zod.boolean().optional(),
  }).optional(),
  start_date: zod.string().datetime().optional(),
  end_date: zod.string().datetime().optional(),
});

/**
 * GET /admin/rewards/referrals/programs - List all campaigns
 * POST /admin/rewards/referrals/programs - Create campaign
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const rewardsModuleService = req.scope.resolve(REWARDS_MODULE) as any;

  try {
    const programs = await rewardsModuleService.listReferralPrograms(
      {},
      { order: { created_at: "DESC" } }
    );
    return res.status(200).json({ programs });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = createProgramSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid program creation parameters.",
      errors: parsed.error.flatten(),
    });
  }

  const rewardsModuleService = req.scope.resolve(REWARDS_MODULE) as any;
  const auditModuleService = req.scope.resolve(AUDIT_MODULE) as any;
  const adminUser = (req as any).auth_context?.actor_id || "admin";

  try {
    const {
      name,
      description,
      status,
      reward_type,
      reward_value,
      qualification_rules,
      start_date,
      end_date,
    } = parsed.data;

    // If status is active, disable all other active campaigns first to ensure only 1 active at a time
    if (status === "active") {
      const activePrograms = await rewardsModuleService.listReferralPrograms({ status: "active" });
      for (const p of activePrograms) {
        await rewardsModuleService.updateReferralPrograms({
          selector: { id: p.id },
          data: { status: "disabled" },
        });
      }
    }

    const [program] = await rewardsModuleService.createReferralPrograms([
      {
        name,
        description: description || null,
        status,
        reward_type,
        reward_value,
        qualification_rules: qualification_rules || null,
        start_date: start_date ? new Date(start_date) : null,
        end_date: end_date ? new Date(end_date) : null,
      },
    ]);

    // Audit log
    await auditModuleService.log({
      action: "CREATE_REFERRAL_PROGRAM",
      actor_id: adminUser,
      actor_type: "admin",
      resource_id: program.id,
      metadata: { program },
    });

    return res.status(200).json({ program });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}
