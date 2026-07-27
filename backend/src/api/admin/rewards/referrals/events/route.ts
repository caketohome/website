import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { REWARDS_MODULE } from "../../../../../modules/rewards";

/**
 * GET /admin/rewards/referrals/events
 * Retrieve the list of all referral events and their qualifications.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const rewardsModuleService = req.scope.resolve(REWARDS_MODULE) as any;

  try {
    const events = await rewardsModuleService.listReferralEvents(
      {},
      { order: { created_at: "DESC" } }
    );

    const eventIds = events.map((e: any) => e.id);
    let qualifications: any[] = [];
    if (eventIds.length > 0) {
      qualifications = await rewardsModuleService.listReferralQualifications({
        referral_event_id: eventIds,
      });
    }

    const result = events.map((e: any) => {
      const qual = qualifications.find((q: any) => q.referral_event_id === e.id);
      return {
        ...e,
        qualification: qual || null,
      };
    });

    return res.status(200).json({ events: result });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
