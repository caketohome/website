import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { REWARDS_MODULE } from "../../../../../modules/rewards";
import { SETTINGS_MODULE } from "../../../../../modules/settings";

/**
 * GET /store/rewards/referrals/history
 * Retrieve the historical list of referrals made by this customer.
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

    const code = await rewardsModuleService.getOrCreateReferralCode(customerId);
    const events = await rewardsModuleService.listReferralEvents(
      { referral_code_id: code.id },
      { order: { created_at: "DESC" } }
    );

    // Populate qualification statuses
    const eventIds = events.map((e: any) => e.id);
    let qualifications: any[] = [];
    if (eventIds.length > 0) {
      qualifications = await rewardsModuleService.listReferralQualifications({
        referral_event_id: eventIds,
      });
    }

    const history = events.map((e: any) => {
      const qual = qualifications.find((q: any) => q.referral_event_id === e.id);
      return {
        id: e.id,
        referee_id: e.referee_id,
        event_type: e.event_type,
        status: e.status,
        created_at: e.created_at,
        qualified: qual ? qual.qualified : false,
        qualification_reason: qual ? qual.qualification_reason : null,
      };
    });

    return res.status(200).json({ history });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
