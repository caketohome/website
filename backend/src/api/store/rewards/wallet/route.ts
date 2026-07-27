import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { REWARDS_MODULE } from "../../../../modules/rewards";
import { SETTINGS_MODULE } from "../../../../modules/settings";

/**
 * GET /store/rewards/wallet
 * Storefront — retrieve the logged-in customer's wallet balance and transactions list.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const customerId = (req as any).auth_context?.actor_id as string;
  if (!customerId) {
    return res.status(401).json({ message: "Unauthorized. Customer ID not found." });
  }

  const settingsModule = req.scope.resolve(SETTINGS_MODULE) as {
    isFeatureEnabled: (flag: string) => Promise<boolean>;
  };
  const rewardsModuleService = req.scope.resolve(REWARDS_MODULE) as any;

  try {
    if (!(await settingsModule.isFeatureEnabled("rewards_wallet"))) {
      return res.status(400).json({ message: "Wallet feature is currently disabled." });
    }

    const wallet = await rewardsModuleService.getOrCreateWallet(customerId);
    const transactions = await rewardsModuleService.listWalletTransactions(
      { wallet_id: wallet.id },
      { order: { created_at: "DESC" } }
    );

    return res.status(200).json({ wallet, transactions });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
