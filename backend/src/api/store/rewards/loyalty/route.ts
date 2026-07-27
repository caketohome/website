import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { REWARDS_MODULE } from "../../../../modules/rewards";
import { SETTINGS_MODULE } from "../../../../modules/settings";
import zod from "zod";

const redeemPointsSchema = zod.object({
  points: zod.number().int().positive(),
  idempotency_key: zod.string().optional(),
});

/**
 * GET /store/rewards/loyalty
 * Storefront — retrieve authenticated customer's loyalty ledger and transactions.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const settingsModule = req.scope.resolve(SETTINGS_MODULE) as {
    isFeatureEnabled: (flag: string) => Promise<boolean>;
  };
  const rewardsModuleService = req.scope.resolve(REWARDS_MODULE) as any;
  const customerId = (req as any).auth_context?.actor_id as string | undefined;

  if (!customerId) {
    return res.status(401).json({ message: "Customer authentication required." });
  }

  try {
    if (!(await settingsModule.isFeatureEnabled("rewards_loyalty"))) {
      return res.status(400).json({ message: "Loyalty Program feature is currently disabled." });
    }

    const ledger = await rewardsModuleService.getOrCreateLoyaltyLedger(customerId);
    const transactions = await rewardsModuleService.listLoyaltyTransactions(
      { loyalty_ledger_id: ledger.id },
      { order: { created_at: "DESC" } }
    );

    return res.status(200).json({ ledger, transactions });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

/**
 * POST /store/rewards/loyalty/redeem
 * Storefront — redeem loyalty points for a discount/checkout benefit.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = redeemPointsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid points redemption parameters.",
      errors: parsed.error.flatten(),
    });
  }

  const settingsModule = req.scope.resolve(SETTINGS_MODULE) as {
    isFeatureEnabled: (flag: string) => Promise<boolean>;
  };
  const rewardsModuleService = req.scope.resolve(REWARDS_MODULE) as any;
  const customerId = (req as any).auth_context?.actor_id as string | undefined;

  if (!customerId) {
    return res.status(401).json({ message: "Customer authentication required." });
  }

  try {
    if (!(await settingsModule.isFeatureEnabled("rewards_loyalty"))) {
      return res.status(400).json({ message: "Loyalty Program feature is currently disabled." });
    }

    const { points, idempotency_key } = parsed.data;

    const result = await rewardsModuleService.redeemLoyaltyPoints(
      customerId,
      points,
      "checkout",
      null,
      idempotency_key ?? null,
      customerId
    );

    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}
