import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { REWARDS_MODULE } from "../../../../../modules/rewards";
import { AUDIT_MODULE } from "../../../../../modules/audit";
import zod from "zod";

const reviewSchema = zod.object({
  referral_event_id: zod.string().min(1),
  status: zod.enum(["approved", "rejected"]),
  reason: zod.string().optional(),
});

/**
 * POST /admin/rewards/referrals/review
 * Manually approve or reject a suspicious/pending referral event from the fraud review queue.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid fraud review parameters.",
      errors: parsed.error.flatten(),
    });
  }

  const rewardsModuleService = req.scope.resolve(REWARDS_MODULE) as any;
  const auditModuleService = req.scope.resolve(AUDIT_MODULE) as any;
  const adminUser = (req as any).auth_context?.actor_id || "admin";

  try {
    const { referral_event_id, status, reason } = parsed.data;

    // Check if a fraud review exists for this event
    const [review] = await rewardsModuleService.listFraudReviews({
      referral_event_id,
      status: "pending",
    });

    if (review) {
      await rewardsModuleService.updateFraudReviews({
        selector: { id: review.id },
        data: {
          status,
          reason: reason || `Manual review: ${status}`,
          reviewer: adminUser,
        },
      });
    } else {
      // If no pending fraud review exists, we can still create one to document the action
      await rewardsModuleService.createFraudReviews([
        {
          referral_event_id,
          status,
          reason: reason || `Manual override: ${status}`,
          reviewer: adminUser,
        },
      ]);
    }

    // Update qualification table status
    const [qual] = await rewardsModuleService.listReferralQualifications({
      referral_event_id,
    });

    if (qual) {
      await rewardsModuleService.updateReferralQualifications({
        selector: { id: qual.id },
        data: {
          qualified: status === "approved",
          qualification_reason: reason || `Manual override: ${status}`,
          reviewed_at: new Date(),
          reviewed_by: adminUser,
        },
      });
    } else {
      await rewardsModuleService.createReferralQualifications([
        {
          referral_event_id,
          qualified: status === "approved",
          qualification_reason: reason || `Manual override: ${status}`,
          reviewed_at: new Date(),
          reviewed_by: adminUser,
          fraud_score: 0,
        },
      ]);
    }

    if (status === "approved") {
      // Transition referral event status to qualified and decide/allocate rewards!
      const decision = await rewardsModuleService.executeRewardDecision(referral_event_id);
      if (decision.rewarded) {
        await rewardsModuleService.executeReward(referral_event_id);
      }
      await rewardsModuleService.emitEvent("fraud.review_completed", { event_id: referral_event_id, approved: true });
    } else {
      await rewardsModuleService.updateReferralEvents({
        selector: { id: referral_event_id },
        data: { status: "rejected" },
      });
      await rewardsModuleService.emitEvent("fraud.review_completed", { event_id: referral_event_id, approved: false });
    }

    // Audit log
    await auditModuleService.log({
      action: "MANUAL_FRAUD_REVIEW",
      actor_id: adminUser,
      actor_type: "admin",
      resource_id: referral_event_id,
      metadata: { status, reason },
    });

    return res.status(200).json({ success: true, message: `Referral event manual review resolved: ${status}` });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}
