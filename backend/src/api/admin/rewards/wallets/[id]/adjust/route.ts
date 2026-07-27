import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { REWARDS_MODULE } from "../../../../../../modules/rewards";
import { AUDIT_MODULE } from "../../../../../../modules/audit";
import zod from "zod";

const adjustSchema = zod.object({
  amount: zod.number(), // Positive to credit, negative to debit
  reference_type: zod.string().nullable().optional(),
  reference_id: zod.string().nullable().optional(),
  description: zod.string().max(500).nullable().optional(),
});

/**
 * POST /admin/rewards/wallets/:id/adjust
 * Admin — adjust customer wallet balance (credit/debit).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = adjustSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid adjustment payload.",
      errors: parsed.error.flatten(),
    });
  }

  const rewardsModuleService = req.scope.resolve(REWARDS_MODULE) as any;
  const auditModule = req.scope.resolve(AUDIT_MODULE) as any;

  const { id: walletId } = req.params;
  const actorId = (req as any).auth_context?.actor_id as string | undefined;

  try {
    const wallet = await rewardsModuleService.retrieveWallet(walletId);
    if (!wallet) {
      return res.status(404).json({ message: "Wallet not found." });
    }

    const { amount, reference_type, reference_id, description } = parsed.data;
    let result;

    if (amount > 0) {
      result = await rewardsModuleService.creditWallet(
        wallet.customer_id,
        amount,
        reference_type ?? "adjustment",
        reference_id ?? null,
        description ?? "Admin credit adjustment"
      );
    } else if (amount < 0) {
      result = await rewardsModuleService.debitWallet(
        wallet.customer_id,
        Math.abs(amount),
        reference_type ?? "adjustment",
        reference_id ?? null,
        description ?? "Admin debit adjustment"
      );
    } else {
      return res.status(400).json({ message: "Adjustment amount cannot be zero." });
    }

    // Log the transaction in the audit trail
    await auditModule.log({
      actor_id: actorId ?? null,
      actor_type: "admin",
      action: "wallet.adjusted",
      entity: "wallet",
      entity_id: walletId,
      metadata: {
        customer_id: wallet.customer_id,
        amount,
        reference_type,
        reference_id,
      },
    });

    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
