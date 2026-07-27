import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { REWARDS_MODULE } from "../../../../../modules/rewards";

/**
 * GET /admin/rewards/referrals/fraud
 * List all suspicious referral events marked for fraud review.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const rewardsModuleService = req.scope.resolve(REWARDS_MODULE) as any;

  try {
    const reviews = await rewardsModuleService.listFraudReviews(
      {},
      { order: { created_at: "DESC" } }
    );
    return res.status(200).json({ reviews });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
