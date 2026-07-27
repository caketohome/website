import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { REWARDS_MODULE } from "../../../../../../modules/rewards";
import { AUDIT_MODULE } from "../../../../../../modules/audit";

/**
 * POST /admin/rewards/gift-cards/:id/activate
 * Admin — activate a gift card by ID.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params;
  const rewardsModuleService = req.scope.resolve(REWARDS_MODULE) as any;
  const auditModule = req.scope.resolve(AUDIT_MODULE) as any;
  const actorId = (req as any).auth_context?.actor_id as string | undefined;

  try {
    const giftCard = await rewardsModuleService.retrieveGiftCard(id);
    if (!giftCard) {
      return res.status(404).json({ message: "Gift card not found." });
    }

    const updated = await rewardsModuleService.activateGiftCard(id);

    await auditModule.log({
      actor_id: actorId ?? null,
      actor_type: "admin",
      action: "gift_card.activated",
      entity: "gift_card",
      entity_id: id,
      metadata: { code: giftCard.code },
    });

    return res.status(200).json({ gift_card: updated });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
