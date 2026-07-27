import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { REWARDS_MODULE } from "../../../../../modules/rewards";
import { SETTINGS_MODULE } from "../../../../../modules/settings";
import zod from "zod";

const validateSchema = zod.object({
  code: zod.string().min(1),
  currency_code: zod.string().default("INR"),
});

/**
 * POST /store/rewards/gift-cards/validate
 * Storefront — validate a gift card before applying.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = validateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid validation payload.",
      errors: parsed.error.flatten(),
    });
  }

  const settingsModule = req.scope.resolve(SETTINGS_MODULE) as {
    isFeatureEnabled: (flag: string) => Promise<boolean>;
  };
  const rewardsModuleService = req.scope.resolve(REWARDS_MODULE) as any;

  try {
    if (!(await settingsModule.isFeatureEnabled("rewards_gift_cards"))) {
      return res.status(400).json({ message: "Gift Cards feature is currently disabled." });
    }

    const { code, currency_code } = parsed.data;
    const giftCard = await rewardsModuleService.validateGiftCard(code, currency_code);

    return res.status(200).json({
      valid: true,
      gift_card: {
        code: giftCard.code,
        current_balance: giftCard.current_balance,
        currency_code: giftCard.currency_code,
        expires_at: giftCard.expires_at,
        status: giftCard.status,
      },
    });
  } catch (error: any) {
    return res.status(400).json({ valid: false, message: error.message });
  }
}
