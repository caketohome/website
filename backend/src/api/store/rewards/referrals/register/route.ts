import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { REWARDS_MODULE } from "../../../../../modules/rewards";
import { SETTINGS_MODULE } from "../../../../../modules/settings";
import zod from "zod";

const registerSchema = zod.object({
  code: zod.string().min(1),
  referee_id: zod.string().min(1),
  metadata: zod.record(zod.string(), zod.any()).optional(),
});

/**
 * POST /store/rewards/referrals/register
 * Record that a customer signed up using a referral link/code.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid referral registration parameters.",
      errors: parsed.error.flatten(),
    });
  }

  const settingsModule = req.scope.resolve(SETTINGS_MODULE) as any;
  const rewardsModuleService = req.scope.resolve(REWARDS_MODULE) as any;

  try {
    if (!(await settingsModule.isFeatureEnabled("rewards_referrals"))) {
      return res.status(400).json({ message: "Referrals feature is currently disabled." });
    }

    const { code, referee_id, metadata } = parsed.data;

    const event = await rewardsModuleService.registerReferralSignUp(code, referee_id, metadata);

    return res.status(200).json({ success: true, event });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}
