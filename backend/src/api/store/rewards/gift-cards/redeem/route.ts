import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { REWARDS_MODULE } from "../../../../../modules/rewards";
import { SETTINGS_MODULE } from "../../../../../modules/settings";
import zod from "zod";

const redeemSchema = zod.object({
  code: zod.string().min(1),
  amount: zod.number().positive(),
  reference_type: zod.string().optional(),
  reference_id: zod.string().optional(),
  idempotency_key: zod.string().optional(),
});

/**
 * POST /store/rewards/gift-cards/redeem
 * Storefront — redeem an amount from a gift card.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = redeemSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid redeem payload.",
      errors: parsed.error.flatten(),
    });
  }

  const settingsModule = req.scope.resolve(SETTINGS_MODULE) as {
    isFeatureEnabled: (flag: string) => Promise<boolean>;
  };
  const rewardsModuleService = req.scope.resolve(REWARDS_MODULE) as any;
  const customerId = (req as any).auth_context?.actor_id as string | undefined;

  try {
    if (!(await settingsModule.isFeatureEnabled("rewards_gift_cards"))) {
      return res.status(400).json({ message: "Gift Cards feature is currently disabled." });
    }

    const { code, amount, reference_type, reference_id, idempotency_key } = parsed.data;

    const result = await rewardsModuleService.redeemGiftCard(
      code,
      amount,
      reference_type ?? "checkout",
      reference_id ?? null,
      idempotency_key ?? null,
      customerId ?? null
    );

    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}
