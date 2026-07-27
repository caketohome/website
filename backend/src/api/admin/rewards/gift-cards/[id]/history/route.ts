import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { REWARDS_MODULE } from "../../../../../../modules/rewards";

/**
 * GET /admin/rewards/gift-cards/:id/history
 * Admin — retrieve transaction history for a specific gift card.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params;
  const rewardsModuleService = req.scope.resolve(REWARDS_MODULE) as any;

  try {
    const giftCard = await rewardsModuleService.retrieveGiftCard(id);
    if (!giftCard) {
      return res.status(404).json({ message: "Gift card not found." });
    }

    const transactions = await rewardsModuleService.listGiftCardTransactions(
      { gift_card_id: id },
      { order: { created_at: "DESC" } }
    );

    return res.status(200).json({ gift_card: giftCard, transactions });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
