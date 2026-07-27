import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { REWARDS_MODULE } from "../../../../modules/rewards";

/**
 * GET /admin/rewards/wallets
 * Admin — list all customer wallets with pagination and count.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const rewardsModuleService = req.scope.resolve(REWARDS_MODULE) as any;

  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

    const [wallets, count] = await rewardsModuleService.listAndCountWallets(
      {},
      {
        skip: offset,
        take: limit,
        order: { created_at: "DESC" },
      }
    );

    return res.status(200).json({ wallets, count, limit, offset });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
