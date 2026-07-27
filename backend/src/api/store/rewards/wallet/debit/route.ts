import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { REWARDS_MODULE } from "../../../../../modules/rewards";
import { SETTINGS_MODULE } from "../../../../../modules/settings";
import zod from "zod";

const debitSchema = zod.object({
  amount: zod.number().int().positive(),
  reference_id: zod.string().optional(),
  description: zod.string().optional(),
});

/**
 * POST /store/rewards/wallet/debit
 * Storefront — debit the authenticated customer's wallet balance (e.g. at checkout).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = debitSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid wallet debit parameters.",
      errors: parsed.error.flatten(),
    });
  }

  const settingsModule = req.scope.resolve(SETTINGS_MODULE) as any;
  const rewardsModuleService = req.scope.resolve(REWARDS_MODULE) as any;
  const customerId = (req as any).auth_context?.actor_id as string | undefined;

  if (!customerId) {
    return res.status(401).json({ message: "Customer authentication required." });
  }

  try {
    if (!(await settingsModule.isFeatureEnabled("rewards_wallet"))) {
      return res.status(400).json({ message: "Wallet feature is currently disabled." });
    }

    const { amount, reference_id, description } = parsed.data;

    const result = await rewardsModuleService.debitWallet(
      customerId,
      amount,
      "checkout",
      reference_id ?? null,
      description ?? "Checkout payment debit"
    );

    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
}
