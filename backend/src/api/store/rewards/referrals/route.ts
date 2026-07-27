import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { REWARDS_MODULE } from "../../../../modules/rewards";
import { SETTINGS_MODULE } from "../../../../modules/settings";

/**
 * GET /store/rewards/referrals
 * Retrieve current authenticated customer's referral code and active program campaign info.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const settingsModule = req.scope.resolve(SETTINGS_MODULE) as any;
  const rewardsModuleService = req.scope.resolve(REWARDS_MODULE) as any;
  const customerId = (req as any).auth_context?.actor_id as string | undefined;

  if (!customerId) {
    return res.status(401).json({ message: "Customer authentication required." });
  }

  try {
    if (!(await settingsModule.isFeatureEnabled("rewards_referrals"))) {
      return res.status(400).json({ message: "Referrals feature is currently disabled." });
    }

    const referralCode = await rewardsModuleService.getOrCreateReferralCode(customerId);
    const programs = await rewardsModuleService.listReferralPrograms({ status: "active" });
    const program = programs[0] || null;

    return res.status(200).json({
      referral_code: referralCode,
      campaign: program ? {
        name: program.name,
        description: program.description,
        reward_type: program.reward_type,
        reward_value: program.reward_value,
        start_date: program.start_date,
        end_date: program.end_date,
      } : null,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
