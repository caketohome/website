import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { REWARDS_MODULE } from "../../../../../modules/rewards";
import { SETTINGS_MODULE } from "../../../../../modules/settings";

/**
 * GET /store/rewards/gift-cards/:code
 * Storefront — retrieve a gift card details and balance.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { code } = req.params;
  const settingsModule = req.scope.resolve(SETTINGS_MODULE) as {
    isFeatureEnabled: (flag: string) => Promise<boolean>;
  };
  const rewardsModuleService = req.scope.resolve(REWARDS_MODULE) as any;

  try {
    if (!(await settingsModule.isFeatureEnabled("rewards_gift_cards"))) {
      return res.status(400).json({ message: "Gift Cards feature is currently disabled." });
    }

    const giftCard = await rewardsModuleService.validateGiftCard(code);
    return res.status(200).json({
      code: giftCard.code,
      current_balance: giftCard.current_balance,
      currency_code: giftCard.currency_code,
      expires_at: giftCard.expires_at,
      status: giftCard.status,
    });
  } catch (error: any) {
    if (
      error.message === "GIFT_CARD_NOT_FOUND" ||
      error.message === "GIFT_CARD_INACTIVE_OR_DISABLED" ||
      error.message === "GIFT_CARD_EXPIRED" ||
      error.message === "GIFT_CARD_EMPTY_BALANCE"
    ) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: error.message });
  }
}
