import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { REWARDS_MODULE } from "../../../../../modules/rewards";
import { SETTINGS_MODULE } from "../../../../../modules/settings";
import zod from "zod";

const validateSchema = zod.object({
  code: zod.string().min(1),
});

/**
 * POST /store/rewards/referrals/validate
 * Validates the existence and active status of a referral code.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = validateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid referral code validation parameters.",
      errors: parsed.error.flatten(),
    });
  }

  const settingsModule = req.scope.resolve(SETTINGS_MODULE) as any;
  const rewardsModuleService = req.scope.resolve(REWARDS_MODULE) as any;

  try {
    if (!(await settingsModule.isFeatureEnabled("rewards_referrals"))) {
      return res.status(400).json({ message: "Referrals feature is currently disabled." });
    }

    const { code } = parsed.data;

    const [refCode] = await rewardsModuleService.listReferralCodes({ code });
    if (!refCode) {
      return res.status(404).json({ valid: false, message: "Referral code not found." });
    }

    if (refCode.status !== "active") {
      return res.status(400).json({ valid: false, message: "Referral code is not active." });
    }

    if (refCode.expires_at && new Date(refCode.expires_at) < new Date()) {
      return res.status(400).json({ valid: false, message: "Referral code has expired." });
    }

    if (refCode.usage_limit !== null && refCode.usage_count >= refCode.usage_limit) {
      return res.status(400).json({ valid: false, message: "Referral code usage limit exceeded." });
    }

    return res.status(200).json({ valid: true, referral_code: refCode });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
