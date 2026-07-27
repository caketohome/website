import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { REWARDS_MODULE } from "../../../../modules/rewards";

/**
 * GET /admin/rewards/referrals
 * Retrieve the list of customer referral codes.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const rewardsModuleService = req.scope.resolve(REWARDS_MODULE) as any;

  try {
    const codes = await rewardsModuleService.listReferralCodes(
      {},
      { order: { created_at: "DESC" } }
    );
    return res.status(200).json({ codes });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
